import nodemailer from 'nodemailer';
import { db } from '../db.js';
import { decrypt } from '../crypto.js';
import { evaluateExpression, resolveObjectExpressions } from './expressions.js';

// Helper to sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Registry of node execution handlers.
 * Each handler takes:
 * - node: the workflow node object
 * - inputItems: array of item objects [{ json: { ... } }]
 * - context: { workflow, settings, nodeResults, executionId, isTestRun }
 * 
 * Returns:
 * - array of output items: [{ json: { ... } }]
 * OR
 * - for branching nodes (like IF): { trueItems: [...], falseItems: [...] }
 */

export const NODE_HANDLERS = {
  // -------------------------------------------------------------
  // TRIGGERS
  // -------------------------------------------------------------
  manual_trigger: async (node, inputItems, context) => {
    return [
      {
        json: {
          trigger: 'manual',
          timestamp: new Date().toISOString(),
          executed_by: context.workflow?.name || 'Manual Run',
        },
      },
    ];
  },

  schedule_trigger: async (node, inputItems, context) => {
    return [
      {
        json: {
          trigger: 'schedule',
          timestamp: new Date().toISOString(),
          cron: node.data?.cron || '0 9 * * *',
        },
      },
    ];
  },

  webhook_trigger: async (node, inputItems, context) => {
    // If inputItems passed from webhook payload, pass them through
    if (inputItems && inputItems.length > 0) return inputItems;
    return [
      {
        json: {
          trigger: 'webhook',
          timestamp: new Date().toISOString(),
          payload: context.webhookPayload || {},
        },
      },
    ];
  },

  // -------------------------------------------------------------
  // DATA NODES
  // -------------------------------------------------------------
  get_leads: async (node, inputItems, context) => {
    const status = node.data?.status || 'Pending';
    const limit = Number(node.data?.limit) || 10;

    let query = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY id ASC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params);

    if (rows.length === 0) {
      console.log(`[Engine - Get Leads] No leads found matching status=${status}`);
      return [];
    }

    return rows.map((lead) => ({
      json: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        business: lead.business,
        city: lead.city,
        status: lead.status,
        step: lead.step,
        sent_at: lead.sent_at,
      },
    }));
  },

  limit: async (node, inputItems, context) => {
    const maxItems = Number(node.data?.maxItems || node.data?.limit || 10);
    return inputItems.slice(0, maxItems);
  },

  loop_over_items: async (node, inputItems, context) => {
    // Passes items through sequentially (batch size 1)
    return inputItems;
  },

  // -------------------------------------------------------------
  // LOGIC & TRANSFORMS
  // -------------------------------------------------------------
  if_condition: async (node, inputItems, context) => {
    const {
      field = '{{ $json.email }}',
      operator = 'is_not_empty',
      compareValue = '',
    } = node.data || {};

    const trueItems = [];
    const falseItems = [];

    for (let i = 0; i < inputItems.length; i++) {
      const item = inputItems[i];
      const val1 = String(
        evaluateExpression(field, { ...context, item, itemIndex: i }) || ''
      ).trim();
      const val2 = String(
        evaluateExpression(compareValue, { ...context, item, itemIndex: i }) || ''
      ).trim();

      let conditionPassed = false;
      switch (operator) {
        case 'equals':
          conditionPassed = val1.toLowerCase() === val2.toLowerCase();
          break;
        case 'not_equals':
          conditionPassed = val1.toLowerCase() !== val2.toLowerCase();
          break;
        case 'contains':
          conditionPassed = val1.toLowerCase().includes(val2.toLowerCase());
          break;
        case 'not_contains':
          conditionPassed = !val1.toLowerCase().includes(val2.toLowerCase());
          break;
        case 'is_empty':
          conditionPassed = val1 === '';
          break;
        case 'is_not_empty':
          conditionPassed = val1 !== '';
          break;
        case 'greater_than':
          conditionPassed = Number(val1) > Number(val2);
          break;
        case 'less_than':
          conditionPassed = Number(val1) < Number(val2);
          break;
        default:
          conditionPassed = Boolean(val1);
      }

      if (conditionPassed) {
        trueItems.push(item);
      } else {
        falseItems.push(item);
      }
    }

    return {
      branching: true,
      trueItems,
      falseItems,
    };
  },

  edit_fields: async (node, inputItems, context) => {
    const assignments = node.data?.assignments || []; // [{ field: 'subject', value: 'Hello {{ $json.name }}' }]
    const outputItems = [];

    for (let i = 0; i < inputItems.length; i++) {
      const item = inputItems[i];
      const newJson = { ...item.json };

      for (const assign of assignments) {
        if (assign.field) {
          const evaluated = evaluateExpression(assign.value, {
            ...context,
            item,
            itemIndex: i,
          });
          newJson[assign.field] = evaluated;
        }
      }

      outputItems.push({ json: newJson });
    }

    return outputItems;
  },

  wait: async (node, inputItems, context) => {
    const rawSeconds = Number(node.data?.seconds) || 45;
    // In test runs, don't stall for 45s unless requested; cap at 1s for tests
    const waitSec = context.isTestRun ? Math.min(rawSeconds, 1) : rawSeconds;
    console.log(`[Engine - Wait] Waiting ${waitSec}s...`);
    await sleep(waitSec * 1000);
    return inputItems;
  },

  ai_write_email: async (node, inputItems, context) => {
    const {
      promptTemplate = 'Write a concise, professional outreach email introducing our solution to {{ $json.name }} at {{ $json.business }}. Focus on value for companies in {{ $json.city }}.',
      model = 'gpt-4o-mini',
    } = node.data || {};

    const apiKey = process.env.LLM_API_KEY || context.settings?.llm_api_key;
    const provider = process.env.LLM_PROVIDER || context.settings?.llm_provider || 'openai';

    const outputItems = [];

    for (let i = 0; i < inputItems.length; i++) {
      const item = inputItems[i];
      const prompt = evaluateExpression(promptTemplate, {
        ...context,
        item,
        itemIndex: i,
      });

      let aiResult = null;

      // If LLM API key is present, attempt live completion
      if (apiKey) {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model || 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are an expert sales copywriter. Respond ONLY with valid JSON having exactly two fields: "subject" (string) and "body" (string HTML format).',
                },
                { role: 'user', content: prompt },
              ],
              response_format: { type: 'json_object' },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            aiResult = JSON.parse(content);
          }
        } catch (err) {
          console.warn('[Engine - AI Write Email] API call error, using generator fallback:', err.message);
        }
      }

      // Safe fallback generator if API key is not configured or fails
      if (!aiResult) {
        const leadName = item.json.name || 'there';
        const leadBiz = item.json.business || 'your company';
        const leadCity = item.json.city ? ` in ${item.json.city}` : '';

        aiResult = {
          subject: `Partnership proposal for ${leadBiz}`,
          body: `<p>Hi ${leadName},</p>
<p>I came across ${leadBiz}${leadCity} and was very impressed by your work. We help growing businesses streamline operations and automate workflows with zero friction.</p>
<p>Would you have 10 minutes this week for a quick introductory conversation?</p>
<p>Best regards,<br/>The FlowCart Team</p>`,
        };
      }

      outputItems.push({
        json: {
          ...item.json,
          email_subject: aiResult.subject,
          email_body: aiResult.body,
        },
      });
    }

    return outputItems;
  },

  // -------------------------------------------------------------
  // EMAIL NODES
  // -------------------------------------------------------------
  send_email: async (node, inputItems, context) => {
    const {
      credential_id,
      to = '{{ $json.email }}',
      subject = '{{ $json.email_subject }}',
      body = '{{ $json.email_body }}',
      continueOnFail = false,
      retryOnFail = true,
    } = node.data || {};

    // 1. Resolve SMTP Credential
    let cred = null;
    if (credential_id) {
      cred = db.prepare('SELECT * FROM credentials WHERE id = ?').get(credential_id);
    }
    if (!cred) {
      // Pick first credential as default
      cred = db.prepare('SELECT * FROM credentials ORDER BY id ASC LIMIT 1').get();
    }

    if (!cred) {
      throw new Error('No SMTP credentials found in database. Please configure one in Credentials page.');
    }

    const rawPassword = decrypt(cred.password_encrypted);
    const transporter = nodemailer.createTransport({
      host: cred.host,
      port: Number(cred.port) || 587,
      secure: cred.secure === 1 || Number(cred.port) === 465,
      auth: { user: cred.user, pass: rawPassword },
      connectionTimeout: 8000,
      tls: { rejectUnauthorized: false },
    });

    // 2. Read safety settings
    const dailyLimit = Number(context.settings?.daily_send_limit) || 30;
    const unsubText =
      context.settings?.unsubscribe_text ||
      'If you wish to unsubscribe, click here: {{unsubscribe_url}}';

    // Count emails sent today
    const sentTodayCount = db
      .prepare(`SELECT COUNT(*) as count FROM leads WHERE sent_at >= date('now', 'start of day')`)
      .get().count;

    let currentSent = sentTodayCount;
    const outputItems = [];

    for (let i = 0; i < inputItems.length; i++) {
      const item = inputItems[i];
      const targetEmail = evaluateExpression(to, { ...context, item, itemIndex: i });
      const emailSubject = evaluateExpression(subject, { ...context, item, itemIndex: i });
      let emailBody = evaluateExpression(body, { ...context, item, itemIndex: i });

      // Safety Rule 1: Check Lead Status
      const leadStatus = item.json.status;
      if (['Unsubscribed', 'Invalid'].includes(leadStatus)) {
        console.log(`[Engine - Send Email] Skipping lead ${targetEmail}: status is ${leadStatus}`);
        outputItems.push({
          json: { ...item.json, send_result: 'skipped', reason: `Status is ${leadStatus}` },
        });
        continue;
      }

      // Safety Rule 2: Enforce Daily Limit
      if (currentSent >= dailyLimit) {
        const limitMsg = `Daily send limit reached (${dailyLimit} emails/day). Halting outbound dispatch.`;
        console.warn(`[Engine - Send Email] ${limitMsg}`);
        if (!continueOnFail) {
          throw new Error(limitMsg);
        }
        outputItems.push({
          json: { ...item.json, send_result: 'halted', reason: limitMsg },
        });
        break;
      }

      // Append unsubscribe link
      const webhookBase = process.env.WEBHOOK_BASE_URL || 'http://localhost:3001';
      const unsubUrl = `${webhookBase}/api/unsubscribe?email=${encodeURIComponent(targetEmail)}`;
      const unsubHtml = `<br/><hr style="border:none;border-top:1px solid #ddd;margin:20px 0;"/><p style="font-size:11px;color:#777;">${unsubText.replace(
        '{{unsubscribe_url}}',
        `<a href="${unsubUrl}">${unsubUrl}</a>`
      )}</p>`;

      emailBody += unsubHtml;

      // Attempt send with retry logic
      let sendSuccess = false;
      let lastErr = null;
      const maxTries = retryOnFail ? 3 : 1;

      for (let attempt = 1; attempt <= maxTries; attempt++) {
        try {
          // If in test run and host is sandbox/local, simulate verified delivery
          if (context.isTestRun && (cred.host.includes('dummy') || cred.host.includes('test') || cred.host.includes('example'))) {
            sendSuccess = true;
            break;
          }

          await transporter.sendMail({
            from: cred.from_name
              ? `"${cred.from_name}" <${cred.from_email}>`
              : cred.from_email,
            to: targetEmail,
            subject: emailSubject,
            html: emailBody,
          });

          sendSuccess = true;
          currentSent++;
          break;
        } catch (err) {
          lastErr = err;
          console.warn(`[Engine - Send Email] Attempt ${attempt}/${maxTries} failed for ${targetEmail}:`, err.message);
          if (attempt < maxTries) {
            await sleep(context.isTestRun ? 500 : 5000);
          }
        }
      }

      if (sendSuccess) {
        outputItems.push({
          json: {
            ...item.json,
            send_result: 'success',
            sent_at: new Date().toISOString(),
          },
        });
      } else {
        if (!continueOnFail) {
          throw new Error(`Failed to send email to ${targetEmail}: ${lastErr?.message}`);
        }
        outputItems.push({
          json: {
            ...item.json,
            send_result: 'failed',
            error: lastErr?.message,
          },
        });
      }
    }

    return outputItems;
  },

  update_lead: async (node, inputItems, context) => {
    const { status = 'Sent', step = 'Email Sent' } = node.data || {};
    const outputItems = [];

    const updateStmt = db.prepare(`
      UPDATE leads 
      SET 
        status = ?,
        step = ?,
        sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? OR email = ?
    `);

    for (const item of inputItems) {
      const leadId = item.json.id;
      const leadEmail = item.json.email;

      if (leadId || leadEmail) {
        updateStmt.run(status, step, leadId || 0, leadEmail || '');
      }

      outputItems.push({
        json: {
          ...item.json,
          status,
          step,
          sent_at: new Date().toISOString(),
        },
      });
    }

    return outputItems;
  },

  // -------------------------------------------------------------
  // UTILITY
  // -------------------------------------------------------------
  stop_and_error: async (node, inputItems, context) => {
    const errorMsg = node.data?.errorMessage || 'Workflow stopped by Stop and Error node';
    throw new Error(errorMsg);
  },
};
