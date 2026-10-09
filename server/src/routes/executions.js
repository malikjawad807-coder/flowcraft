import express from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

// GET /api/executions - List executions with pagination / search
router.get('/', authMiddleware, (req, res) => {
  try {
    const { workflow_id, status, limit = 50 } = req.query;

    let query = 'SELECT id, workflow_id, workflow_name, trigger_type, status, started_at, finished_at, duration_ms, error FROM executions WHERE 1=1';
    const params = [];

    if (workflow_id) {
      query += ' AND workflow_id = ?';
      params.push(workflow_id);
    }

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY started_at DESC LIMIT ?';
    params.push(Number(limit) || 50);

    const executions = db.prepare(query).all(...params);

    // Compute execution stats
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCount,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as runningCount
      FROM executions
    `).get();

    res.json({ executions, stats });
  } catch (err) {
    console.error('[Executions API] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// GET /api/executions/:id - Get detailed execution record with node results
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id);
    if (!exec) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    let nodeResults = {};
    if (exec.node_results_json) {
      try {
        nodeResults = JSON.parse(exec.node_results_json);
      } catch (e) {
        nodeResults = {};
      }
    }

    res.json({ execution: { ...exec, nodeResults } });
  } catch (err) {
    console.error('[Executions API] GET :id error:', err);
    res.status(500).json({ error: 'Failed to fetch execution details' });
  }
});

// DELETE /api/executions/:id - Delete single execution record
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM executions WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    res.json({ success: true, message: 'Execution deleted' });
  } catch (err) {
    console.error('[Executions API] DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete execution' });
  }
});

// DELETE /api/executions - Clear all execution history
router.delete('/', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM executions').run();
    res.json({ success: true, message: 'All execution history cleared' });
  } catch (err) {
    console.error('[Executions API] Clear error:', err);
    res.status(500).json({ error: 'Failed to clear execution history' });
  }
});

export default router;
