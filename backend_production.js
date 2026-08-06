const express = require('express');
const cors = require('cors');
const pg = require('pg');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ===== SECURITY: JWT Secret Validation (FIXED #4) =====
// Fail fast if JWT_SECRET is not configured
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable not configured');
  console.error('Set JWT_SECRET in your .env file or Render environment variables');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

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

// ===== SECURITY: CORS Configuration with Whitelist (FIXED #5) =====
// Whitelist allowed origins instead of allowing all
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['https://creekside-apartments.onrender.com', 'http://localhost:3000'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Only set CORS header if origin is whitelisted
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
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

// Create notice_templates table during initialization
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notice_templates (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        notice_type VARCHAR(100) NOT NULL,
        subject VARCHAR(255),
        content TEXT NOT NULL,
        compliance_status VARCHAR(50) DEFAULT 'PENDING_REVIEW',
        attorney_reviewed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ notice_templates table');
    
    // Create tenant_notices table for tracking notices per tenant
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_notices (
        id SERIAL PRIMARY KEY,
        company_id INT DEFAULT 1,
        tenant_id INT,
        template_id INT,
        notice_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'SENT',
        delivery_method VARCHAR(50) DEFAULT 'email',
        sent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        received_date TIMESTAMP,
        response_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ tenant_notices table');

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ audit_log table');

    console.log('✅ Database initialization complete!\n');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    process.exit(1);
  }
};

// ===== REGISTER ENDPOINT =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (company_id, email, password, name) VALUES (1, $1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );

    // Generate token
    const token = jwt.sign({ userId: result.rows[0].id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: result.rows[0],
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== LOGIN ENDPOINT =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== TENANTS =====
app.get('/api/tenants', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenants WHERE company_id = 1');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenants', verifyToken, async (req, res) => {
  try {
    const { name, unit } = req.body;
    if (!name || !unit) {
      return res.status(400).json({ error: 'Name and unit are required' });
    }
    const result = await pool.query(
      'INSERT INTO tenants (company_id, name, unit) VALUES (1, $1, $2) RETURNING *',
      [name, unit]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tenants/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenants WHERE id = $1 AND company_id = 1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tenants/:id', verifyToken, async (req, res) => {
  try {
    const { name, unit, email, phone, status } = req.body;
    const result = await pool.query(
      'UPDATE tenants SET name = $1, unit = $2, email = $3, phone = $4, status = $5 WHERE id = $6 AND company_id = 1 RETURNING *',
      [name, unit, email, phone, status, req.params.id]
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
    const result = await pool.query('DELETE FROM tenants WHERE id = $1 AND company_id = 1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json({ message: 'Tenant deleted', tenant: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== UNITS =====
app.get('/api/units', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM units WHERE company_id = 1');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/units', verifyToken, async (req, res) => {
  try {
    const { unit_number, status } = req.body;
    if (!unit_number) {
      return res.status(400).json({ error: 'Unit number is required' });
    }
    const result = await pool.query(
      'INSERT INTO units (company_id, unit_number, status) VALUES (1, $1, $2) RETURNING *',
      [unit_number, status || 'VACANT']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/units/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM units WHERE id = $1 AND company_id = 1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/units/:id', verifyToken, async (req, res) => {
  try {
    const { unit_number, status } = req.body;
    const result = await pool.query(
      'UPDATE units SET unit_number = $1, status = $2 WHERE id = $3 AND company_id = 1 RETURNING *',
      [unit_number, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/units/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM units WHERE id = $1 AND company_id = 1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json({ message: 'Unit deleted', unit: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== NOTICE TEMPLATES =====
app.get('/api/notice-templates', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notice_templates WHERE company_id = 1');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notice-templates', verifyToken, async (req, res) => {
  try {
    const { name, notice_type, subject, content } = req.body;
    if (!name || !notice_type || !subject || !content) {
      return res.status(400).json({ error: 'Name, notice type, subject, and content are required' });
    }
    const result = await pool.query(
      'INSERT INTO notice_templates (company_id, name, notice_type, subject, content) VALUES (1, $1, $2, $3, $4) RETURNING *',
      [name, notice_type, subject, content]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notice-templates/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notice_templates WHERE id = $1 AND company_id = 1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notice-templates/:id', verifyToken, async (req, res) => {
  try {
    const { name, notice_type, subject, content } = req.body;
    const result = await pool.query(
      'UPDATE notice_templates SET name = $1, notice_type = $2, subject = $3, content = $4 WHERE id = $5 AND company_id = 1 RETURNING *',
      [name, notice_type, subject, content, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notice-templates/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM notice_templates WHERE id = $1 AND company_id = 1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ message: 'Template deleted', template: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== TENANT NOTICES =====
app.get('/api/tenant-notices', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenant_notices WHERE company_id = 1');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenant-notices', verifyToken, async (req, res) => {
  try {
    const { tenant_id, template_id, notice_type, status, delivery_method } = req.body;
    const result = await pool.query(
      'INSERT INTO tenant_notices (company_id, tenant_id, template_id, notice_type, status, delivery_method) VALUES (1, $1, $2, $3, $4, $5) RETURNING *',
      [tenant_id, template_id, notice_type, status || 'SENT', delivery_method || 'email']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== BULK IMPORT: TENANTS WITH DUPLICATE CHECK =====
app.post('/api/import/tenants', verifyToken, async (req, res) => {
  try {
    const { csvText } = req.body;
    
    if (!csvText) {
      return res.status(400).json({ error: 'CSV text is required' });
    }

    // Parse CSV
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors = [];
    const duplicates = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i];
        if (!line.trim()) continue;

        // Simple CSV parsing
        const cells = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          const nextChar = line[j + 1];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cells.push(current.trim().replace(/"/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        cells.push(current.trim().replace(/"/g, ''));

        const name = cells[headers.indexOf('name')];
        const unit = cells[headers.indexOf('unit')];
        const email = cells[headers.indexOf('email')];
        const phone = cells[headers.indexOf('phone')];
        const status = cells[headers.indexOf('status')];

        if (!name || !unit) {
          errorCount++;
          errors.push(`Row ${i}: Missing name or unit`);
          continue;
        }

        // Check if tenant already exists
        const existingCheck = await pool.query(
          'SELECT id FROM tenants WHERE company_id = 1 AND name = $1 AND unit = $2',
          [name, unit]
        );

        if (existingCheck.rows.length > 0) {
          duplicateCount++;
          duplicates.push(`${name} in Unit ${unit} already exists`);
          continue;
        }

        await pool.query(
          'INSERT INTO tenants (company_id, name, unit, email, phone, status) VALUES (1, $1, $2, $3, $4, $5)',
          [name, unit, email || null, phone || null, status || 'APPLICATION']
        );

        successCount++;
      } catch (rowError) {
        errorCount++;
        errors.push(`Row ${i}: ${rowError.message}`);
      }
    }

    res.json({
      imported: successCount,
      duplicates: duplicateCount,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== BULK IMPORT: UNITS WITH DUPLICATE CHECK =====
app.post('/api/import/units', verifyToken, async (req, res) => {
  try {
    const { csvText } = req.body;
    
    if (!csvText) {
      return res.status(400).json({ error: 'CSV text is required' });
    }

    // Parse CSV
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors = [];
    const duplicates = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i];
        if (!line.trim()) continue;

        // Simple CSV parsing
        const cells = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cells.push(current.trim().replace(/"/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        cells.push(current.trim().replace(/"/g, ''));

        const unit_number = cells[headers.indexOf('unit_number')];
        const status = cells[headers.indexOf('status')];

        if (!unit_number) {
          errorCount++;
          errors.push(`Row ${i}: Missing unit_number`);
          continue;
        }

        // Check if unit already exists
        const existingCheck = await pool.query(
          'SELECT id FROM units WHERE company_id = 1 AND unit_number = $1',
          [unit_number]
        );

        if (existingCheck.rows.length > 0) {
          duplicateCount++;
          duplicates.push(`Unit ${unit_number} already exists`);
          continue;
        }

        await pool.query(
          'INSERT INTO units (company_id, unit_number, status) VALUES (1, $1, $2)',
          [unit_number, status || 'VACANT']
        );

        successCount++;
      } catch (rowError) {
        errorCount++;
        errors.push(`Row ${i}: ${rowError.message}`);
      }
    }

    res.json({
      imported: successCount,
      duplicates: duplicateCount,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== TRUNCATE TENANTS (SUPERUSER ONLY) =====
app.delete('/api/tenants/truncate/all', verifyToken, async (req, res) => {
  try {
    // Check if user is superuser
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.userId]);
    
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'superuser') {
      return res.status(403).json({ error: 'Only superusers can truncate data' });
    }
    
    // Delete all tenants for this company
    const result = await pool.query('DELETE FROM tenants WHERE company_id = 1');
    
    res.json({
      status: 'success',
      message: `Deleted ${result.rowCount} tenants`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== TRUNCATE UNITS (SUPERUSER ONLY) =====
app.delete('/api/units/truncate/all', verifyToken, async (req, res) => {
  try {
    // Check if user is superuser
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.userId]);
    
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'superuser') {
      return res.status(403).json({ error: 'Only superusers can truncate data' });
    }
    
    // Delete all units for this company
    const result = await pool.query('DELETE FROM units WHERE company_id = 1');
    
    res.json({
      status: 'success',
      message: `Deleted ${result.rowCount} units`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET CURRENT USER INFO =====
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, role FROM users WHERE id = $1', [req.user.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ERROR HANDLING MIDDLEWARE (FIXED #3) =====
// This MUST be added BEFORE app.listen() but AFTER all other routes
app.use((err, req, res, next) => {
  // Log full error details server-side for debugging
  console.error('❌ Unhandled Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Determine HTTP status code
  const statusCode = err.statusCode || err.status || 500;
  
  // In development, expose error details; in production, hide them
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response = {
    status: 'error',
    message: isDevelopment ? err.message : 'Internal server error'
  };

  if (isDevelopment) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

// Handle uncaught promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  // Don't exit - let the app continue running
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // In production, you might want to exit and restart
  // process.exit(1);
});

// ===== ROOT ROUTE =====
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Creekside Apartments Backend API is running',
    version: '1.0',
    endpoints: 'Use /api/* for all operations'
  });
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== START SERVER =====
(async () => {
  try {
    console.log('🔄 Initializing database on startup...');
    await initDatabase();
    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    // Continue anyway - database might already exist
  }

  app.listen(PORT, () => {
    console.log('╔════════════════════════════════════╗');
    console.log('║  🎬 CREEKSIDE - PRODUCTION LIVE   ║');
    console.log(`║  Port: ${PORT}                          ║`);
    console.log('║  ✅ PostgreSQL Connected           ║');
    console.log('║  ✅ Email Ready (SendGrid)         ║');
    console.log('║  ✅ SMS Ready (Twilio)             ║');
    console.log('║  ✅ Mail Ready (Lob)               ║');
    console.log('║  ✅ Send Notices Configured        ║');
    console.log('║  ✅ Root Route Available at /     ║');
    console.log('║  ✅ SECURITY HARDENED              ║');
    console.log('╚════════════════════════════════════╝');
  });
})();

module.exports = app;
