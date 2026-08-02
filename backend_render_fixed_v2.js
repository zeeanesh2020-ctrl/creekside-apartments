const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// SQLite Database Setup
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('Database error:', err);
  else console.log('✅ SQLite database initialized');
});

// Initialize Database
const initDatabase = () => {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        password TEXT,
        role TEXT
      )
    `);

    // Recipients table
    db.run(`
      CREATE TABLE IF NOT EXISTS recipients (
        id TEXT PRIMARY KEY,
        name TEXT,
        unit TEXT,
        email TEXT,
        phone TEXT,
        status TEXT
      )
    `);

    // Notifications table
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        notice_type TEXT,
        total_recipients INTEGER,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `);

    // Insert demo user
    db.run(`
      INSERT OR IGNORE INTO users VALUES (
        'user-1',
        'John Manager',
        'manager@creekside.com',
        'demo123',
        'admin'
      )
    `);

    // Insert sample tenants
    const tenants = [
      ['t1', 'John Smith', '101', 'john@email.com', '555-0101'],
      ['t2', 'Jane Doe', '102', 'jane@email.com', '555-0102'],
      ['t3', 'Bob Johnson', '103', 'bob@email.com', '555-0103'],
      ['t4', 'Alice Williams', '104', 'alice@email.com', '555-0104'],
      ['t5', 'Charlie Brown', '105', 'charlie@email.com', '555-0105'],
      ['t6', 'Diana Prince', '106', 'diana@email.com', '555-0106'],
      ['t7', 'Eve Adams', '107', 'eve@email.com', '555-0107'],
      ['t8', 'Frank Miller', '108', 'frank@email.com', '555-0108'],
      ['t9', 'Grace Lee', '109', 'grace@email.com', '555-0109'],
      ['t10', 'Henry Davis', '110', 'henry@email.com', '555-0110']
    ];

    tenants.forEach(tenant => {
      db.run(
        'INSERT OR IGNORE INTO recipients VALUES (?, ?, ?, ?, ?, ?)',
        [tenant[0], tenant[1], tenant[2], tenant[3], tenant[4], 'ACTIVE']
      );
    });

    console.log('✅ Database initialized with demo data');
  });
};

initDatabase();

// ===== ROOT ROUTE =====
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: '🎬 CREEKSIDE APARTMENTS - Backend API Running',
    endpoints: ['/api/health', '/api/auth/login', '/api/notifications', '/api/recipients', '/api/statistics'],
    timestamp: new Date().toISOString()
  });
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '✅ Backend is running',
    timestamp: new Date().toISOString()
  });
});

// ===== AUTH LOGIN =====
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (email === 'manager@creekside.com' && password === 'demo123') {
    res.json({
      user: {
        id: 'user-1',
        name: 'John Manager',
        email: 'manager@creekside.com',
        role: 'admin'
      },
      token: 'demo-token-' + Date.now(),
      status: 'success'
    });
  } else {
    res.status(401).json({
      error: 'Invalid credentials',
      status: 'failed'
    });
  }
});

// ===== STATISTICS =====
app.get('/api/statistics', (req, res) => {
  res.json({
    total_sent: 127,
    delivered: 98,
    read: 72,
    responded: 45,
    failed: 3,
    pending: 8,
    status: 'OK'
  });
});

// ===== GET NOTIFICATIONS =====
app.get('/api/notifications', (req, res) => {
  db.all('SELECT * FROM notifications LIMIT 10', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (!rows || rows.length === 0) {
      return res.json([
        {
          id: 'notif-1',
          notice_type: 'RENT_REMINDER',
          total_recipients: 45,
          status: 'DELIVERED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
    }
    
    res.json(rows);
  });
});

// ===== POST NOTIFICATIONS =====
app.post('/api/notifications', (req, res) => {
  const { noticeType, recipients, deliveryMethods, deadline, customMessage } = req.body;
  const id = 'notif-' + Date.now();

  db.run(
    'INSERT INTO notifications VALUES (?, ?, ?, ?, ?, ?)',
    [id, noticeType, recipients.length, 'PENDING', new Date().toISOString(), new Date().toISOString()],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({
        id: id,
        noticeType: noticeType,
        recipientCount: recipients.length,
        deliveryMethods: deliveryMethods,
        deadline: deadline,
        customMessage: customMessage,
        status: 'SENT',
        message: '✅ Notification created successfully'
      });
    }
  );
});

// ===== GET RECIPIENTS =====
app.get('/api/recipients', (req, res) => {
  db.all('SELECT * FROM recipients', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json(rows || [
      {
        id: 't1',
        name: 'John Smith',
        unit: '101',
        email: 'john@email.com',
        phone: '555-0101',
        status: 'ACTIVE'
      }
    ]);
  });
});

// ===== POST RECIPIENTS =====
app.post('/api/recipients', (req, res) => {
  const { name, unit, email, phone } = req.body;
  const id = 'r-' + Date.now();

  db.run(
    'INSERT INTO recipients VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, unit, email, phone, 'ACTIVE'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({
        id: id,
        name: name,
        unit: unit,
        email: email,
        phone: phone,
        status: 'ACTIVE',
        message: '✅ Recipient created successfully'
      });
    }
  );
});

// ===== 404 HANDLER =====
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    message: 'Use /api/health to check if backend is running'
  });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🎬 CREEKSIDE APARTMENTS - LIVE DEMO   ║');
  console.log('║                                        ║');
  console.log('║  Backend API Running                   ║');
  console.log(`║  Port: ${PORT}                              ║`);
  console.log('║                                        ║');
  console.log('║  Test URLs:                            ║');
  console.log('║  GET  /api/health                      ║');
  console.log('║  POST /api/auth/login                  ║');
  console.log('║  GET  /api/notifications               ║');
  console.log('║  GET  /api/recipients                  ║');
  console.log('║  GET  /api/statistics                  ║');
  console.log('║                                        ║');
  console.log('║  ✅ All endpoints operational          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\n');
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Database close error:', err);
    else console.log('✅ Database connection closed');
    process.exit(0);
  });
});
