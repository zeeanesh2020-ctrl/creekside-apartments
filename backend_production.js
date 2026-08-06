const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;
const DB_URL = process.env.DATABASE_URL;

// ===== LOGGING SYSTEM =====
class Logger {
  constructor() {
    this.logsDir = '/tmp/creekside-logs';
    this.ensureLogsDir();
    this.logLevels = {
      ERROR: 'ERROR',
      WARN: 'WARN',
      INFO: 'INFO',
      DEBUG: 'DEBUG',
      SUCCESS: 'SUCCESS'
    };
  }

  ensureLogsDir() {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create logs directory:', err);
    }
  }

  getLogFile(type) {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `${type}-${date}.log`);
  }

  write(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data,
      environment: process.env.NODE_ENV || 'production'
    };

    const logString = JSON.stringify(logEntry);

    // Console output with colors
    const colors = {
      ERROR: '\x1b[31m',    // Red
      WARN: '\x1b[33m',     // Yellow
      INFO: '\x1b[36m',     // Cyan
      DEBUG: '\x1b[35m',    // Magenta
      SUCCESS: '\x1b[32m'   // Green
    };
    const reset = '\x1b[0m';

    console.log(`${colors[level] || ''}[${level}] ${message}${reset}`, data);

    // File logging
    try {
      const file = this.getLogFile(level.toLowerCase());
      fs.appendFileSync(file, logString + '\n', { encoding: 'utf8' });
    } catch (err) {
      console.error('Failed to write log:', err);
    }
  }

  error(message, error, data = {}) {
    this.write('ERROR', message, {
      error: error?.message || error,
      stack: error?.stack,
      ...data
    });
  }

  warn(message, data = {}) {
    this.write('WARN', message, data);
  }

  info(message, data = {}) {
    this.write('INFO', message, data);
  }

  debug(message, data = {}) {
    this.write('DEBUG', message, data);
  }

  success(message, data = {}) {
    this.write('SUCCESS', message, data);
  }
}

const logger = new Logger();

// ===== VALIDATION =====
if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET not configured', new Error('Missing JWT_SECRET'));
  process.exit(1);
}

if (!DB_URL) {
  logger.error('FATAL: DATABASE_URL not configured', new Error('Missing DATABASE_URL'));
  process.exit(1);
}

// ===== DATABASE POOL =====
const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', err, { 
    code: err.code,
    severity: err.severity 
  });
});

pool.on('connect', () => {
  logger.debug('New database connection created');
});

// ===== EMAIL SERVICE =====
class EmailService {
  constructor() {
    this.enabled = false;
    this.transporter = null;
    this.initialize();
  }

  initialize() {
    try {
      const smtpUser = process.env.SMTP_USER;
      const smtpPassword = process.env.SMTP_PASSWORD;

      if (!smtpUser || !smtpPassword) {
        logger.warn('Email service: No credentials provided', { 
          hasUser: !!smtpUser,
          hasPassword: !!smtpPassword
        });
        return;
      }

      const nodemailer = require('nodemailer');

      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPassword
        },
        connectionTimeout: 5000,
        socketTimeout: 5000,
        maxConnections: 3,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 10
      });

      // Verify immediately with timeout
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email verification timeout')), 3000)
      );

      Promise.race([this.transporter.verify(), timeout])
        .then(() => {
          this.enabled = true;
          logger.success('Email service initialized', { 
            user: smtpUser,
            provider: 'Gmail'
          });
        })
        .catch((err) => {
          logger.warn('Email service verification failed', { 
            error: err.message,
            user: smtpUser
          });
          this.transporter = null;
        });

    } catch (error) {
      logger.error('Email service initialization failed', error, {
        step: 'setup'
      });
    }
  }

  async send(to, subject, html) {
    return new Promise((resolve) => {
      // If not enabled, simulate
      if (!this.enabled || !this.transporter) {
        logger.debug('Email sent in TEST MODE', { 
          to,
          subject,
          mode: 'TEST'
        });
        resolve({ success: true, mode: 'TEST' });
        return;
      }

      // Timeout protection
      const timeout = setTimeout(() => {
        logger.warn('Email send timeout', { to, subject });
        resolve({ success: false, error: 'Email send timeout after 5 seconds' });
      }, 5000);

      this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject,
        html
      }, (err, info) => {
        clearTimeout(timeout);

        if (err) {
          logger.error('Email send failed', err, { 
            to,
            subject,
            errorCode: err.code
          });
          resolve({ success: false, error: err.message });
        } else {
          logger.success('Email sent successfully', { 
            to,
            subject,
            messageId: info.messageId,
            response: info.response
          });
          resolve({ success: true, messageId: info.messageId });
        }
      });
    });
  }
}

// ===== SMS SERVICE =====
class SMSService {
  constructor() {
    this.enabled = false;
    this.client = null;
    this.initialize();
  }

  initialize() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        logger.warn('SMS service: Missing credentials', {
          hasAccountSid: !!accountSid,
          hasAuthToken: !!authToken,
          hasFromNumber: !!fromNumber
        });
        return;
      }

      try {
        const twilio = require('twilio');
        this.client = twilio(accountSid, authToken);
        this.fromNumber = fromNumber;
        this.enabled = true;

        logger.success('SMS service initialized', {
          provider: 'Twilio',
          fromNumber
        });
      } catch (err) {
        logger.error('Failed to initialize Twilio client', err);
      }
    } catch (error) {
      logger.error('SMS service initialization failed', error);
    }
  }

  async send(to, body) {
    return new Promise((resolve) => {
      // If not enabled, simulate
      if (!this.enabled || !this.client) {
        logger.debug('SMS sent in TEST MODE', { 
          to,
          body: body.substring(0, 50),
          mode: 'TEST'
        });
        resolve({ success: true, mode: 'TEST' });
        return;
      }

      // Timeout protection
      const timeout = setTimeout(() => {
        logger.warn('SMS send timeout', { to });
        resolve({ success: false, error: 'SMS send timeout after 5 seconds' });
      }, 5000);

      this.client.messages.create({
        body: body.substring(0, 160),
        from: this.fromNumber,
        to
      })
        .then((message) => {
          clearTimeout(timeout);
          logger.success('SMS sent successfully', {
            to,
            messageSid: message.sid,
            status: message.status
          });
          resolve({ success: true, messageSid: message.sid });
        })
        .catch((error) => {
          clearTimeout(timeout);
          logger.error('SMS send failed', error, { 
            to,
            errorCode: error.code
          });
          resolve({ success: false, error: error.message });
        });
    });
  }
}

// Initialize services
const emailService = new EmailService();
const smsService = new SMSService();

// ===== MIDDLEWARE =====
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    logger.info(`${req.method} ${req.path}`, {
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')?.substring(0, 50)
    });

    return originalSend.call(this, data);
  };

  next();
});

// CORS Middleware
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
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      logger.warn('Token missing', { path: req.path });
      return res.status(401).json({ error: 'No token provided' });
    }

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    logger.warn('Token verification failed', { 
      path: req.path,
      error: error.message 
    });
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err, {
    path: req.path,
    method: req.method
  });
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// ===== HEALTH CHECK =====
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await Promise.race([
      pool.query('SELECT NOW()'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 2000))
    ]);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        email: emailService.enabled ? 'ready' : 'test-mode',
        sms: smsService.enabled ? 'ready' : 'test-mode'
      }
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'error',
      error: error.message
    });
  }
});

// ===== AUTH ENDPOINTS =====

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      logger.warn('Register validation failed', { 
        hasName: !!name,
        hasEmail: !!email,
        hasPassword: !!password
      });
      return res.status(400).json({ error: 'Name, email, and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      logger.warn('Register failed: email already exists', { email });
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    logger.success('User registered', { 
      userId: user.id,
      email: user.email 
    });

    res.status(201).json({ token, user });
  } catch (error) {
    logger.error('Register endpoint error', error);
    res.status(500).json({ error: 'Registration failed' });
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
      logger.warn('Login failed: user not found', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcryptjs.compare(password, user.password);
    if (!validPassword) {
      logger.warn('Login failed: invalid password', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    logger.success('User logged in', { 
      userId: user.id,
      email: user.email 
    });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    logger.error('Login endpoint error', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ===== TENANTS =====

app.get('/api/tenants', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenants ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    logger.error('Get tenants failed', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

app.post('/api/tenants', verifyToken, async (req, res) => {
  try {
    const { name, unit, email, phone } = req.body;

    if (!name || !unit) {
      return res.status(400).json({ error: 'Name and unit required' });
    }

    const result = await pool.query(
      'INSERT INTO tenants (name, unit, email, phone, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [name, unit, email || null, phone || null]
    );

    logger.success('Tenant created', { 
      tenantId: result.rows[0].id,
      name,
      unit 
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create tenant failed', error, { 
      name: req.body.name,
      unit: req.body.unit 
    });
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

app.delete('/api/tenants/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
    logger.success('Tenant deleted', { tenantId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete tenant failed', error, { tenantId: req.params.id });
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// ===== UNITS =====

app.get('/api/units', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM units ORDER BY unit_number');
    res.json(result.rows);
  } catch (error) {
    logger.error('Get units failed', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

app.post('/api/units', verifyToken, async (req, res) => {
  try {
    const { unit_number, status } = req.body;

    if (!unit_number) {
      return res.status(400).json({ error: 'Unit number required' });
    }

    const result = await pool.query(
      'INSERT INTO units (unit_number, status, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [unit_number, status || 'VACANT']
    );

    logger.success('Unit created', { 
      unitId: result.rows[0].id,
      unitNumber: unit_number 
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create unit failed', error, { unitNumber: req.body.unit_number });
    res.status(500).json({ error: 'Failed to create unit' });
  }
});

app.delete('/api/units/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM units WHERE id = $1', [req.params.id]);
    logger.success('Unit deleted', { unitId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete unit failed', error, { unitId: req.params.id });
    res.status(500).json({ error: 'Failed to delete unit' });
  }
});

// ===== NOTICE TEMPLATES =====

app.get('/api/notice-templates', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notice_templates ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    logger.error('Get templates failed', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

app.post('/api/notice-templates', verifyToken, async (req, res) => {
  try {
    const { name, notice_type, content } = req.body;

    if (!name || !notice_type || !content) {
      return res.status(400).json({ error: 'Name, type, and content required' });
    }

    const result = await pool.query(
      'INSERT INTO notice_templates (name, notice_type, content, compliance_status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [name, notice_type, content, 'APPROVED']
    );

    logger.success('Template created', { 
      templateId: result.rows[0].id,
      name,
      type: notice_type 
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create template failed', error, { name: req.body.name });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ===== SEND NOTICES =====

app.post('/api/notifications/send', verifyToken, async (req, res) => {
  try {
    const { template_id, recipient_ids, delivery_method, subject } = req.body;

    if (!template_id || !recipient_ids || !delivery_method) {
      logger.warn('Send notification validation failed', {
        hasTemplateId: !!template_id,
        hasRecipients: !!recipient_ids,
        hasMethod: !!delivery_method
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const templateResult = await pool.query(
      'SELECT * FROM notice_templates WHERE id = $1',
      [template_id]
    );

    if (templateResult.rows.length === 0) {
      logger.warn('Template not found', { templateId: template_id });
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    const recipientResult = await pool.query(
      'SELECT * FROM tenants WHERE id = ANY($1::int[])',
      [recipient_ids]
    );

    if (recipientResult.rows.length === 0) {
      logger.warn('No recipients found', { recipientIds: recipient_ids });
      return res.status(404).json({ error: 'No recipients found' });
    }

    const recipients = recipientResult.rows;
    const finalSubject = subject || template.name;

    const notificationResult = await pool.query(
      `INSERT INTO notifications 
       (template_id, subject, sent_at, status, delivery_method, created_at) 
       VALUES ($1, $2, NOW(), $3, $4, NOW()) 
       RETURNING *`,
      [template_id, finalSubject, 'PENDING', delivery_method]
    );

    const notification = notificationResult.rows[0];
    const deliveryResults = [];

    logger.info('Starting notification send', {
      notificationId: notification.id,
      templateId: template_id,
      recipientCount: recipients.length,
      method: delivery_method
    });

    for (const recipient of recipients) {
      try {
        let deliveryStatus = 'FAILED';
        let errorMessage = null;

        if (delivery_method === 'EMAIL' && recipient.email) {
          const emailResult = await emailService.send(recipient.email, finalSubject, template.content);
          if (emailResult.success) {
            deliveryStatus = 'DELIVERED';
          } else {
            errorMessage = emailResult.error;
          }
        } else if (delivery_method === 'SMS' && recipient.phone) {
          const smsResult = await smsService.send(recipient.phone, template.content || template.name);
          if (smsResult.success) {
            deliveryStatus = 'DELIVERED';
          } else {
            errorMessage = smsResult.error;
          }
        } else if (delivery_method === 'BOTH') {
          const results = await Promise.all([
            recipient.email ? emailService.send(recipient.email, finalSubject, template.content) : { success: false },
            recipient.phone ? smsService.send(recipient.phone, template.content || template.name) : { success: false }
          ]);

          if (results.some(r => r.success)) {
            deliveryStatus = 'DELIVERED';
          } else {
            errorMessage = `Email: ${results[0]?.error || 'no-email'}, SMS: ${results[1]?.error || 'no-sms'}`;
          }
        } else {
          errorMessage = 'No valid contact info for delivery method';
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

        logger.info('Notification delivery tracked', {
          notificationId: notification.id,
          tenantId: recipient.id,
          status: deliveryStatus
        });

      } catch (error) {
        logger.error('Error delivering to recipient', error, {
          notificationId: notification.id,
          tenantId: recipient.id,
          tenantName: recipient.name
        });

        deliveryResults.push({
          tenant_id: recipient.id,
          tenant_name: recipient.name,
          status: 'FAILED',
          error: error.message
        });
      }
    }

    const successCount = deliveryResults.filter(d => d.status === 'DELIVERED').length;
    const finalStatus = successCount === deliveryResults.length ? 'SENT' : 'PARTIAL';

    await pool.query(
      'UPDATE notifications SET status = $1 WHERE id = $2',
      [finalStatus, notification.id]
    );

    logger.success('Notification send completed', {
      notificationId: notification.id,
      status: finalStatus,
      total: deliveryResults.length,
      delivered: successCount,
      failed: deliveryResults.length - successCount
    });

    res.json({
      notification,
      results: deliveryResults,
      summary: {
        total: deliveryResults.length,
        delivered: successCount,
        failed: deliveryResults.length - successCount
      }
    });

  } catch (error) {
    logger.error('Send notification endpoint error', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

app.get('/api/notifications/history', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, t.name as template_name 
       FROM notifications n
       LEFT JOIN notice_templates t ON n.template_id = t.id
       ORDER BY n.created_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Get notification history failed', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

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
    logger.error('Get delivery tracking failed', error, {
      notificationId: req.params.notificationId
    });
    res.status(500).json({ error: 'Failed to fetch tracking' });
  }
});

// ===== LOG VIEWER ENDPOINT =====
app.get('/api/logs/:type', verifyToken, async (req, res) => {
  try {
    const type = req.params.type.toLowerCase();
    const validTypes = ['error', 'warn', 'info', 'debug', 'success'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid log type' });
    }

    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join('/tmp/creekside-logs', `${type}-${date}.log`);

    if (!fs.existsSync(logFile)) {
      return res.json({ logs: [], message: 'No logs found for this date' });
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const logs = content.split('\n').filter(line => line.trim()).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });

    res.json({ 
      logs: logs.reverse().slice(0, 100),
      type,
      date,
      total: logs.length 
    });
  } catch (error) {
    logger.error('Get logs endpoint failed', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ===== START SERVER =====

async function startServer() {
  try {
    // Test database connection
    await Promise.race([
      pool.query('SELECT NOW()'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB connection timeout')), 5000))
    ]);

    logger.success('Database connection established');

    app.listen(PORT, () => {
      logger.success('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'production',
        logDirectory: '/tmp/creekside-logs'
      });

      console.log('\n╔════════════════════════════════════════════════════════╗');
      console.log('║  🚀 CREEKSIDE APARTMENTS - PRODUCTION LIVE 🚀          ║');
      console.log('╠════════════════════════════════════════════════════════╣');
      console.log(`║  📍 Port: ${PORT}${' '.repeat(42 - PORT.toString().length)}║`);
      console.log(`║  📧 Email: ${emailService.enabled ? 'Ready' : 'Test Mode'}${' '.repeat(42 - (emailService.enabled ? 5 : 9))}║`);
      console.log(`║  📱 SMS: ${smsService.enabled ? 'Ready' : 'Test Mode'}${' '.repeat(44 - (smsService.enabled ? 5 : 9))}║`);
      console.log('║  📝 Logging: Enabled                                   ║');
      console.log('║  🔐 Security: JWT + CORS                               ║');
      console.log('╚════════════════════════════════════════════════════════╝\n');
    });

  } catch (error) {
    logger.error('FATAL: Server startup failed', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    logger.info('Database pool closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection detected', new Error(String(reason)), {
    promise: String(promise)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception detected', error);
  process.exit(1);
});

startServer();
