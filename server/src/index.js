import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initDatabase, db } from './db.js';
import { initScheduler } from './scheduler.js';

import authRoutes from './routes/auth.js';
import leadsRoutes from './routes/leads.js';
import credentialsRoutes from './routes/credentials.js';
import workflowsRoutes from './routes/workflows.js';
import executionsRoutes from './routes/executions.js';
import agentRoutes from './routes/agent.js';
import settingsRoutes from './routes/settings.js';
import publicRoutes from './routes/public.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed admin
initDatabase();

// Initialize active workflow cron jobs
initScheduler();

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

// Public Routes (Webhooks & Unsubscribe)
app.use('/api', publicRoutes);

// Protected API Routers
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/executions', executionsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/settings', settingsRoutes);

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
