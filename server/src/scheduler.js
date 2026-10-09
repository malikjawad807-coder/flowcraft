import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { db } from './db.js';
import { executeWorkflow } from './engine/runner.js';

// Map of workflowId -> cronTask
const activeJobs = new Map();

/**
 * Initializes cron jobs for all active workflows with schedule triggers and daily DB backup
 */
export function initScheduler() {
  console.log('[Scheduler] Initializing cron scheduler for active workflows...');
  
  try {
    const activeWorkflows = db.prepare(`
      SELECT * FROM workflows 
      WHERE is_active = 1 AND trigger_type = 'schedule'
    `).all();

    console.log(`[Scheduler] Found ${activeWorkflows.length} active scheduled workflows.`);
    for (const wf of activeWorkflows) {
      updateScheduledJob(wf);
    }

    // Schedule daily database backup at 03:00 AM
    scheduleDailyDbBackup();
  } catch (err) {
    console.error('[Scheduler] Initialization error:', err.message);
  }
}

/**
 * Register or update a scheduled job for a workflow
 */
export function updateScheduledJob(workflow) {
  removeScheduledJob(workflow.id);

  if (!workflow.is_active || workflow.trigger_type !== 'schedule') {
    return;
  }

  const cronExpr = workflow.schedule_cron || '0 9 * * *';

  if (!cron.validate(cronExpr)) {
    console.warn(`[Scheduler] Invalid cron expression "${cronExpr}" on workflow "${workflow.name}" (${workflow.id})`);
    return;
  }

  console.log(`[Scheduler] Scheduling workflow "${workflow.name}" (${workflow.id}) with cron "${cronExpr}"`);

  const task = cron.schedule(cronExpr, async () => {
    console.log(`[Scheduler] Cron triggered for workflow "${workflow.name}" (${workflow.id})`);
    try {
      // Reload fresh workflow config from DB
      const freshWf = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow.id);
      if (freshWf && freshWf.is_active) {
        await executeWorkflow(freshWf, {
          triggerType: 'schedule',
          isTestRun: false,
        });
      }
    } catch (err) {
      console.error(`[Scheduler] Execution error for "${workflow.name}":`, err.message);
    }
  });

  activeJobs.set(workflow.id, task);
}

/**
 * Stop and remove a scheduled job
 */
export function removeScheduledJob(workflowId) {
  if (activeJobs.has(workflowId)) {
    const task = activeJobs.get(workflowId);
    task.stop();
    activeJobs.delete(workflowId);
    console.log(`[Scheduler] Removed cron job for workflow ${workflowId}`);
  }
}

/**
 * Daily automatic backup of the SQLite file to /data/backups (keeps 7 days)
 */
function scheduleDailyDbBackup() {
  cron.schedule('0 3 * * *', () => {
    try {
      const dataDir = process.env.DATA_DIR
        ? path.resolve(process.env.DATA_DIR)
        : (fs.existsSync('/data') ? '/data' : path.resolve(process.cwd(), '../data'));

      const dbPath = path.join(dataDir, 'flowcart.db');
      const backupDir = path.join(dataDir, 'backups');

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      if (fs.existsSync(dbPath)) {
        const dateStr = new Date().toISOString().slice(0, 10);
        const backupDest = path.join(backupDir, `flowcart-backup-${dateStr}.db`);
        fs.copyFileSync(dbPath, backupDest);
        console.log(`[Backup] Automated daily database snapshot created at: ${backupDest}`);

        // Prune backups older than 7 days
        const files = fs.readdirSync(backupDir);
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

        for (const file of files) {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > sevenDaysMs) {
            fs.unlinkSync(filePath);
            console.log(`[Backup] Pruned old backup archive: ${file}`);
          }
        }
      }
    } catch (err) {
      console.error('[Backup] Automated daily backup error:', err.message);
    }
  });
}
