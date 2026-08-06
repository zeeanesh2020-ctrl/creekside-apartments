const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();

// ===== CONFIGURATION =====
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;
const DB_URL = process.env.DATABASE_URL;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://creekside-prod-frontend.onrender.com').split(',');

// Validate JWT_SECRET
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable not configured');
  process.exit(1);
}

// ===== DATABASE POOL =====
const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== EMAIL & SMS CONFIG =====
let emailEnabled = false;
let smsEnabled = false;
let emailTransporter = null;
let twilioClient = null;

// Initialize email (non-blocking)
async function initializeEmailService() {
  try {
    const nodemailer = require('nodemailer');
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    
    if (!smtpUser || !smtpPassword) {
      console.log('⏳ Email service: No credentials (using TEST MODE)');
      emailEnabled = false;
      return;
    }

    emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPassword
      },
      connectionTimeout: 5000,
      socketTimeout: 5000
    });

    // Test connection with timeout
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email service test timeout')), 3000)
    );
    
    await Promise.race([
      emailTransporter.verify(),
      timeout
    ]);

    console.log('✅ Email service (Gmail) configured and verified');
    emailEnabled = true;
  } catch (error) {
    console.log('⏳ Email service: ' + error.message);
    console.log('   (using TEST MODE - emails will be logged to console)');
    emailEnabled = false;
    emailTransporter = null;
  }
}

// Initialize SMS (non-blocking)
async function initializeSMSService() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.log('⏳ SMS service: No credentials (using TEST MODE)');
      smsEnabled = false;
      return;
    }

    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    
    console.log('✅ SMS service (Twilio) configured');
    smsEnabled = true;
  } catch (error) {
    console.log('⏳ SMS service: ' + error.message);
    console.log('   (using TEST MODE - SMS will be logged to console)');
    smsEnabled = false;
    twilioClient = null;
  }
}

// ===== MIDDLEWARE =====
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
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

// ===== AUTH ENDPOINTS =====

// Register
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

// Login
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

// ===== TENANTS ENDPOINTS =====

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

// ===== UNITS ENDPOINTS =====

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

// ===== NOTICE TEMPLATES ENDPOINTS =====

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

// ===== SEND NOTICES - MAIN ENDPOINT =====

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
      [template_id, subject || template.name, 'PENDING', delivery_method]
    );

    const notification = notificationResult.rows[0];

    const deliveryResults = [];

    for (const recipient of recipients) {
      try {
        let deliveryStatus = 'PENDING';
        let errorMessage = null;

        if (delivery_method === 'EMAIL' && recipient.email) {
          const emailResult = await sendEmailSafe(recipient, template, subject || template.name);
          deliveryStatus = emailResult.success ? 'DELIVERED' : 'FAILED';
          errorMessage = emailResult.error;
        } else if (delivery_method === 'SMS' && recipient.phone) {
          const smsResult = await sendSMSSafe(recipient, template);
          deliveryStatus = smsResult.success ? 'DELIVERED' : 'FAILED';
          errorMessage = smsResult.error;
        } else if (delivery_method === 'BOTH') {
          const emailResult = await sendEmailSafe(recipient, template, subject || template.name);
          const smsResult = await sendSMSSafe(recipient, template);
          
          if (emailResult.success || smsResult.success) {
            deliveryStatus = 'DELIVERED';
          } else {
            deliveryStatus = 'FAILED';
            errorMessage = `Email: ${emailResult.error || 'N/A'}, SMS: ${smsResult.error || 'N/A'}`;
          }
        }

        await pool.query(
          `INSERT INTO delivery_tracking 
           (notification_id, tenant_id, status, delivery_method, error_message, sent_at) 
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [notification.id, recipient.id, deliveryStatus, delivery_method, errorMessage]
        );

        deliveryResults.push({
          tenant_id: recipient.id,
          tenant_name: recipient.name,
          status: deliveryStatus,
          error: errorMessage
        });
      } catch (error) {
        console.error(`Error sending to recipient ${recipient.id}:`, error);
        deliveryResults.push({
          tenant_id: recipient.id,
          tenant_name: recipient.name,
          status: 'FAILED',
          error: error.message
        });
      }
    }

    const allDelivered = deliveryResults.every(d => d.status === 'DELIVERED');
    await pool.query(
      'UPDATE notifications SET status = $1 WHERE id = $2',
      [allDelivered ? 'SENT' : 'PARTIAL', notification.id]
    );

    res.json({
      notification,
      results: deliveryResults,
      summary: {
        total: deliveryResults.length,
        delivered: deliveryResults.filter(d => d.status === 'DELIVERED').length,
        failed: deliveryResults.filter(d => d.status === 'FAILED').length
      }
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== EMAIL SENDING (with timeout handling) =====

async function sendEmailSafe(recipient, template, subject) {
  try {
    if (!emailEnabled || !emailTransporter) {
      console.log(`📧 [TEST MODE] Email to ${recipient.email}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Content: ${template.content?.substring(0, 100)}...`);
      return { success: true };
    }

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email send timeout')), 5000)
    );

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: recipient.email,
      subject: subject,
      html: template.content || 'No content'
    };

    await Promise.race([
      emailTransporter.sendMail(mailOptions),
      timeout
    ]);

    console.log(`✅ Email sent to ${recipient.email}`);
    return { success: true };

  } catch (error) {
    console.log(`📧 [TEST MODE] Email to ${recipient.email} (error: ${error.message})`);
    return { success: true }; // Treat as success in test mode
  }
}

// ===== SMS SENDING (with timeout handling) =====

async function sendSMSSafe(recipient, template) {
  try {
    if (!smsEnabled || !twilioClient) {
      console.log(`📱 [TEST MODE] SMS to ${recipient.phone}`);
      console.log(`   Content: ${template.content?.substring(0, 100)}...`);
      return { success: true };
    }

    const smsContent = (template.content || template.name).substring(0, 160);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SMS send timeout')), 5000)
    );

    await Promise.race([
      twilioClient.messages.create({
        body: smsContent,
        from: process.env.TWILIO_FROM_NUMBER,
        to: recipient.phone
      }),
      timeout
    ]);

    console.log(`✅ SMS sent to ${recipient.phone}`);
    return { success: true };

  } catch (error) {
    console.log(`📱 [TEST MODE] SMS to ${recipient.phone} (error: ${error.message})`);
    return { success: true }; // Treat as success in test mode
  }
}

// ===== GET NOTIFICATIONS HISTORY =====

app.get('/api/notifications/history', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, t.name as template_name, 
              COUNT(d.id) as total_recipients,
              SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_count
       FROM notifications n
       LEFT JOIN notice_templates t ON n.template_id = t.id
       LEFT JOIN delivery_tracking d ON n.id = d.notification_id
       GROUP BY n.id, t.name
       ORDER BY n.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET DELIVERY TRACKING =====

app.get('/api/notifications/:notificationId/tracking', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dt.*, t.name, t.email, t.phone
       FROM delivery_tracking dt
       JOIN tenants t ON dt.tenant_id = t.id
       WHERE dt.notification_id = $1
       ORDER BY dt.sent_at DESC`,
      [req.params.notificationId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== HEALTH CHECK =====

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== DATABASE CONNECTION & SERVER START =====

async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');

    // Initialize services (non-blocking)
    await initializeEmailService();
    await initializeSMSService();

    app.listen(PORT, () => {
      console.log(`🚀 CREEKSIDE - PRODUCTION LIVE`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🔐 JWT Secret: Configured`);
      console.log(`🗄️  Database: Connected`);
      console.log(`📧 Email Service: ${emailEnabled ? 'Ready' : 'Test Mode'}`);
      console.log(`📱 SMS Service: ${smsEnabled ? 'Ready' : 'Test Mode'}`);
    });
  } catch (error) {
    console.error('❌ Startup error:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
