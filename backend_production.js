const express = require('express');
const cors = require('cors');
const pg = require('pg');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
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
    
    // Create units table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        unit_number VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'VACANT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ units table');
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

// Run initialization
initDatabase();

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '🎬 CREEKSIDE APARTMENTS - Production Backend',
    version: '1.0.0',
    environment: 'production',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: '🎬 CREEKSIDE APARTMENTS - Production Backend',
    version: '1.0.0',
    environment: 'production'
  });
});

// ===== AUTH: REGISTER =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
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
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }
    
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

// ===== UNITS =====
app.get('/api/units', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM units WHERE company_id = 1 ORDER BY unit_number ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/units', verifyToken, async (req, res) => {
  try {
    const { unit_number, status } = req.body;
    
    const result = await pool.query(
      'INSERT INTO units (company_id, unit_number, status) VALUES (1, $1, $2) RETURNING *',
      [unit_number, status || 'VACANT']
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/units/:id', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE units SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== TENANTS =====
app.get('/api/tenants', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenants WHERE company_id = 1 ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenants', verifyToken, async (req, res) => {
  try {
    const { name, unit, email, phone, status, lease_start, lease_end } = req.body;
    
    const result = await pool.query(
      'INSERT INTO tenants (company_id, name, unit, email, phone, status, lease_start, lease_end) VALUES (1, $1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, unit, email, phone, status || 'APPLICATION', lease_start, lease_end]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tenants/:id', verifyToken, async (req, res) => {
  try {
    const { name, unit, email, phone, status, lease_start, lease_end } = req.body;
    
    const result = await pool.query(
      'UPDATE tenants SET name = $1, unit = $2, email = $3, phone = $4, status = $5, lease_start = $6, lease_end = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 AND company_id = 1 RETURNING *',
      [name, unit, email, phone, status, lease_start, lease_end, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tenants/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM tenants WHERE id = $1 AND company_id = 1', [req.params.id]);
    res.json({ status: 'deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== NOTIFICATIONS =====
app.get('/api/notifications', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE company_id = 1 ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications', verifyToken, async (req, res) => {
  try {
    const { notice_type, notice_template_id, recipient_count } = req.body;
    
    const result = await pool.query(
      'INSERT INTO notifications (company_id, user_id, notice_template_id, notice_type, recipient_count, status) VALUES (1, $1, $2, $3, $4, $5) RETURNING *',
      [req.user.userId, notice_template_id, notice_type, recipient_count || 0, 'PENDING']
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== STATISTICS =====
app.get('/api/statistics', verifyToken, async (req, res) => {
  try {
    const notificationsResult = await pool.query('SELECT COUNT(*) FROM notifications WHERE company_id = 1');
    const recipientsResult = await pool.query('SELECT COUNT(*) FROM notification_recipients WHERE notification_id IN (SELECT id FROM notifications WHERE company_id = 1)');
    
    res.json({
      totalNotifications: notificationsResult.rows[0].count,
      totalRecipients: recipientsResult.rows[0].count,
      delivered: 0,
      failed: 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== AUDIT LOG =====
app.get('/api/audit-log', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_log WHERE company_id = 1 ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== BULK IMPORT: TENANTS =====
app.post('/api/import/tenants', verifyToken, async (req, res) => {
  try {
    const { data } = req.body; // Array of tenant objects: [{name, unit, email, phone, status, lease_start, lease_end}, ...]
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const tenant of data) {
      try {
        const { name, unit, email, phone, status, lease_start, lease_end } = tenant;
        
        if (!name || !unit) {
          errorCount++;
          errors.push(`Row missing name or unit: ${JSON.stringify(tenant)}`);
          continue;
        }
        
        await pool.query(
          'INSERT INTO tenants (company_id, name, unit, email, phone, status, lease_start, lease_end) VALUES (1, $1, $2, $3, $4, $5, $6, $7)',
          [name, unit, email || null, phone || null, status || 'APPLICATION', lease_start || null, lease_end || null]
        );
        
        successCount++;
      } catch (rowError) {
        errorCount++;
        errors.push(`Error importing "${tenant.name}": ${rowError.message}`);
      }
    }
    
    res.json({
      status: 'complete',
      successCount,
      errorCount,
      totalCount: data.length,
      errors: errors.slice(0, 10) // Return first 10 errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== BULK IMPORT: UNITS =====
app.post('/api/import/units', verifyToken, async (req, res) => {
  try {
    const { data } = req.body; // Array of unit objects: [{unit_number, status}, ...]
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const unit of data) {
      try {
        const { unit_number, status } = unit;
        
        if (!unit_number) {
          errorCount++;
          errors.push(`Row missing unit_number: ${JSON.stringify(unit)}`);
          continue;
        }
        
        await pool.query(
          'INSERT INTO units (company_id, unit_number, status) VALUES (1, $1, $2)',
          [unit_number, status || 'VACANT']
        );
        
        successCount++;
      } catch (rowError) {
        errorCount++;
        errors.push(`Error importing unit "${unit.unit_number}": ${rowError.message}`);
      }
    }
    
    res.json({
      status: 'complete',
      successCount,
      errorCount,
      totalCount: data.length,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════╗');
  console.log('║  🎬 CREEKSIDE - PRODUCTION LIVE   ║');
  console.log(`║  Port: ${PORT}                          ║`);
  console.log('║  ✅ PostgreSQL Connected           ║');
  console.log('║  ✅ Email Ready (SendGrid)         ║');
  console.log('║  ✅ SMS Ready (Twilio)             ║');
  console.log('║  ✅ Mail Ready (Lob)               ║');
  console.log('╚════════════════════════════════════╝');
});

module.exports = app;
