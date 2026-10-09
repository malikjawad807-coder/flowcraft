import express from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

// Email format validator
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/leads - list leads with search, filter, and stats
router.get('/', authMiddleware, (req, res) => {
  try {
    const { q, status } = req.query;

    let baseQuery = 'FROM leads WHERE 1=1';
    const params = [];

    if (q && q.trim()) {
      baseQuery += ' AND (name LIKE ? OR email LIKE ? OR business LIKE ? OR city LIKE ?)';
      const term = `%${q.trim()}%`;
      params.push(term, term, term, term);
    }

    if (status && status !== 'all') {
      baseQuery += ' AND status = ?';
      params.push(status);
    }

    // Fetch matching leads
    const leadsStmt = db.prepare(`SELECT * ${baseQuery} ORDER BY id DESC`);
    const leads = leadsStmt.all(...params);

    // Compute status counts across entire table
    const statsStmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'Replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'Unsubscribed' THEN 1 ELSE 0 END) as unsubscribed,
        SUM(CASE WHEN status = 'Invalid' THEN 1 ELSE 0 END) as invalid
      FROM leads
    `);
    const statsRow = statsStmt.get();

    const stats = {
      total: statsRow.total || 0,
      pending: statsRow.pending || 0,
      sent: statsRow.sent || 0,
      failed: statsRow.failed || 0,
      replied: statsRow.replied || 0,
      unsubscribed: statsRow.unsubscribed || 0,
      invalid: statsRow.invalid || 0,
    };

    res.json({ leads, total: leads.length, stats });
  } catch (err) {
    console.error('[Leads API] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// POST /api/leads - Create single lead
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, email, business, city, status, step } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isValidEmail = EMAIL_REGEX.test(cleanEmail);

    const initialStatus = status || (isValidEmail ? 'Pending' : 'Invalid');
    const initialStep = step || 'Initial';

    const insertStmt = db.prepare(`
      INSERT INTO leads (name, email, business, city, status, step)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      name?.trim() || '',
      cleanEmail,
      business?.trim() || '',
      city?.trim() || '',
      initialStatus,
      initialStep
    );

    const newLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, lead: newLead });
  } catch (err) {
    console.error('[Leads API] POST error:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// POST /api/leads/import - Bulk import leads from parsed CSV
router.post('/import', authMiddleware, (req, res) => {
  try {
    const { leads = [], skipDuplicates = true } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'No leads provided for import' });
    }

    // Existing emails set for deduplication check
    const existingEmails = new Set(
      db.prepare('SELECT LOWER(email) as email FROM leads').all().map(r => r.email)
    );

    const insertStmt = db.prepare(`
      INSERT INTO leads (name, email, business, city, status, step)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    let skipped = 0;
    let invalid = 0;

    const importTx = db.transaction((items) => {
      for (const item of items) {
        if (!item.email || typeof item.email !== 'string') {
          skipped++;
          continue;
        }

        const cleanEmail = item.email.trim().toLowerCase();
        const isValid = EMAIL_REGEX.test(cleanEmail);

        if (skipDuplicates && existingEmails.has(cleanEmail)) {
          skipped++;
          continue;
        }

        const status = isValid ? (item.status || 'Pending') : 'Invalid';
        if (!isValid) invalid++;

        insertStmt.run(
          item.name?.trim() || '',
          cleanEmail,
          item.business?.trim() || '',
          item.city?.trim() || '',
          status,
          item.step || 'Initial'
        );

        existingEmails.add(cleanEmail);
        imported++;
      }
    });

    importTx(leads);

    res.json({
      success: true,
      imported,
      skipped,
      invalid,
      total: leads.length,
    });
  } catch (err) {
    console.error('[Leads API] Bulk import error:', err);
    res.status(500).json({ error: 'Failed to bulk import leads' });
  }
});

// POST /api/leads/sample - Seed test sample leads
router.post('/sample', authMiddleware, (req, res) => {
  try {
    const sampleLeads = [
      { name: 'Sarah Connor', email: 'sarah.connor@cyberdyne.tech', business: 'Cyberdyne Systems', city: 'Los Angeles', status: 'Pending', step: 'Initial' },
      { name: 'Bruce Wayne', email: 'bruce@wayne-enterprises.com', business: 'Wayne Enterprises', city: 'Gotham', status: 'Pending', step: 'Initial' },
      { name: 'Tony Stark', email: 'tony@starkindustries.io', business: 'Stark Industries', city: 'New York', status: 'Sent', step: 'Intro Sent' },
      { name: 'Elena Rostova', email: 'elena@novatech-logistics.com', business: 'NovaTech Logistics', city: 'Chicago', status: 'Pending', step: 'Initial' },
      { name: 'Marcus Vance', email: 'marcus@apexcapital.co', business: 'Apex Capital Advisors', city: 'Boston', status: 'Replied', step: 'Demo Scheduled' },
      { name: 'Clara Oswald', email: 'clara@tardis-consulting.uk', business: 'TARDIS Consulting', city: 'London', status: 'Pending', step: 'Initial' },
      { name: 'David Kim', email: 'david@solarlight.energy', business: 'SolarLight Clean Energy', city: 'Austin', status: 'Pending', step: 'Initial' },
      { name: 'Maya Lin', email: 'maya@zenitharch.studio', business: 'Zenith Architecture', city: 'Seattle', status: 'Failed', step: 'SMTP Timeout' },
      { name: 'Arthur Dent', email: 'arthur@galaxy-guides.org', business: 'Hitchhiker Media', city: 'Manchester', status: 'Unsubscribed', step: 'Opted Out' },
      { name: 'Invalid Contact', email: 'not-an-email-address', business: 'Broken Data Inc', city: 'Miami', status: 'Invalid', step: 'Format Error' },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO leads (name, email, business, city, status, step)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const existingEmails = new Set(
      db.prepare('SELECT LOWER(email) as email FROM leads').all().map(r => r.email)
    );

    let inserted = 0;
    const tx = db.transaction(() => {
      for (const lead of sampleLeads) {
        if (!existingEmails.has(lead.email.toLowerCase())) {
          insertStmt.run(lead.name, lead.email, lead.business, lead.city, lead.status, lead.step);
          inserted++;
        }
      }
    });
    tx();

    res.json({ success: true, inserted, totalSample: sampleLeads.length });
  } catch (err) {
    console.error('[Leads API] Sample seed error:', err);
    res.status(500).json({ error: 'Failed to seed sample leads' });
  }
});

// PUT /api/leads/:id - Update lead
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, business, city, status, step, sent_at } = req.body;

    const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : existing.email;
    const isValid = EMAIL_REGEX.test(cleanEmail);

    db.prepare(`
      UPDATE leads 
      SET 
        name = ?,
        email = ?,
        business = ?,
        city = ?,
        status = ?,
        step = ?,
        sent_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : existing.name,
      cleanEmail,
      business !== undefined ? business.trim() : existing.business,
      city !== undefined ? city.trim() : existing.city,
      status || (isValid ? existing.status : 'Invalid'),
      step !== undefined ? step : existing.step,
      sent_at !== undefined ? sent_at : existing.sent_at,
      id
    );

    const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    res.json({ success: true, lead: updated });
  } catch (err) {
    console.error('[Leads API] PUT error:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// DELETE /api/leads/:id - Delete single lead
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    console.error('[Leads API] DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// POST /api/leads/batch-delete - Delete multiple leads
router.post('/batch-delete', authMiddleware, (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`).run(...ids);

    res.json({ success: true, deletedCount: result.changes });
  } catch (err) {
    console.error('[Leads API] Batch delete error:', err);
    res.status(500).json({ error: 'Failed to batch delete leads' });
  }
});

// POST /api/leads/batch-status - Update status of multiple leads
router.post('/batch-status', authMiddleware, (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ error: 'IDs array and target status required' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`
      UPDATE leads 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id IN (${placeholders})
    `).run(status, ...ids);

    res.json({ success: true, updatedCount: result.changes });
  } catch (err) {
    console.error('[Leads API] Batch status error:', err);
    res.status(500).json({ error: 'Failed to update lead statuses' });
  }
});

export default router;
