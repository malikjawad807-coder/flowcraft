import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import { executeWorkflow } from '../engine/runner.js';

const router = express.Router();

const SYSTEM_MASTER_PROMPT = `You are an advanced, highly secure AI Executive Assistant integrated into FlowCart (a visual email workflow automation platform). Your primary purpose is to automate outreach, manage communications, and assist the user by seamlessly coordinating between a Long-Term Memory System (Vector/SQLite Database) and an Email Management System.

Core Operational Directives:
1. Memory-First Execution:
   - Check and reference long-term memory for past preferences, lead notes, company tone, and daily limits.
   - Ground all actions in retrieved facts. Never invent past interactions.
2. FlowCart Schema & Nodes Knowledge:
   - Triggers: manual_trigger, schedule_trigger, webhook_trigger
   - Data: get_leads, limit, loop_over_items
   - Logic: if_condition, edit_fields, wait, ai_write_email
   - Email: send_email, update_lead
   - Utility: stop_and_error
3. Tool Execution Protocol:
   - When the user asks to build or run a workflow, list leads, or inspect executions, call the appropriate tool.
   - Automatically save important user preferences (business niche, tone, limits, rules) with save_memory.
   - Before activating or deleting a workflow or sending real live emails, ask the user for confirmation.
4. Output Constraints:
   - Keep communication concise and action-oriented. Provide clear summaries and confirmations.`;

// GET /api/agent/messages - Chat history
router.get('/messages', authMiddleware, (req, res) => {
  try {
    const messages = db.prepare('SELECT * FROM agent_messages ORDER BY id ASC LIMIT 100').all();
    res.json({ messages });
  } catch (err) {
    console.error('[Agent API] GET messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// DELETE /api/agent/messages - Clear chat history
router.delete('/messages', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM agent_messages').run();
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (err) {
    console.error('[Agent API] Clear messages error:', err);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// GET /api/agent/memories - List memories
router.get('/memories', authMiddleware, (req, res) => {
  try {
    const { q } = req.query;
    let query = 'SELECT * FROM agent_memories WHERE 1=1';
    const params = [];

    if (q && q.trim()) {
      query += ' AND content LIKE ?';
      params.push(`%${q.trim()}%`);
    }

    query += ' ORDER BY id DESC';
    const memories = db.prepare(query).all(...params);
    res.json({ memories });
  } catch (err) {
    console.error('[Agent API] GET memories error:', err);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

// POST /api/agent/memories - Save memory manually
router.post('/memories', authMiddleware, (req, res) => {
  try {
    const { type = 'preference', content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Memory content is required' });
    }

    const stmt = db.prepare('INSERT INTO agent_memories (type, content) VALUES (?, ?)');
    const result = stmt.run(type, content.trim());
    const created = db.prepare('SELECT * FROM agent_memories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, memory: created });
  } catch (err) {
    console.error('[Agent API] POST memory error:', err);
    res.status(500).json({ error: 'Failed to save memory' });
  }
});

// PUT /api/agent/memories/:id - Edit memory
router.put('/memories/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { type, content } = req.body;

    db.prepare('UPDATE agent_memories SET type = ?, content = ? WHERE id = ?').run(
      type || 'preference',
      content?.trim() || '',
      id
    );

    const updated = db.prepare('SELECT * FROM agent_memories WHERE id = ?').get(id);
    res.json({ success: true, memory: updated });
  } catch (err) {
    console.error('[Agent API] PUT memory error:', err);
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

// DELETE /api/agent/memories/:id - Delete single memory
router.delete('/memories/:id', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM agent_memories WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Memory deleted' });
  } catch (err) {
    console.error('[Agent API] DELETE memory error:', err);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// DELETE /api/agent/memories - Clear all memories
router.delete('/memories', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM agent_memories').run();
    res.json({ success: true, message: 'All memories cleared' });
  } catch (err) {
    console.error('[Agent API] Clear memories error:', err);
    res.status(500).json({ error: 'Failed to clear memories' });
  }
});

// POST /api/agent/chat - Interactive conversation with tool invocation and memory
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const userText = message.trim();

    // 1. Record user message in DB
    db.prepare('INSERT INTO agent_messages (role, content) VALUES (?, ?)').run('user', userText);

    // 2. Fetch recent memories
    const memories = db.prepare('SELECT type, content FROM agent_memories ORDER BY id DESC LIMIT 15').all();
    const memoryContext = memories.map((m) => `[${m.type.toUpperCase()}]: ${m.content}`).join('\n');

    // 3. Check for automatic preference capture
    const lowerText = userText.toLowerCase();
    if (
      lowerText.includes('always ') ||
      lowerText.includes('my company is') ||
      lowerText.includes('prefer ') ||
      lowerText.includes('remember that') ||
      lowerText.includes('our niche is')
    ) {
      db.prepare('INSERT INTO agent_memories (type, content) VALUES (?, ?)').run('preference', userText);
    }

    // 4. Autonomous tool handling & assistant intelligence
    let assistantReply = '';
    const toolCalls = [];

    if (lowerText.includes('list lead') || lowerText.includes('show lead') || lowerText.includes('how many lead')) {
      const leads = db.prepare('SELECT id, name, email, business, status FROM leads LIMIT 10').all();
      toolCalls.push({ name: 'list_leads', result: { count: leads.length, leads } });
      assistantReply = `Found **${leads.length}** leads in your database:\n` +
        leads.map((l) => `- **${l.name || 'Unnamed'}** (${l.email}) • ${l.business || 'N/A'} [${l.status}]`).join('\n') +
        '\n\nWould you like me to create an automated campaign for these leads?';
    } else if (lowerText.includes('list workflow') || lowerText.includes('show workflow')) {
      const workflows = db.prepare('SELECT id, name, is_active, trigger_type, last_run_at FROM workflows').all();
      toolCalls.push({ name: 'list_workflows', result: { count: workflows.length, workflows } });
      if (workflows.length === 0) {
        assistantReply = 'You do not have any workflows created yet. Would you like me to construct an email outreach workflow for you?';
      } else {
        assistantReply = `Here are your current workflows:\n` +
          workflows.map((w) => `- **${w.name}** [${w.is_active ? 'ACTIVE' : 'INACTIVE'}] • Trigger: ${w.trigger_type}`).join('\n');
      }
    } else if (lowerText.includes('create workflow') || lowerText.includes('build a workflow') || lowerText.includes('email pending leads')) {
      // Build sample outreach workflow
      const newId = uuidv4();
      const wfName = 'Automated Cold Outreach Pipeline';
      const nodes = [
        { id: 'node-1', type: 'schedule_trigger', data: { label: 'Daily 10 AM', cron: '0 10 * * *' }, position: { x: 100, y: 150 } },
        { id: 'node-2', type: 'get_leads', data: { label: 'Get Pending Leads', status: 'Pending', limit: 30 }, position: { x: 340, y: 150 } },
        { id: 'node-3', type: 'if_condition', data: { label: 'Check Email Valid', field: '{{ $json.email }}', operator: 'contains', compareValue: '@' }, position: { x: 580, y: 150 } },
        { id: 'node-4', type: 'ai_write_email', data: { label: 'AI Write Email', promptTemplate: 'Draft a short, compelling cold outreach email to {{ $json.name }} at {{ $json.business }}.' }, position: { x: 820, y: 100 } },
        { id: 'node-5', type: 'send_email', data: { label: 'Send Email', to: '{{ $json.email }}', subject: '{{ $json.email_subject }}', body: '{{ $json.email_body }}' }, position: { x: 1060, y: 100 } },
        { id: 'node-6', type: 'update_lead', data: { label: 'Mark Sent', status: 'Sent', step: 'Campaign Sent' }, position: { x: 1300, y: 100 } },
      ];
      const connections = [
        { id: 'e1-2', source: 'node-1', target: 'node-2' },
        { id: 'e2-3', source: 'node-2', target: 'node-3' },
        { id: 'e3-4', source: 'node-3', target: 'node-4', sourceHandle: 'true' },
        { id: 'e4-5', source: 'node-4', target: 'node-5' },
        { id: 'e5-6', source: 'node-5', target: 'node-6' },
      ];

      db.prepare(`
        INSERT INTO workflows (id, name, is_active, nodes_json, connections_json, trigger_type, schedule_cron, webhook_slug)
        VALUES (?, ?, 0, ?, ?, 'schedule', '0 10 * * *', ?)
      `).run(newId, wfName, JSON.stringify(nodes), JSON.stringify(connections), `hook-${newId.slice(0, 8)}`);

      toolCalls.push({ name: 'create_workflow', result: { id: newId, name: wfName } });
      assistantReply = `I have successfully constructed the workflow **"${wfName}"**:\n\n` +
        `- **Trigger**: Daily at 10:00 AM (\`0 10 * * *\`)\n` +
        `- **Steps**: Get Pending Leads (30/day limit) ➔ Validate Email ➔ AI Personalize ➔ SMTP Send ➔ Mark Lead Sent\n\n` +
        `The workflow is currently saved in **Draft (Inactive)** mode for safety. You can open it in the Canvas editor to review and toggle it active.`;
    } else if (lowerText.includes('memory') || lowerText.includes('remember')) {
      assistantReply = `Here is what I have saved in your long-term memory:\n\n` +
        (memories.length > 0
          ? memories.map((m) => `- [${m.type}] ${m.content}`).join('\n')
          : 'No specific preferences saved yet. Feel free to tell me about your business, tone, or sending rules!') +
        `\n\nYou can manage all memories anytime under the **Memory Vault** tab.`;
    } else {
      assistantReply = `I have analyzed your request based on your current FlowCart database and saved preferences.\n\n` +
        `I can create automated email workflows, check your leads table, execute test runs, and store operational guidelines in memory.\n\n` +
        `What would you like to execute next? (e.g., *"Create a workflow that emails pending leads every day at 10am"*, *"Show my pending leads"*, or *"Check execution history"*).`;
    }

    // 5. Save assistant reply in DB
    db.prepare(`
      INSERT INTO agent_messages (role, content, tool_calls_json)
      VALUES (?, ?, ?)
    `).run(
      'assistant',
      assistantReply,
      toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
    );

    res.json({
      success: true,
      reply: assistantReply,
      toolCalls,
    });
  } catch (err) {
    console.error('[Agent API] Chat error:', err);
    res.status(500).json({ error: 'Failed to process agent request' });
  }
});

export default router;
