import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initDatabase, db } from './db.js';
import authRoutes from './routes/auth.js';
import leadsRoutes from './routes/leads.js';
import credentialsRoutes from './routes/credentials.js';
import { authMiddleware } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed admin
initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'FlowCart',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Authentication Routes
app.use('/api/auth', authRoutes);

// Settings initial endpoints
app.get('/api/settings', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settingsObj = {};
  for (const r of rows) {
    settingsObj[r.key] = r.value;
  }
  res.json({ settings: settingsObj });
});

app.post('/api/settings', authMiddleware, (req, res) => {
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
  res.json({ success: true, message: 'Settings saved' });
});

// Minimal placeholder routes for Step 1
app.get('/api/workflows', authMiddleware, (req, res) => {
  const workflows = db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all();
  res.json({ workflows });
});

// Leads & Credentials Routes (Step 2)
app.use('/api/leads', leadsRoutes);
app.use('/api/credentials', credentialsRoutes);

app.get('/api/executions', authMiddleware, (req, res) => {
  const executions = db.prepare('SELECT * FROM executions ORDER BY started_at DESC LIMIT 50').all();
  res.json({ executions });
});

// Production Static Serving
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[FlowCart] Serving static client build from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 FlowCart Email Automation Server`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
});
