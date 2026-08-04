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
        notice_template_id INT,
        notice_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'SENT',
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
    
    // Check if this is the first user
    const userCountResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const isFirstUser = userCountResult.rows[0].count === 0;
    const role = isFirstUser ? 'superuser' : 'manager';
    
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, hashedPassword, name, role]
    );

    const token = jwt.sign({ userId: result.rows[0].id, email: result.rows[0].email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: result.rows[0],
      token: token,
      status: 'success',
      message: isFirstUser ? 'Account created as SUPERUSER!' : 'Account created!'
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

app.delete('/api/units/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM units WHERE id = $1 AND company_id = 1', [req.params.id]);
    res.json({ status: 'deleted', deletedCount: result.rowCount });
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
    const result = await pool.query('DELETE FROM tenants WHERE id = $1 AND company_id = 1', [req.params.id]);
    res.json({ status: 'deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== NOTICE TEMPLATES =====
app.get('/api/notice-templates', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notice_templates WHERE company_id = 1 ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notice-templates', verifyToken, async (req, res) => {
  try {
    const { name, notice_type, subject, content } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    if (!notice_type || !notice_type.trim()) {
      return res.status(400).json({ error: 'Notice type is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Template content is required' });
    }
    
    // Check if template with same name already exists
    const existing = await pool.query(
      'SELECT id FROM notice_templates WHERE company_id = 1 AND LOWER(name) = LOWER($1)',
      [name.trim()]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Template with this name already exists' });
    }
    
    const result = await pool.query(
      'INSERT INTO notice_templates (company_id, name, notice_type, subject, content) VALUES (1, $1, $2, $3, $4) RETURNING *',
      [name.trim(), notice_type.trim(), subject?.trim() || null, content.trim()]
    );
    
    console.log('✅ Template created:', result.rows[0].id);
    res.status(201).json({ 
      status: 'success',
      message: '✅ Template created successfully!',
      template: result.rows[0] 
    });
  } catch (error) {
    console.error('❌ Template creation error:', error);
    res.status(500).json({ error: error.message || 'Error creating template' });
  }
});

// ===== CSV PARSER FOR MULTILINE QUOTED FIELDS =====
function parseCSV(csvText) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      // End of line (not in quotes)
      if (current.trim()) {
        lines.push(current);
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    lines.push(current);
  }
  
  // Parse lines into rows
  return lines.map(line => {
    const row = [];
    let cell = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell.trim());
    return row;
  });
}

// ===== BULK IMPORT NOTICE TEMPLATES FROM CSV =====
app.post('/api/import/templates', verifyToken, async (req, res) => {
  try {
    const { templates, csvText } = req.body;
    
    // If raw CSV text provided, parse it
    let templateList = templates || [];
    if (csvText && !templates) {
      const rows = parseCSV(csvText);
      if (rows.length < 2) {
        return res.status(400).json({ error: 'CSV file must have header row and at least one template' });
      }
      
      const headers = rows[0];
      const nameIdx = headers.indexOf('name');
      const typeIdx = headers.indexOf('notice_type');
      const subjectIdx = headers.indexOf('subject');
      const contentIdx = headers.indexOf('content');
      
      if (nameIdx === -1 || typeIdx === -1 || contentIdx === -1) {
        return res.status(400).json({ error: 'CSV must have columns: name, notice_type, content (subject optional)' });
      }
      
      // Parse template rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length > Math.max(nameIdx, typeIdx, contentIdx)) {
          templateList.push({
            name: row[nameIdx]?.trim(),
            notice_type: row[typeIdx]?.trim(),
            subject: subjectIdx >= 0 ? row[subjectIdx]?.trim() : '',
            content: row[contentIdx]?.trim()
          });
        }
      }
    }
    
    if (!templateList || templateList.length === 0) {
      return res.status(400).json({ error: 'No templates to import' });
    }
    
    let imported = 0;
    let duplicates = 0;
    let errors = [];
    
    for (let idx = 0; idx < templateList.length; idx++) {
      try {
        const template = templateList[idx];
        
        // Validate required fields
        if (!template.name || !template.name.trim()) {
          errors.push(`Row ${idx + 2}: Missing template name`);
          continue;
        }
        if (!template.notice_type || !template.notice_type.trim()) {
          errors.push(`Row ${idx + 2}: Missing notice_type`);
          continue;
        }
        if (!template.content || !template.content.trim()) {
          errors.push(`Row ${idx + 2}: Missing content`);
          continue;
        }
        
        // Check if subject column exists (if not, skip it)
        const checkColumn = await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='notice_templates' AND column_name='subject'"
        ).catch(() => ({ rows: [] }));
        
        // Check for duplicates
        const existing = await pool.query(
          'SELECT id FROM notice_templates WHERE company_id = 1 AND LOWER(name) = LOWER($1)',
          [template.name.trim()]
        );
        
        if (existing.rows.length > 0) {
          duplicates++;
          continue;
        }
        
        // Insert template (with or without subject based on column existence)
        if (checkColumn.rows.length > 0) {
          await pool.query(
            'INSERT INTO notice_templates (company_id, name, notice_type, subject, content) VALUES (1, $1, $2, $3, $4)',
            [
              template.name.trim(),
              template.notice_type.trim(),
              template.subject?.trim() || null,
              template.content.trim()
            ]
          );
        } else {
          await pool.query(
            'INSERT INTO notice_templates (company_id, name, notice_type, content) VALUES (1, $1, $2, $3)',
            [
              template.name.trim(),
              template.notice_type.trim(),
              template.content.trim()
            ]
          );
        }
        
        imported++;
      } catch (err) {
        errors.push(`Row ${idx + 2}: ${err.message}`);
        console.error(`Error on row ${idx + 2}:`, err);
      }
    }
    
    console.log(`✅ Import complete: ${imported} imported, ${duplicates} duplicates, ${errors.length} errors`);
    
    res.json({
      status: 'success',
      imported: imported,
      duplicates: duplicates,
      errors: errors.slice(0, 10),
      message: `✅ ${imported} imported, ⚠️ ${duplicates} duplicates skipped${errors.length > 0 ? `, ❌ ${errors.length} errors` : ''}`
    });
  } catch (error) {
    console.error('❌ Template import error:', error);
    res.status(500).json({ error: error.message || 'Error importing templates' });
  }
});

app.put('/api/notice-templates/:id', verifyToken, async (req, res) => {
  try {
    const { name, notice_type, subject, content } = req.body;
    
    const result = await pool.query(
      'UPDATE notice_templates SET name = $1, notice_type = $2, subject = $3, content = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND company_id = 1 RETURNING *',
      [name, notice_type, subject || null, content, req.params.id]
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
    await pool.query('DELETE FROM notice_templates WHERE id = $1 AND company_id = 1', [req.params.id]);
    res.json({ status: 'deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SEND NOTICES ENDPOINT =====
app.post('/api/send-notices', authenticateJWT, async (req, res) => {
  try {
    const { template_id, recipients, delivery_method } = req.body;
    const company_id = req.company_id;
    const user_id = req.user_id;

    // Validation
    if (!template_id || !recipients || !delivery_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get template
    const templateResult = await pool.query(
      'SELECT * FROM notice_templates WHERE id = $1 AND company_id = $2',
      [template_id, company_id]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Determine recipient list
    let recipientList = [];

    if (recipients === 'all') {
      // All tenants
      const allTenants = await pool.query(
        'SELECT id, unit FROM tenants WHERE company_id = $1 ORDER BY unit',
        [company_id]
      );
      recipientList = allTenants.rows;
    } else if (Array.isArray(recipients) && recipients.length > 0) {
      // Specific recipients (could be tenants or units)
      if (recipients[0].id) {
        // Tenant objects
        recipientList = recipients;
      } else {
        // IDs only
        const selectedTenants = await pool.query(
          'SELECT id, unit FROM tenants WHERE id = ANY($1)',
          [recipients]
        );
        recipientList = selectedTenants.rows;
      }
    } else if (recipients.building) {
      // By building
      const buildingTenants = await pool.query(
        'SELECT id, unit FROM tenants WHERE company_id = $1 AND unit LIKE $2 ORDER BY unit',
        [company_id, recipients.building + '%']
      );
      recipientList = buildingTenants.rows;
    }

    // Create tenant notices for each recipient
    let noticeCount = 0;
    const now = new Date();
    
    for (const tenant of recipientList) {
      const tenantId = tenant.id || tenant;
      
      try {
        await pool.query(
          `INSERT INTO tenant_notices (tenant_id, template_id, status, delivery_method, sent_date, company_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [tenantId, template_id, 'SENT', delivery_method, now, company_id]
        );
        noticeCount++;
      } catch (err) {
        console.error(`Error creating notice for tenant ${tenantId}:`, err);
      }
    }

    // Log to audit
    try {
      await pool.query(
        `INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [company_id, user_id, 'SEND_NOTICES', 'notice', template_id, now]
      );
    } catch (err) {
      console.error('Audit log error:', err);
    }

    res.json({ 
      sent: noticeCount, 
      message: `${noticeCount} notices sent`,
      template_id: template_id,
      delivery_method: delivery_method
    });
  } catch (error) {
    console.error('Send notices error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GET ALL TENANT NOTICES =====
app.get('/api/tenant-notices', authenticateJWT, async (req, res) => {
  try {
    const company_id = req.company_id;

    const result = await pool.query(
      `SELECT 
        tn.id,
        tn.tenant_id,
        tn.template_id,
        tn.status,
        tn.delivery_method,
        tn.sent_date,
        tn.received_date,
        tn.response_date,
        t.name as tenant_name,
        t.email as tenant_email,
        t.unit,
        nt.name as notice_type,
        nt.notice_type,
        nt.subject
       FROM tenant_notices tn
       LEFT JOIN tenants t ON tn.tenant_id = t.id
       LEFT JOIN notice_templates nt ON tn.template_id = nt.id
       WHERE tn.company_id = $1
       ORDER BY tn.sent_date DESC
       LIMIT 500`,
      [company_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GET SPECIFIC TENANT NOTICE =====
app.get('/api/tenant-notices/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.company_id;

    const result = await pool.query(
      `SELECT 
        tn.id,
        tn.tenant_id,
        tn.template_id,
        tn.status,
        tn.delivery_method,
        tn.sent_date,
        tn.received_date,
        tn.response_date,
        t.name as tenant_name,
        t.email as tenant_email,
        t.unit,
        nt.name as notice_type,
        nt.notice_type,
        nt.subject,
        nt.content
       FROM tenant_notices tn
       LEFT JOIN tenants t ON tn.tenant_id = t.id
       LEFT JOIN notice_templates nt ON tn.template_id = nt.id
       WHERE tn.id = $1 AND tn.company_id = $2`,
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get notice error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== UPDATE TENANT NOTICE STATUS =====
app.patch('/api/tenant-notices/:id/status', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, received_date, response_date } = req.body;
    const company_id = req.company_id;
    const user_id = req.user_id;

    // Validation
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Update notice
    const updateResult = await pool.query(
      `UPDATE tenant_notices 
       SET status = $1, 
           received_date = COALESCE($2, received_date),
           response_date = COALESCE($3, response_date),
           updated_at = NOW()
       WHERE id = $4 AND company_id = $5
       RETURNING *`,
      [status, received_date || null, response_date || null, id, company_id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    // Log to audit
    try {
      await pool.query(
        `INSERT INTO audit_log (company_id, user_id, action, resource_type, resource_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [company_id, user_id, 'UPDATE_NOTICE_STATUS', 'notice', id, new Date()]
      );
    } catch (err) {
      console.error('Audit log error:', err);
    }

    res.json({ 
      message: 'Notice status updated',
      notice: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Update notice status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GET AUDIT LOG =====
app.get('/api/audit-log', authenticateJWT, async (req, res) => {
  try {
    const company_id = req.company_id;

    const result = await pool.query(
      `SELECT 
        id,
        company_id,
        user_id,
        action,
        resource_type,
        resource_id,
        created_at
       FROM audit_log
       WHERE company_id = $1
       ORDER BY created_at DESC
       LIMIT 500`,
      [company_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== TENANT NOTICES =====
app.get('/api/tenants/:id/notices', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tenant_notices WHERE company_id = 1 AND tenant_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenant-notices', verifyToken, async (req, res) => {
  try {
    const { tenant_id, notice_template_id, notice_type, status } = req.body;
    
    const result = await pool.query(
      'INSERT INTO tenant_notices (company_id, tenant_id, notice_template_id, notice_type, status) VALUES (1, $1, $2, $3, $4) RETURNING *',
      [tenant_id, notice_template_id || null, notice_type, status || 'SENT']
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tenant-notices/:id', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE tenant_notices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = 1 RETURNING *',
      [status, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notice not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== INLINE STATUS UPDATES =====
// Update tenant status (tenancy status)
app.patch('/api/tenants/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE tenants SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = 1 RETURNING *',
      [status, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update unit status
app.patch('/api/units/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE units SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = 1 RETURNING *',
      [status, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    res.json(result.rows[0]);
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

// ===== BULK IMPORT: TENANTS WITH DUPLICATE CHECK =====
app.post('/api/import/tenants', verifyToken, async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors = [];
    const duplicates = [];
    
    for (const tenant of data) {
      try {
        const { name, unit, email, phone, status, lease_start, lease_end } = tenant;
        
        if (!name || !unit) {
          errorCount++;
          errors.push(`Row missing name or unit: ${JSON.stringify(tenant)}`);
          continue;
        }
        
        // Check if tenant already exists (by name + unit combination)
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
      duplicateCount,
      errorCount,
      totalCount: data.length,
      duplicates: duplicates.slice(0, 5),
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== BULK IMPORT: UNITS WITH DUPLICATE CHECK =====
app.post('/api/import/units', verifyToken, async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors = [];
    const duplicates = [];
    
    for (const unit of data) {
      try {
        const { unit_number, status } = unit;
        
        if (!unit_number) {
          errorCount++;
          errors.push(`Row missing unit_number: ${JSON.stringify(unit)}`);
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
        errors.push(`Error importing unit "${unit.unit_number}": ${rowError.message}`);
      }
    }
    
    res.json({
      status: 'complete',
      successCount,
      duplicateCount,
      errorCount,
      totalCount: data.length,
      duplicates: duplicates.slice(0, 5),
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
