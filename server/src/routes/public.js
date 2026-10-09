import express from 'express';
import { db } from '../db.js';
import { executeWorkflow } from '../engine/runner.js';

const router = express.Router();

// POST /api/webhook/:slug - Inbound webhook trigger for active workflows
router.post('/webhook/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const workflow = db.prepare(`
      SELECT * FROM workflows 
      WHERE webhook_slug = ? AND is_active = 1
    `).get(slug);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Active webhook workflow not found for this slug',
      });
    }

    // Execute workflow asynchronously or synchronously
    const result = await executeWorkflow(workflow, {
      triggerType: 'webhook',
      webhookPayload: req.body || {},
      initialData: [{ json: req.body || {} }],
    });

    res.json({
      success: true,
      executionId: result.executionId,
      status: result.status,
    });
  } catch (err) {
    console.error('[Public API] Webhook error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/unsubscribe - Handles recipient unsubscribe clicks
router.get('/unsubscribe', (req, res) => {
  try {
    const { email } = req.query;

    if (email) {
      db.prepare(`
        UPDATE leads 
        SET status = 'Unsubscribed', step = 'Opted Out', updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(email) = LOWER(?)
      `).run(email.trim());

      console.log(`[Unsubscribe] Recipient ${email} marked as Unsubscribed.`);
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Unsubscribed — FlowCart</title>
        <style>
          body {
            margin: 0;
            background-color: #0A0A0A;
            color: #FFFFFF;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
          }
          .card {
            background-color: #141414;
            border: 1px solid #2A2A2A;
            padding: 40px;
            max-width: 480px;
            text-align: center;
          }
          .title {
            color: #E10600;
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
          }
          .desc {
            color: #888888;
            font-size: 13px;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .email-chip {
            background: #0A0A0A;
            border: 1px solid #2A2A2A;
            color: #FFFFFF;
            padding: 6px 14px;
            font-size: 12px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">You Are Unsubscribed</div>
          <p class="desc">
            Your email has been successfully removed from future automated outreach campaigns.
          </p>
          ${email ? `<div class="email-chip">${email}</div>` : ''}
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[Public API] Unsubscribe error:', err);
    res.status(500).send('Error processing unsubscribe request.');
  }
});

export default router;
