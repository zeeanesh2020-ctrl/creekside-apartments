#!/usr/bin/env node

/**
 * Database Initialization Script
 * Run this ONCE to create all tables in your PostgreSQL database
 * Usage: node init-database.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// All SQL to create tables
const initSQL = `
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
  subscription_start DATE,
  subscription_end DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
  failed_login_attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
  move_in_date DATE,
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notice_templates (
  id SERIAL PRIMARY KEY,
  company_id INT DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  notice_type VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  content TEXT NOT NULL,
  html_content TEXT,
  variables JSONB,
  compliance_status VARCHAR(50) DEFAULT 'PENDING_REVIEW',
  attorney_reviewed BOOLEAN DEFAULT FALSE,
  attorney_name VARCHAR(255),
  attorney_date DATE,
  state_compliant BOOLEAN DEFAULT TRUE,
  county_compliant BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  company_id INT DEFAULT 1,
  user_id INT,
  notice_template_id INT,
  notice_type VARCHAR(100) NOT NULL,
  subject VARCHAR(255),
  body TEXT,
  recipient_count INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'DRAFT',
  priority VARCHAR(20) DEFAULT 'NORMAL',
  scheduled_for TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_recipients (
  id SERIAL PRIMARY KEY,
  notification_id INT,
  tenant_id INT,
  email VARCHAR(255),
  phone VARCHAR(20),
  delivery_methods VARCHAR(255),
  email_status VARCHAR(50) DEFAULT 'PENDING',
  sms_status VARCHAR(50) DEFAULT 'PENDING',
  mail_status VARCHAR(50) DEFAULT 'PENDING',
  email_sent_at TIMESTAMP,
  sms_sent_at TIMESTAMP,
  mail_sent_at TIMESTAMP,
  email_delivered_at TIMESTAMP,
  sms_delivered_at TIMESTAMP,
  mail_delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  bounced BOOLEAN DEFAULT FALSE,
  bounce_reason VARCHAR(255),
  complained BOOLEAN DEFAULT FALSE,
  attempt_count INT DEFAULT 0,
  last_attempt TIMESTAMP,
  next_retry TIMESTAMP,
  external_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_tracking (
  id SERIAL PRIMARY KEY,
  notification_recipient_id INT,
  delivery_method VARCHAR(50),
  event_type VARCHAR(50),
  event_data JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT,
  company_id INT DEFAULT 1,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  status VARCHAR(50) DEFAULT 'SUCCESS',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_logs (
  id SERIAL PRIMARY KEY,
  company_id INT DEFAULT 1,
  notification_id INT,
  check_type VARCHAR(100),
  check_description TEXT,
  result VARCHAR(50),
  details JSONB,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default company (FIXED: Added column to conflict clause)
INSERT INTO companies (id, name, address, city, state, zip, phone, email, subscription_tier)
VALUES (1, 'Creekside Apartments', '123 Main St', 'Bensalem', 'PA', '19020', '215-555-0123', 'admin@creekside.com', 'PREMIUM')
ON CONFLICT (id) DO NOTHING;
`;

async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to database...');
    
    // Test connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    
    console.log('\n📊 Creating tables...');
    
    // Run initialization SQL
    await pool.query(initSQL);
    
    console.log('✅ All tables created successfully!\n');
    
    // Verify tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Tables created:');
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    console.log('\n🎉 Database initialization complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error initializing database:');
    console.error(error.message);
    console.error('\n⚠️ Check:');
    console.error('1. DATABASE_URL is correct');
    console.error('2. AWS security group allows port 5432');
    console.error('3. Database is in "available" status');
    process.exit(1);
  }
}

initializeDatabase();
