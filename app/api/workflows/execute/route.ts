import { NextRequest, NextResponse } from 'next/server';
import {
  getExecutionOrder,
  resolveTemplateVariables,
  simulateOpenAiOutput,
  getNestedValue,
  parseCsvToRecipients,
} from '@/lib/workflow-engine';
import {
  dispatchSingleEmail,
  dispatchBulkEmails,
} from '@/lib/email-service';
import {
  WorkflowExecutionLog,
  WorkflowExecutionResult,
} from '@/types/workflow';

export async function POST(req: NextRequest) {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { nodes = [], edges = [], apiKeys = {} } = body;

    const runId = 'run_' + Math.random().toString(36).substring(2, 9);
    const executionOrder = getExecutionOrder(nodes, edges);
    const nodeMap = new Map<string, any>(nodes.map((n: any) => [n.id, n]));

    const context: Record<string, any> = {
      runId,
      timestamp: new Date().toISOString(),
    };

    const logs: WorkflowExecutionLog[] = [];
    let hasError = false;

    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const nodeStart = Date.now();
      const nodeData = node.data || {};
      const config = nodeData.config || {};
      const nodeType = nodeData.nodeType || node.type;

      let outputPayload: any = null;
      let errorMsg: string | undefined = undefined;
      let status: 'success' | 'error' = 'success';
      let tokensUsed: number | undefined = undefined;

      try {
        switch (nodeType) {
          case 'email_list_file_upload': {
            const rawContent = config.rawContent || '';
            const parsed = parseCsvToRecipients(rawContent, {
              email: config.emailColumn,
              name: config.nameColumn,
              company: config.companyColumn,
            });

            outputPayload = {
              fileName: config.fileName || 'email_recipients.csv',
              recipients: parsed.recipients,
              totalCount: parsed.totalCount,
              validCount: parsed.validCount,
              invalidCount: parsed.invalidCount,
              fileType: config.fileType || 'csv',
              uploadedAt: new Date().toISOString(),
            };
            break;
          }

          case 'input_form_trigger': {
            outputPayload = {
              submittedValues: config.submittedValues || {},
              fields: config.fields || [],
              formTitle: config.formTitle || 'Form Submission',
              triggeredAt: new Date().toISOString(),
            };
            break;
          }

          case 'file_upload_trigger': {
            outputPayload = {
              fileName: config.sampleFileName || 'uploaded_document.json',
              content: config.sampleFileContent || '',
              parsedData: config.parsedData || { sample: true },
              fileSizeKb: 14.8,
              uploadedAt: new Date().toISOString(),
            };
            break;
          }

          case 'webhook_trigger': {
            outputPayload = {
              headers: { 'content-type': 'application/json', 'user-agent': 'WebhookClient/1.0' },
              body: config.payload || { event: 'user_signup', userId: 'usr_8923', email: 'test@example.com' },
              receivedAt: new Date().toISOString(),
            };
            break;
          }

          case 'openai_llm':
          case 'openai_classifier': {
            // Determine effective API Key and Base URL
            const effectiveApiKey =
              (config.apiKeySource === 'custom' && config.customApiKey)
                ? config.customApiKey
                : apiKeys.openaiApiKey || process.env.OPENAI_API_KEY;
            const baseUrl = config.customBaseUrl || 'https://api.openai.com/v1';

            const model = config.model || 'gpt-4o-mini';
            const executionMode = config.executionMode || 'single';

            // Check if batch execution mode over upstream list
            if (executionMode === 'batch') {
              // Locate target items list
              let itemsToProcess: any[] = [];
              if (config.batchSourceField) {
                const resolved = getNestedValue(context, config.batchSourceField);
                if (Array.isArray(resolved)) itemsToProcess = resolved;
              }

              // If not found, look for any upstream node with `recipients`
              if (itemsToProcess.length === 0) {
                for (const val of Object.values(context)) {
                  if (val && Array.isArray(val.recipients)) {
                    itemsToProcess = val.recipients;
                    break;
                  }
                }
              }

              // Fallback to sample items if none connected
              if (itemsToProcess.length === 0) {
                itemsToProcess = [
                  { email: 'alex@startup.io', name: 'Alex', company: 'Startup.io' },
                  { email: 'sarah@enterprise.com', name: 'Sarah', company: 'Enterprise Corp' },
                ];
              }

              const batchResults: any[] = [];
              let totalBatchTokens = 0;

              for (const item of itemsToProcess) {
                const itemContext = { ...context, item, ...item };
                const userPrompt = resolveTemplateVariables(config.userPrompt || '', itemContext);
                const systemPrompt = resolveTemplateVariables(config.systemPrompt || 'You are an AI assistant.', itemContext);

                if (effectiveApiKey && !config.mockFallback) {
                  try {
                    const response = await fetch(`${baseUrl}/chat/completions`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${effectiveApiKey}`,
                      },
                      body: JSON.stringify({
                        model,
                        messages: [
                          { role: 'system', content: systemPrompt },
                          { role: 'user', content: userPrompt },
                        ],
                        temperature: config.temperature ?? 0.7,
                        max_tokens: config.maxTokens ?? 400,
                      }),
                    });

                    if (response.ok) {
                      const data = await response.json();
                      const choice = data.choices?.[0]?.message?.content || '';
                      totalBatchTokens += data.usage?.total_tokens || 100;
                      batchResults.push({
                        ...item,
                        personalizedText: choice,
                        output: choice,
                        tokens: data.usage?.total_tokens,
                      });
                      continue;
                    }
                  } catch (e) {
                    // Fall back to simulation
                  }
                }

                // High fidelity sandbox generator per item
                const simOutput = simulateOpenAiOutput(userPrompt, systemPrompt, model, itemContext);
                const estTokens = Math.floor(userPrompt.length / 4) + Math.floor(simOutput.length / 4);
                totalBatchTokens += estTokens;
                batchResults.push({
                  ...item,
                  personalizedText: simOutput,
                  output: simOutput,
                  tokens: estTokens,
                  simulated: true,
                });
              }

              tokensUsed = totalBatchTokens;
              outputPayload = {
                mode: 'batch',
                totalProcessed: batchResults.length,
                items: batchResults,
                model,
                tokensUsed: totalBatchTokens,
                previewFirstItem: batchResults[0]?.personalizedText?.slice(0, 120),
              };
            } else {
              // Standard Single Execution
              const systemPrompt = resolveTemplateVariables(config.systemPrompt || 'You are an AI assistant.', context);
              const userPrompt = resolveTemplateVariables(config.userPrompt || '', context);

              if (effectiveApiKey && !config.mockFallback) {
                try {
                  const response = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${effectiveApiKey}`,
                    },
                    body: JSON.stringify({
                      model: model,
                      messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                      ],
                      temperature: config.temperature ?? 0.7,
                      max_tokens: config.maxTokens ?? 500,
                    }),
                  });

                  if (!response.ok) {
                    const errJson = await response.json().catch(() => ({}));
                    throw new Error(errJson.error?.message || `OpenAI API error ${response.status}`);
                  }

                  const data = await response.json();
                  const choice = data.choices?.[0]?.message?.content || '';
                  tokensUsed = data.usage?.total_tokens || 150;

                  outputPayload = {
                    output: choice,
                    model: data.model,
                    promptTokens: data.usage?.prompt_tokens,
                    completionTokens: data.usage?.completion_tokens,
                    totalTokens: tokensUsed,
                    apiKeyUsed: config.apiKeySource === 'custom' ? 'node_custom' : 'workspace_global',
                  };
                } catch (aiErr: any) {
                  const simOutput = simulateOpenAiOutput(userPrompt, systemPrompt, model, context);
                  outputPayload = {
                    output: simOutput,
                    model: `${model} (Sandbox Fallback: ${aiErr.message})`,
                    totalTokens: 185,
                    simulated: true,
                  };
                }
              } else {
                // Realistic Simulation
                const simOutput = simulateOpenAiOutput(userPrompt, systemPrompt, model, context);
                tokensUsed = Math.floor(userPrompt.length / 4) + Math.floor(simOutput.length / 4);
                outputPayload = {
                  output: simOutput,
                  model: `${model} (Sandbox Engine)`,
                  prompt: userPrompt,
                  totalTokens: tokensUsed,
                  simulated: true,
                };
              }
            }
            break;
          }

          case 'gmail_send': {
            // Determine credentials
            const authMethod = config.authMethod || (config.customAppPassword ? 'app_password' : 'global');
            const userEmail = config.customUserEmail || apiKeys.userEmail;
            const appPassword = config.customAppPassword || apiKeys.appPassword;
            const oauthToken = config.customOAuthToken || apiKeys.gmailToken;

            const sendMode = config.sendMode || 'single';

            if (sendMode === 'bulk') {
              // Locate recipient list (either from previous AI batch output or file upload)
              let recipientsToEmail: any[] = [];

              if (config.bulkRecipientSource) {
                const resolved = getNestedValue(context, config.bulkRecipientSource);
                if (Array.isArray(resolved)) recipientsToEmail = resolved;
              }

              if (recipientsToEmail.length === 0) {
                // Auto-detect from context
                for (const val of Object.values(context)) {
                  if (val && Array.isArray(val.items)) {
                    recipientsToEmail = val.items;
                    break;
                  }
                  if (val && Array.isArray(val.recipients)) {
                    recipientsToEmail = val.recipients;
                    break;
                  }
                }
              }

              if (recipientsToEmail.length === 0) {
                recipientsToEmail = [
                  { email: 'alex@example.com', name: 'Alex' },
                  { email: 'jordan@example.com', name: 'Jordan' },
                ];
              }

              // Format personalized subject and body for each recipient
              const preparedRecipients = recipientsToEmail.map((item) => {
                const itemCtx = { ...context, item, ...item };
                const personalizedSubj = resolveTemplateVariables(config.subject || 'Automated Outreach', itemCtx);
                let personalizedBody = resolveTemplateVariables(config.body || '', itemCtx);
                if (item.personalizedText || item.output) {
                  personalizedBody = personalizedBody.replace(/\{\{\s*personalizedText\s*\}\}/g, item.personalizedText || item.output);
                }
                return {
                  ...item,
                  personalizedSubject: personalizedSubj,
                  personalizedBody,
                };
              });

              const bulkDispatch = await dispatchBulkEmails({
                authMethod,
                userEmail,
                appPassword,
                oauthToken,
                recipients: preparedRecipients,
                defaultSubject: resolveTemplateVariables(config.subject || 'Automated Outreach', context),
                defaultBody: resolveTemplateVariables(config.body || '', context),
                isHtml: config.isHtml,
                delayMs: config.rateLimitDelayMs || 150,
              });

              outputPayload = {
                mode: 'bulk',
                totalAttempted: bulkDispatch.totalAttempted,
                totalSent: bulkDispatch.totalSent,
                totalFailed: bulkDispatch.totalFailed,
                results: bulkDispatch.results,
                durationMs: bulkDispatch.durationMs,
                sentAt: bulkDispatch.completedAt,
              };
            } else {
              // Single email mode
              const resolvedTo = resolveTemplateVariables(config.to || '', context);
              const resolvedCc = resolveTemplateVariables(config.cc || '', context);
              const resolvedSubject = resolveTemplateVariables(config.subject || 'Automated Workflow Alert', context);
              const resolvedBody = resolveTemplateVariables(config.body || '', context);

              const dispatchRes = await dispatchSingleEmail({
                authMethod,
                userEmail,
                appPassword,
                oauthToken,
                to: resolvedTo,
                cc: resolvedCc,
                subject: resolvedSubject,
                body: resolvedBody,
                isHtml: config.isHtml,
              });

              outputPayload = {
                mode: 'single',
                messageId: dispatchRes.messageId,
                threadId: dispatchRes.threadId,
                status: dispatchRes.success ? 'sent' : 'failed',
                to: dispatchRes.to,
                subject: dispatchRes.subject,
                bodySnippet: resolvedBody.slice(0, 160) + (resolvedBody.length > 160 ? '...' : ''),
                fullBody: resolvedBody,
                sentAt: dispatchRes.sentAt,
                previewUrl: dispatchRes.previewUrl,
                dispatchMode: dispatchRes.mode,
                error: dispatchRes.error,
              };
            }
            break;
          }

          case 'code_transform': {
            const rawCode = config.code || 'return input;';
            try {
              const transformFn = new Function('input', 'context', `
                try {
                  ${rawCode.includes('return') ? rawCode : `return (${rawCode})`}
                } catch (e) {
                  return { error: e.message };
                }
              `);
              outputPayload = transformFn(context, context);
            } catch (evalErr: any) {
              outputPayload = { rawCode, error: evalErr.message };
              status = 'error';
              errorMsg = evalErr.message;
            }
            break;
          }

          case 'condition_filter': {
            const val = getNestedValue(context, config.field || '');
            let passed = false;
            switch (config.operator) {
              case 'equals':
                passed = String(val) === String(config.value);
                break;
              case 'contains':
                passed = String(val).toLowerCase().includes(String(config.value).toLowerCase());
                break;
              case 'greater_than':
                passed = Number(val) > Number(config.value);
                break;
              case 'is_truthy':
              default:
                passed = Boolean(val);
                break;
            }
            outputPayload = {
              field: config.field,
              fieldValue: val,
              passed,
            };
            break;
          }

          default:
            outputPayload = { status: 'executed', generic: true };
        }
      } catch (nodeErr: any) {
        status = 'error';
        errorMsg = nodeErr.message || 'Node execution failed';
        hasError = true;
      }

      const nodeDuration = Date.now() - nodeStart;

      // Register output into context
      context[nodeId] = outputPayload;
      if (nodeData.label) {
        const safeLabel = nodeData.label.replace(/[^a-zA-Z0-9_]/g, '_');
        context[safeLabel] = outputPayload;
      }

      logs.push({
        nodeId,
        nodeName: nodeData.label || nodeId,
        nodeType,
        status,
        startedAt: new Date(nodeStart).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: nodeDuration,
        inputPayload: { contextAvailable: Object.keys(context) },
        outputPayload,
        error: errorMsg,
        tokensUsed,
      });

      if (status === 'error') {
        hasError = true;
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const finishedAt = new Date().toISOString();

    const response: WorkflowExecutionResult = {
      runId,
      startedAt,
      finishedAt,
      totalDurationMs,
      success: !hasError,
      logs,
      finalOutputs: context,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Execution error',
        startedAt,
        finishedAt: new Date().toISOString(),
        totalDurationMs: Date.now() - startTime,
        logs: [],
        finalOutputs: {},
      },
      { status: 500 }
    );
  }
}
