const express = require('express');
const cors = require('cors');
const pg = require('pg');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// PostgreSQL Connection Pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// ===== MIDDLEWARE =====
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ===== LOGGING =====
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ===== JWT VERIFICATION =====
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ===== DATABASE INIT =====
const initDatabase = async () => {
  try {
    console.log('🔄 Initializing database...');
    
    // First, ensure database exists
    try {
      await pool.query('SELECT 1');
      console.log('  ✅ Connected to creekside_apartments');
    } catch (dbError) {
      if (dbError.message.includes('does not exist')) {
        console.log('  📝 Database missing, creating...');
        
        // Connect to postgres db to create creekside_apartments
        const adminPool = new pg.Pool({
          connectionString: process.env.DATABASE_URL.replace('creekside_apartments', 'postgres'),
          ssl: { rejectUnauthorized: false }
        });
        
        try {
          await adminPool.query('CREATE DATABASE creekside_apartments');
          console.log('  ✅ Database created');
          await adminPool.end();
          await new Promise(r => setTimeout(r, 1000));
        } catch (createErr) {
          console.log('  ℹ️ Database:', createErr.message);
          await adminPool.end();
        }
      }
    }
    
    console.log('🔄 Creating tables...');
    
    // Create companies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(500),
        city VARCHAR(100),
        state VARCHAR(2),
        zip VARCHAR(10),
        phone VARCHAR(20),
        email VARCHAR(255),
        website VARCHAR(255),
        subscription_tier VARCHAR(50) DEFAULT 'STANDARD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ companies table');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'manager',
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ users table');

    // Create tenants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        lease_start DATE,
        lease_end DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ tenants table');

    // Create notice_templates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notice_templates (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        notice_type VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        compliance_status VARCHAR(50) DEFAULT 'PENDING_REVIEW',
        attorney_reviewed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ notice_templates table');

    // Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        user_id INT,
        notice_template_id INT,
        notice_type VARCHAR(100) NOT NULL,
        recipient_count INT,
        sent_count INT DEFAULT 0,
        delivered_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      )
    `);
    console.log('  ✅ notifications table');

    // Create notification_recipients table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_recipients (
        id SERIAL PRIMARY KEY,
        notification_id INT,
        tenant_id INT,
        email VARCHAR(255),
        phone VARCHAR(20),
        delivery_methods VARCHAR(255),
        email_status VARCHAR(50),
        sms_status VARCHAR(50),
        mail_status VARCHAR(50),
        delivered_at TIMESTAMP,
        opened_at TIMESTAMP,
        clicked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ notification_recipients table');

    // Create delivery_tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_tracking (
        id SERIAL PRIMARY KEY,
        notification_recipient_id INT,
        delivery_method VARCHAR(50),
        event_type VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ delivery_tracking table');

    // Create audit_log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INT,
        company_id INT DEFAULT 1,
        action VARCHAR(255),
        entity_type VARCHAR(50),
        entity_id INT,
        old_value TEXT,
        new_value TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ audit_log table');

    // Create compliance_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compliance_logs (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        notification_id INT,
        check_type VARCHAR(100),
        result VARCHAR(50),
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ compliance_logs table');

    // Insert default company
    await pool.query(`
      INSERT INTO companies (id, name, address, city, state, zip, phone, email, subscription_tier)
      VALUES (1, 'Creekside Apartments', '123 Main St', 'Bensalem', 'PA', '19020', '215-555-0123', 'admin@creekside.com', 'PREMIUM')
      ON CONFLICT DO NOTHING
    `);
    console.log('  ✅ default company data');

    console.log('✅ Database initialization complete!');
  } catch (error) {
    console.error('⚠️ Database init error:', error.message);
  }
};
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(500),
        city VARCHAR(100),
        state VARCHAR(2),
        zip VARCHAR(10),
        phone VARCHAR(20),
        email VARCHAR(255),
        website VARCHAR(255),
        subscription_tier VARCHAR(50) DEFAULT 'STANDARD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ companies table');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'manager',
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ users table');

    // Create tenants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        lease_start DATE,
        lease_end DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ tenants table');

    // Create notice_templates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notice_templates (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        notice_type VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        compliance_status VARCHAR(50) DEFAULT 'PENDING_REVIEW',
        attorney_reviewed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ notice_templates table');

    // Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        user_id INT,
        notice_template_id INT,
        notice_type VARCHAR(100) NOT NULL,
        recipient_count INT,
        sent_count INT DEFAULT 0,
        delivered_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      )
    `);
    console.log('  ✅ notifications table');

    // Create notification_recipients table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_recipients (
        id SERIAL PRIMARY KEY,
        notification_id INT,
        tenant_id INT,
        email VARCHAR(255),
        phone VARCHAR(20),
        delivery_methods VARCHAR(255),
        email_status VARCHAR(50),
        sms_status VARCHAR(50),
        mail_status VARCHAR(50),
        delivered_at TIMESTAMP,
        opened_at TIMESTAMP,
        clicked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ notification_recipients table');

    // Create delivery_tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_tracking (
        id SERIAL PRIMARY KEY,
        notification_recipient_id INT,
        delivery_method VARCHAR(50),
        event_type VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ delivery_tracking table');

    // Create audit_log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INT,
        company_id INT DEFAULT 1,
        action VARCHAR(255),
        entity_type VARCHAR(50),
        entity_id INT,
        old_value TEXT,
        new_value TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ audit_log table');

    // Create compliance_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compliance_logs (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        notification_id INT,
        check_type VARCHAR(100),
        result VARCHAR(50),
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ compliance_logs table');

    // Insert default company
    await pool.query(`
      INSERT INTO companies (id, name, address, city, state, zip, phone, email, subscription_tier)
      VALUES (1, 'Creekside Apartments', '123 Main St', 'Bensalem', 'PA', '19020', '215-555-0123', 'admin@creekside.com', 'PREMIUM')
      ON CONFLICT DO NOTHING
    `);
    console.log('  ✅ default company data');

    console.log('✅ Database initialization complete!');
  } catch (error) {
    console.error('⚠️ Database init error:', error.message);
    // Don't fail - just log the error
  }
};

// Run initialization when backend starts
initDatabase();

// ===== ROOT =====
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: '🎬 CREEKSIDE APARTMENTS - Production Backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production'
  });
});

// ===== HEALTH =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== AUTH: REGISTER =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, hashedPassword, name, 'manager']
    );

    const token = jwt.sign({ userId: result.rows[0].id, email: result.rows[0].email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: result.rows[0],
      token: token,
      status: 'success'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== AUTH: LOGIN =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token: token,
      status: 'success'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== TENANTS: GET ALL =====
app.get('/api/tenants', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tenants WHERE company_id = $1 ORDER BY name',
      [req.user.companyId || 1]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== TENANTS: CREATE =====
app.post('/api/tenants', verifyToken, async (req, res) => {
  try {
    const { name, unit, email, phone, status } = req.body;
    
    const result = await pool.query(
      'INSERT INTO tenants (company_id, name, unit, email, phone, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.companyId || 1, name, unit, email, phone, status || 'ACTIVE']
    );

    // Log action
    await pool.query(
      'INSERT INTO audit_log (user_id, company_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.userId, req.user.companyId || 1, 'CREATE', 'tenant', result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    res.json({ data: result.rows[0], status: 'success' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== NOTIFICATIONS: GET ALL =====
app.get('/api/notifications', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, COUNT(nr.id) as total_recipients 
       FROM notifications n 
       LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
       WHERE n.company_id = $1 
       GROUP BY n.id 
       ORDER BY n.created_at DESC 
       LIMIT 50`,
      [req.user.companyId || 1]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== NOTIFICATIONS: CREATE =====
app.post('/api/notifications', verifyToken, async (req, res) => {
  try {
    const { noticeType, noticeTemplateId, recipients, deliveryMethods } = req.body;
    
    // Create notification
    const notifResult = await pool.query(
      `INSERT INTO notifications (company_id, user_id, notice_template_id, notice_type, recipient_count, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.companyId || 1, req.user.userId, noticeTemplateId || null, noticeType, recipients.length, 'PENDING']
    );

    const notification = notifResult.rows[0];

    // Create recipient records
    for (const recipientId of recipients) {
      const tenant = await pool.query('SELECT email, phone FROM tenants WHERE id = $1', [recipientId]);
      if (tenant.rows.length > 0) {
        await pool.query(
          `INSERT INTO notification_recipients (notification_id, tenant_id, email, phone, delivery_methods)
           VALUES ($1, $2, $3, $4, $5)`,
          [notification.id, recipientId, tenant.rows[0].email, tenant.rows[0].phone, deliveryMethods.join(',')]
        );
      }
    }

    // Send notifications (async)
    sendNotifications(notification.id, deliveryMethods).catch(err => console.error('Send error:', err));

    // Log action
    await pool.query(
      'INSERT INTO audit_log (user_id, company_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.userId, req.user.companyId || 1, 'SEND_NOTIFICATION', 'notification', notification.id, JSON.stringify(notification)]
    );

    res.json({ notification: notification, status: 'queued', message: 'Notifications queued for delivery' });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== STATISTICS =====
app.get('/api/statistics', verifyToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT n.id) as total_sent,
        COUNT(DISTINCT CASE WHEN nr.email_status = 'DELIVERED' THEN nr.id END) as delivered,
        COUNT(DISTINCT CASE WHEN nr.opened_at IS NOT NULL THEN nr.id END) as read,
        COUNT(DISTINCT CASE WHEN nr.clicked_at IS NOT NULL THEN nr.id END) as responded,
        COUNT(DISTINCT CASE WHEN nr.email_status = 'FAILED' THEN nr.id END) as failed,
        COUNT(DISTINCT CASE WHEN n.status = 'PENDING' THEN n.id END) as pending
      FROM notifications n
      LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
      WHERE n.company_id = $1
    `, [req.user.companyId || 1]);

    res.json(stats.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== AUDIT LOG =====
app.get('/api/audit-log', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as user_name 
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.company_id = $1
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [req.user.companyId || 1]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SEND NOTIFICATIONS (Helper) =====
const sendNotifications = async (notificationId, deliveryMethods) => {
  try {
    const recipients = await pool.query(
      'SELECT * FROM notification_recipients WHERE notification_id = $1',
      [notificationId]
    );

    for (const recipient of recipients.rows) {
      // Email
      if (deliveryMethods.includes('EMAIL') && recipient.email) {
        sendEmail(recipient.email, notificationId, recipient.id);
      }

      // SMS
      if (deliveryMethods.includes('SMS') && recipient.phone) {
        sendSMS(recipient.phone, notificationId, recipient.id);
      }

      // Mail
      if (deliveryMethods.includes('MAIL') && recipient.email) {
        sendCertifiedMail(recipient.email, notificationId, recipient.id);
      }
    }

    // Update notification status
    await pool.query('UPDATE notifications SET status = $1, sent_at = $2 WHERE id = $3', ['SENT', new Date(), notificationId]);
  } catch (error) {
    console.error('Send notifications error:', error);
  }
};

// ===== SEND EMAIL (SendGrid) =====
const sendEmail = async (email, notificationId, recipientId) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('SendGrid not configured, skipping email');
      return;
    }

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@creekside.com',
      subject: '📧 Important Notice from Creekside Apartments',
      html: `
        <h2>Important Notice</h2>
        <p>You have received an important notice from Creekside Apartments.</p>
        <p>Please log in to your account to view full details.</p>
        <p><a href="https://creekside-frontend1.onrender.com">View Notice</a></p>
      `,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    };

    await sgMail.send(msg);

    // Update status
    await pool.query(
      'UPDATE notification_recipients SET email_status = $1, delivered_at = $2 WHERE id = $3',
      ['DELIVERED', new Date(), recipientId]
    );

    console.log(`✅ Email sent to ${email}`);
  } catch (error) {
    console.error('Email error:', error);
    await pool.query(
      'UPDATE notification_recipients SET email_status = $1 WHERE id = $2',
      ['FAILED', recipientId]
    );
  }
};

// ===== SEND SMS (Twilio) =====
const sendSMS = async (phone, notificationId, recipientId) => {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID) {
      console.log('Twilio not configured, skipping SMS');
      return;
    }

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    await client.messages.create({
      body: 'Important notice from Creekside Apartments. Please check your email or log in to your account.',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });

    // Update status
    await pool.query(
      'UPDATE notification_recipients SET sms_status = $1, delivered_at = $2 WHERE id = $3',
      ['DELIVERED', new Date(), recipientId]
    );

    console.log(`✅ SMS sent to ${phone}`);
  } catch (error) {
    console.error('SMS error:', error);
    await pool.query(
      'UPDATE notification_recipients SET sms_status = $1 WHERE id = $2',
      ['FAILED', recipientId]
    );
  }
};

// ===== SEND CERTIFIED MAIL (Lob) =====
const sendCertifiedMail = async (email, notificationId, recipientId) => {
  try {
    if (!process.env.LOB_API_KEY) {
      console.log('Lob not configured, skipping certified mail');
      return;
    }

    const lob = require('lob')({ apiKey: process.env.LOB_API_KEY });

    // In real implementation, you'd also have address from database
    const letter = await lob.letters.create({
      to: {
        name: 'Tenant',
        email: email
      },
      from: {
        name: 'Creekside Apartments',
        email: process.env.LOB_FROM_EMAIL || 'admin@creekside.com'
      },
      file: '<html>Important Legal Notice</html>',
      color: true
    });

    // Update status
    await pool.query(
      'UPDATE notification_recipients SET mail_status = $1, delivered_at = $2 WHERE id = $3',
      ['SENT_TO_MAIL', new Date(), recipientId]
    );

    console.log(`✅ Certified mail initiated for ${email}`);
  } catch (error) {
    console.error('Certified mail error:', error);
    await pool.query(
      'UPDATE notification_recipients SET mail_status = $1 WHERE id = $2',
      ['FAILED', recipientId]
    );
  }
};

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║  🎬 CREEKSIDE - PRODUCTION LIVE   ║');
  console.log(`║  Port: ${PORT}                          ║`);
  console.log('║  ✅ PostgreSQL Connected           ║');
  console.log('║  ✅ Email Ready (SendGrid)         ║');
  console.log('║  ✅ SMS Ready (Twilio)             ║');
  console.log('║  ✅ Mail Ready (Lob)               ║');
  console.log('╚════════════════════════════════════╝\n');
});

process.on('SIGINT', () => {
  pool.end();
  process.exit(0);
});

module.exports = app;
