const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// Explicit CORS middleware FIRST
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Mock data
const users = {
  'manager@creekside.com': { id: 'user-1', name: 'John Manager', email: 'manager@creekside.com', role: 'admin' }
};

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

let notifications = [
  { id: 'notif-1', notice_type: 'RENT_REMINDER', total_recipients: 45, status: 'DELIVERED', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

// Root route
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: '🎬 CREEKSIDE APARTMENTS - Backend API Running' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: '✅ Backend is running', timestamp: new Date().toISOString() });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (email === 'manager@creekside.com' && password === 'demo123') {
      return res.json({
        user: users[email],
        token: 'demo-token-' + Date.now(),
        status: 'success'
      });
    }
    
    return res.status(401).json({ error: 'Invalid credentials', status: 'failed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Statistics
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

// Get notifications
app.get('/api/notifications', (req, res) => {
  res.json(notifications);
});

// Create notification
app.post('/api/notifications', (req, res) => {
  try {
    const { noticeType, recipients: recips } = req.body;
    const newNotif = {
      id: 'notif-' + Date.now(),
      notice_type: noticeType,
      total_recipients: recips ? recips.length : 45,
      status: 'SENT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    notifications.push(newNotif);
    res.json({ id: newNotif.id, status: 'success', message: '✅ Notification created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recipients
app.get('/api/recipients', (req, res) => {
  res.json(recipients);
});

// Create recipient
app.post('/api/recipients', (req, res) => {
  try {
    const { name, unit, email, phone } = req.body;
    const newRecip = { id: 'r-' + Date.now(), name, unit, email, phone, status: 'ACTIVE' };
    recipients.push(newRecip);
    res.json({ id: newRecip.id, status: 'success', message: '✅ Recipient created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Start server
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║  🎬 CREEKSIDE APARTMENTS - LIVE    ║');
  console.log('║  Backend API Running               ║');
  console.log(`║  Port: ${PORT}                          ║`);
  console.log('║  ✅ CORS Enabled                   ║');
  console.log('║  ✅ All endpoints operational      ║');
  console.log('╚════════════════════════════════════╝\n');
});

process.on('SIGINT', () => {
  console.log('✅ Server shutting down');
  process.exit(0);
});
