import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import { executeWorkflow } from '../engine/runner.js';
import { updateScheduledJob, removeScheduledJob } from '../scheduler.js';

const router = express.Router();

// GET /api/workflows - List all workflows
router.get('/', authMiddleware, (req, res) => {
  try {
    const workflows = db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all();
    res.json({ workflows });
  } catch (err) {
    console.error('[Workflows API] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// GET /api/workflows/:id - Fetch single workflow
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json({ workflow });
  } catch (err) {
    console.error('[Workflows API] GET :id error:', err);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// POST /api/workflows - Create new workflow
router.post('/', authMiddleware, (req, res) => {
  try {
    const {
      name = 'Untitled Workflow',
      nodes_json = '[]',
      connections_json = '[]',
      trigger_type = 'manual',
      schedule_cron = '0 9 * * *',
    } = req.body;

    const id = uuidv4();
    const webhook_slug = `hook-${id.slice(0, 8)}`;

    db.prepare(`
      INSERT INTO workflows (id, name, is_active, nodes_json, connections_json, trigger_type, schedule_cron, webhook_slug)
      VALUES (?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      typeof nodes_json === 'string' ? nodes_json : JSON.stringify(nodes_json),
      typeof connections_json === 'string' ? connections_json : JSON.stringify(connections_json),
      trigger_type,
      schedule_cron,
      webhook_slug
    );

    const created = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
    res.status(201).json({ success: true, workflow: created });
  } catch (err) {
    console.error('[Workflows API] POST error:', err);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// PUT /api/workflows/:id - Update workflow
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      is_active,
      nodes_json,
      connections_json,
      trigger_type,
      schedule_cron,
      webhook_slug,
    } = req.body;

    const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    db.prepare(`
      UPDATE workflows 
      SET 
        name = ?,
        is_active = ?,
        nodes_json = ?,
        connections_json = ?,
        trigger_type = ?,
        schedule_cron = ?,
        webhook_slug = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : existing.name,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      nodes_json !== undefined
        ? (typeof nodes_json === 'string' ? nodes_json : JSON.stringify(nodes_json))
        : existing.nodes_json,
      connections_json !== undefined
        ? (typeof connections_json === 'string' ? connections_json : JSON.stringify(connections_json))
        : existing.connections_json,
      trigger_type !== undefined ? trigger_type : existing.trigger_type,
      schedule_cron !== undefined ? schedule_cron : existing.schedule_cron,
      webhook_slug !== undefined ? webhook_slug : existing.webhook_slug,
      id
    );

    const updated = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);

    // Update scheduler if schedule trigger
    if (updated.trigger_type === 'schedule') {
      if (updated.is_active) {
        updateScheduledJob(updated);
      } else {
        removeScheduledJob(updated.id);
      }
    }

    res.json({ success: true, workflow: updated });
  } catch (err) {
    console.error('[Workflows API] PUT error:', err);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// POST /api/workflows/:id/toggle - Toggle active status
router.post('/:id/toggle', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const newActive = existing.is_active ? 0 : 1;
    db.prepare('UPDATE workflows SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      newActive,
      id
    );

    const updated = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);

    if (updated.trigger_type === 'schedule') {
      if (newActive) {
        updateScheduledJob(updated);
      } else {
        removeScheduledJob(id);
      }
    }

    res.json({ success: true, is_active: newActive, workflow: updated });
  } catch (err) {
    console.error('[Workflows API] Toggle error:', err);
    res.status(500).json({ error: 'Failed to toggle workflow' });
  }
});

// DELETE /api/workflows/:id - Delete workflow
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    removeScheduledJob(id);
    const result = db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (err) {
    console.error('[Workflows API] DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// POST /api/workflows/:id/run - Execute workflow (Test run or manual dispatch)
router.post('/:id/run', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { isTestRun = true, initialData } = req.body;

    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const result = await executeWorkflow(workflow, {
      triggerType: 'manual',
      isTestRun: Boolean(isTestRun),
      initialData,
    });

    res.json({ success: true, result });
  } catch (err) {
    console.error('[Workflows API] Run error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
