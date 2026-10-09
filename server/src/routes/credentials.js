import express from 'express';
import nodemailer from 'nodemailer';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import { encrypt, decrypt } from '../crypto.js';

const router = express.Router();

// GET /api/credentials - List all SMTP credentials with encrypted passwords hidden
router.get('/', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, name, host, port, secure, user, from_name, from_email, created_at
      FROM credentials
      ORDER BY id DESC
    `).all();

    res.json({ credentials: rows });
  } catch (err) {
    console.error('[Credentials API] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// POST /api/credentials - Save new SMTP credential
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, host, port, secure, user, password, from_name, from_email } = req.body;

    if (!name || !host || !user || !password || !from_email) {
      return res.status(400).json({
        error: 'Name, Host, User, Password, and From Email are required',
      });
    }

    const encryptedPass = encrypt(password);
    const portNum = Number(port) || 587;
    const isSecure = (secure === true || secure === 1 || portNum === 465) ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO credentials (name, host, port, secure, user, password_encrypted, from_name, from_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      host.trim(),
      portNum,
      isSecure,
      user.trim(),
      encryptedPass,
      from_name ? from_name.trim() : '',
      from_email.trim()
    );

    const created = db.prepare(`
      SELECT id, name, host, port, secure, user, from_name, from_email, created_at
      FROM credentials WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ success: true, credential: created });
  } catch (err) {
    console.error('[Credentials API] POST error:', err);
    res.status(500).json({ error: 'Failed to create credential' });
  }
});

// PUT /api/credentials/:id - Update SMTP credential
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, host, port, secure, user, password, from_name, from_email } = req.body;

    const existing = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const portNum = port !== undefined ? (Number(port) || 587) : existing.port;
    const isSecure = secure !== undefined ? ((secure === true || secure === 1 || portNum === 465) ? 1 : 0) : existing.secure;
    
    // Only re-encrypt if a new password string is provided
    let encryptedPass = existing.password_encrypted;
    if (password && typeof password === 'string' && password.trim().length > 0) {
      encryptedPass = encrypt(password.trim());
    }

    db.prepare(`
      UPDATE credentials
      SET 
        name = ?,
        host = ?,
        port = ?,
        secure = ?,
        user = ?,
        password_encrypted = ?,
        from_name = ?,
        from_email = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : existing.name,
      host !== undefined ? host.trim() : existing.host,
      portNum,
      isSecure,
      user !== undefined ? user.trim() : existing.user,
      encryptedPass,
      from_name !== undefined ? from_name.trim() : existing.from_name,
      from_email !== undefined ? from_email.trim() : existing.from_email,
      id
    );

    const updated = db.prepare(`
      SELECT id, name, host, port, secure, user, from_name, from_email, created_at
      FROM credentials WHERE id = ?
    `).get(id);

    res.json({ success: true, credential: updated });
  } catch (err) {
    console.error('[Credentials API] PUT error:', err);
    res.status(500).json({ error: 'Failed to update credential' });
  }
});

// DELETE /api/credentials/:id - Delete SMTP credential
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    res.json({ success: true, message: 'Credential deleted' });
  } catch (err) {
    console.error('[Credentials API] DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete credential' });
  }
});

// POST /api/credentials/test - Test SMTP connection (from form body or by existing ID)
router.post('/test', authMiddleware, async (req, res) => {
  try {
    let { id, host, port, secure, user, password } = req.body;

    // If ID provided, load and decrypt saved credentials
    if (id) {
      const cred = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
      if (!cred) {
        return res.status(404).json({ success: false, error: 'Credential not found' });
      }
      host = cred.host;
      port = cred.port;
      secure = cred.secure;
      user = cred.user;
      password = decrypt(cred.password_encrypted);
    }

    if (!host || !user || !password) {
      return res.status(400).json({
        success: false,
        error: 'Host, username, and password are required for connection test',
      });
    }

    const portNum = Number(port) || 587;
    const isSecure = (secure === true || secure === 1 || portNum === 465);

    console.log(`[SMTP Test] Verifying connection to ${host}:${portNum} (secure: ${isSecure}) for ${user}...`);

    const transporter = nodemailer.createTransport({
      host: host.trim(),
      port: portNum,
      secure: isSecure,
      auth: {
        user: user.trim(),
        pass: password,
      },
      connectionTimeout: 9000,
      greetingTimeout: 9000,
      socketTimeout: 9000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.verify();

    console.log(`[SMTP Test] Handshake successful for ${user}@${host}`);
    res.json({
      success: true,
      message: `SMTP handshake successful! Connected to ${host}:${portNum} as ${user}.`,
    });
  } catch (err) {
    console.error('[SMTP Test] Verification failed:', err.message);
    let userMsg = err.message || 'SMTP connection failed';
    if (userMsg.includes('ECONNREFUSED')) {
      userMsg = `Connection refused at ${req.body.host}:${req.body.port}. Verify host and port.`;
    } else if (userMsg.includes('ETIMEDOUT')) {
      userMsg = `Connection timed out connecting to ${req.body.host}:${req.body.port}.`;
    } else if (userMsg.includes('Invalid login') || userMsg.includes('535') || userMsg.includes('Username and Password not accepted')) {
      userMsg = 'Authentication failed. Please check username and password (or App Password).';
    }

    res.json({
      success: false,
      error: userMsg,
    });
  }
});

export default router;
