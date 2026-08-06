const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;
const DB_URL = process.env.DATABASE_URL;

if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET not configured');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== MIDDLEWARE =====
app.use(express.json());

// 🔧 SIMPLIFIED CORS - Allow all origins
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ===== HEALTH CHECK (No auth needed) =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running!' });
});

// ===== AUTH ENDPOINTS =====

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcryptjs.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== TENANTS =====

app.get('/api/tenants', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenants ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenants', verifyToken, async (req, res) => {
  try {
    const { name, unit, email, phone } = req.body;
    const result = await pool.query(
      'INSERT INTO tenants (name, unit, email, phone, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [name, unit, email, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tenants/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== UNITS =====

app.get('/api/units', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM units ORDER BY unit_number');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/units', verifyToken, async (req, res) => {
  try {
    const { unit_number, status } = req.body;
    const result = await pool.query(
      'INSERT INTO units (unit_number, status, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [unit_number, status || 'VACANT']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/units/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM units WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== NOTICE TEMPLATES =====

app.get('/api/notice-templates', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notice_templates ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notice-templates', verifyToken, async (req, res) => {
  try {
    const { name, notice_type, content } = req.body;
    const result = await pool.query(
      'INSERT INTO notice_templates (name, notice_type, content, compliance_status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [name, notice_type, content, 'APPROVED']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SEND NOTICES =====

app.post('/api/notifications/send', verifyToken, async (req, res) => {
  try {
    const { template_id, recipient_ids, delivery_method, subject } = req.body;

    if (!template_id || !recipient_ids || !delivery_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const templateResult = await pool.query(
      'SELECT * FROM notice_templates WHERE id = $1',
      [template_id]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    const recipientResult = await pool.query(
      'SELECT * FROM tenants WHERE id = ANY($1::int[])',
      [recipient_ids]
    );

    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'No recipients found' });
    }

    const recipients = recipientResult.rows;

    const notificationResult = await pool.query(
      `INSERT INTO notifications 
       (template_id, subject, sent_at, status, delivery_method, created_at) 
       VALUES ($1, $2, NOW(), $3, $4, NOW()) 
       RETURNING *`,
      [template_id, subject || template.name, 'SENT', delivery_method]
    );

    const notification = notificationResult.rows[0];

    const deliveryResults = [];

    for (const recipient of recipients) {
      try {
        let deliveryStatus = 'DELIVERED';

        if (delivery_method === 'EMAIL' && recipient.email) {
          console.log(`📧 [TEST MODE] Email to ${recipient.email} - Subject: ${subject || template.name}`);
        } else if (delivery_method === 'SMS' && recipient.phone) {
          console.log(`📱 [TEST MODE] SMS to ${recipient.phone}`);
        } else if (delivery_method === 'BOTH') {
          if (recipient.email) console.log(`📧 [TEST MODE] Email to ${recipient.email}`);
          if (recipient.phone) console.log(`📱 [TEST MODE] SMS to ${recipient.phone}`);
        }

        await pool.query(
          `INSERT INTO delivery_tracking 
           (notification_id, tenant_id, status, delivery_method, sent_at) 
           VALUES ($1, $2, $3, $4, NOW())`,
          [notification.id, recipient.id, deliveryStatus, delivery_method]
        );

        deliveryResults.push({
          tenant_id: recipient.id,
          tenant_name: recipient.name,
          status: deliveryStatus
        });
      } catch (error) {
        console.error(`Error tracking delivery for ${recipient.id}:`, error);
      }
    }

    res.json({
      notification,
      results: deliveryResults,
      summary: {
        total: deliveryResults.length,
        delivered: deliveryResults.length,
        failed: 0
      }
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notifications/history', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, t.name as template_name 
       FROM notifications n
       LEFT JOIN notice_templates t ON n.template_id = t.id
       ORDER BY n.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notifications/:notificationId/tracking', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dt.*, t.name, t.email, t.phone
       FROM delivery_tracking dt
       JOIN tenants t ON dt.tenant_id = t.id
       WHERE dt.notification_id = $1`,
      [req.params.notificationId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== START SERVER =====

async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
    console.log('✅ CORS enabled for all origins');

    app.listen(PORT, () => {
      console.log(`🚀 CREEKSIDE - PRODUCTION LIVE`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🔐 JWT Secret: Configured`);
      console.log(`🗄️  Database: Connected`);
      console.log(`🌐 CORS: Enabled (all origins)`);
      console.log(`📧 Email Service: Test Mode`);
      console.log(`📱 SMS Service: Test Mode`);
    });
  } catch (error) {
    console.error('❌ Startup error:', error);
    process.exit(1);
  }
}

startServer();
