import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

// GET /api/settings - Read all key-value settings
router.get('/', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ settings });
  } catch (err) {
    console.error('[Settings API] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/settings - Update settings
router.post('/', authMiddleware, (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const tx = db.transaction((entries) => {
      for (const [key, value] of entries) {
        upsert.run({ key, value: String(value) });
      }
    });

    tx(Object.entries(settings));
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    console.error('[Settings API] POST error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// POST /api/settings/password - Change admin password
router.post('/password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const match = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Settings API] Password update error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// GET /api/settings/backup - Download database backup file
router.get('/backup', authMiddleware, (req, res) => {
  try {
    const dataDir = process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : (fs.existsSync('/data') ? '/data' : path.resolve(process.cwd(), '../data'));

    const dbPath = path.join(dataDir, 'flowcart.db');

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    const filename = `flowcart-backup-${new Date().toISOString().slice(0, 10)}.db`;
    res.download(dbPath, filename);
  } catch (err) {
    console.error('[Settings API] Backup error:', err);
    res.status(500).json({ error: 'Failed to generate backup' });
  }
});

export default router;
