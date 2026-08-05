const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from current directory
app.use(express.static(path.join(__dirname, '.')));

// Serve index.html for all routes (Single Page App behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════╗');
  console.log('║  🎬 CREEKSIDE FRONTEND RUNNING    ║');
  console.log(`║  Port: ${PORT}                          ║`);
  console.log('║  ✅ Serving index.html             ║');
  console.log('║  ✅ Static files enabled           ║');
  console.log('║  ✅ SPA routing configured         ║');
  console.log('╚════════════════════════════════════╝');
});

module.exports = app;
