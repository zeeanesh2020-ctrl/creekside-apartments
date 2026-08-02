const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// CORS - BULLETPROOF VERSION
app.use((req, res, next) => {
  // Allow all origins
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight request handled');
    return res.sendStatus(200);
  }
  
  next();
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Mock data
const recipients = [
  { id: 't1', name: 'John Smith', unit: '101', email: 'john@email.com', phone: '555-0101', status: 'ACTIVE' },
  { id: 't2', name: 'Jane Doe', unit: '102', email: 'jane@email.com', phone: '555-0102', status: 'ACTIVE' },
  { id: 't3', name: 'Bob Johnson', unit: '103', email: 'bob@email.com', phone: '555-0103', status: 'ACTIVE' },
  { id: 't4', name: 'Alice Williams', unit: '104', email: 'alice@email.com', phone: '555-0104', status: 'ACTIVE' },
  { id: 't5', name: 'Charlie Brown', unit: '105', email: 'charlie@email.com', phone: '555-0105', status: 'ACTIVE' },
  { id: 't6', name: 'Diana Prince', unit: '106', email: 'diana@email.com', phone: '555-0106', status: 'ACTIVE' },
  { id: 't7', name: 'Eve Adams', unit: '107', email: 'eve@email.com', phone: '555-0107', status: 'ACTIVE' },
  { id: 't8', name: 'Frank Miller', unit: '108', email: 'frank@email.com', phone: '555-0108', status: 'ACTIVE' },
  { id: 't9', name: 'Grace Lee', unit: '109', email: 'grace@email.com', phone: '555-0109', status: 'ACTIVE' },
  { id: 't10', name: 'Henry Davis', unit: '110', email: 'henry@email.com', phone: '555-0110', status: 'ACTIVE' }
];

let notifications = [];

// ROOT
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '🎬 CREEKSIDE APARTMENTS - Backend Running',
    corsEnabled: true
  });
});

// HEALTH
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Backend operational',
    timestamp: new Date().toISOString()
  });
});

// LOGIN
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  
  const { email, password } = req.body;
  
  if (email === 'manager@creekside.com' && password === 'demo123') {
    const response = {
      user: {
        id: 'user-1',
        name: 'John Manager',
        email: 'manager@creekside.com',
        role: 'admin'
      },
      token: 'demo-token-' + Date.now(),
      status: 'success'
    };
    console.log('Login SUCCESS');
    return res.json(response);
  }
  
  console.log('Login FAILED - invalid credentials');
  return res.status(401).json({ 
    error: 'Invalid credentials',
    status: 'failed'
  });
});

// STATISTICS
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

// GET NOTIFICATIONS
app.get('/api/notifications', (req, res) => {
  if (notifications.length === 0) {
    notifications.push({
      id: 'notif-1',
      notice_type: 'RENT_REMINDER',
      total_recipients: 45,
      status: 'DELIVERED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  res.json(notifications);
});

// POST NOTIFICATION
app.post('/api/notifications', (req, res) => {
  const { noticeType, recipients: recips } = req.body;
  const newNotif = {
    id: 'notif-' + Date.now(),
    notice_type: noticeType || 'GENERAL',
    total_recipients: recips ? recips.length : 45,
    status: 'SENT',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  notifications.push(newNotif);
  res.json({ 
    id: newNotif.id, 
    status: 'success', 
    message: '✅ Notification created'
  });
});

// GET RECIPIENTS
app.get('/api/recipients', (req, res) => {
  res.json(recipients);
});

// POST RECIPIENT
app.post('/api/recipients', (req, res) => {
  const { name, unit, email, phone } = req.body;
  const newRecip = {
    id: 'r-' + Date.now(),
    name,
    unit,
    email,
    phone,
    status: 'ACTIVE'
  };
  recipients.push(newRecip);
  res.json({
    id: newRecip.id,
    status: 'success',
    message: '✅ Recipient created'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    message: 'Check API documentation'
  });
});

// START
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║  🎬 CREEKSIDE - BACKEND RUNNING   ║');
  console.log(`║  Port: ${PORT}                          ║`);
  console.log('║  ✅ CORS: ENABLED                  ║');
  console.log('║  ✅ Ready for connections          ║');
  console.log('╚════════════════════════════════════╝\n');
});

process.on('SIGINT', () => {
  console.log('\n✅ Server shutdown');
  process.exit(0);
});
