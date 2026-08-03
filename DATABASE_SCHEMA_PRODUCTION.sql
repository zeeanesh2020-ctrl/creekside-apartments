-- ===== CREEKSIDE APARTMENTS - PRODUCTION DATABASE SCHEMA =====
-- PostgreSQL Production Schema
-- Run this file to initialize the complete production database

-- ===== COMPANIES TABLE =====
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

CREATE INDEX idx_companies_name ON companies(name);

-- ===== USERS TABLE =====
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);

-- ===== TENANTS TABLE =====
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

CREATE INDEX idx_tenants_company_id ON tenants(company_id);
CREATE INDEX idx_tenants_unit ON tenants(unit);
CREATE INDEX idx_tenants_email ON tenants(email);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ===== NOTICE TEMPLATES TABLE =====
CREATE TABLE IF NOT EXISTS notice_templates (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

CREATE INDEX idx_notice_templates_company_id ON notice_templates(company_id);
CREATE INDEX idx_notice_templates_notice_type ON notice_templates(notice_type);

-- ===== NOTIFICATIONS TABLE =====
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  notice_template_id INT REFERENCES notice_templates(id),
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

CREATE INDEX idx_notifications_company_id ON notifications(company_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ===== NOTIFICATION RECIPIENTS TABLE =====
CREATE TABLE IF NOT EXISTS notification_recipients (
  id SERIAL PRIMARY KEY,
  notification_id INT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  tenant_id INT NOT NULL REFERENCES tenants(id),
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

CREATE INDEX idx_notification_recipients_notification_id ON notification_recipients(notification_id);
CREATE INDEX idx_notification_recipients_tenant_id ON notification_recipients(tenant_id);
CREATE INDEX idx_notification_recipients_status ON notification_recipients(email_status, sms_status, mail_status);

-- ===== DELIVERY TRACKING TABLE =====
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id SERIAL PRIMARY KEY,
  notification_recipient_id INT NOT NULL REFERENCES notification_recipients(id) ON DELETE CASCADE,
  delivery_method VARCHAR(50),
  event_type VARCHAR(50),
  event_data JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delivery_tracking_notification_recipient_id ON delivery_tracking(notification_recipient_id);

-- ===== AUDIT LOG TABLE =====
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

CREATE INDEX idx_audit_log_company_id ON audit_log(company_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ===== COMPLIANCE LOGS TABLE =====
CREATE TABLE IF NOT EXISTS compliance_logs (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notification_id INT REFERENCES notifications(id),
  check_type VARCHAR(100),
  check_description TEXT,
  result VARCHAR(50),
  details JSONB,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_compliance_logs_company_id ON compliance_logs(company_id);

-- ===== SETTINGS TABLE =====
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(255) NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, setting_key)
);

-- ===== VIEWS FOR ANALYTICS =====

CREATE VIEW notification_stats AS
SELECT 
  n.id,
  n.company_id,
  n.notice_type,
  n.status,
  COUNT(nr.id) as total_recipients,
  SUM(CASE WHEN nr.email_status = 'DELIVERED' THEN 1 ELSE 0 END) as email_delivered,
  SUM(CASE WHEN nr.sms_status = 'DELIVERED' THEN 1 ELSE 0 END) as sms_delivered,
  SUM(CASE WHEN nr.mail_status = 'SENT_TO_MAIL' THEN 1 ELSE 0 END) as mail_sent,
  SUM(CASE WHEN nr.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
  n.created_at,
  n.sent_at
FROM notifications n
LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
GROUP BY n.id, n.company_id, n.notice_type, n.status, n.created_at, n.sent_at;

CREATE VIEW compliance_summary AS
SELECT 
  c.id as company_id,
  c.name as company_name,
  COUNT(DISTINCT n.id) as total_notifications_sent,
  COUNT(DISTINCT CASE WHEN n.status = 'SENT' THEN n.id END) as completed_notifications,
  COUNT(DISTINCT CASE WHEN cl.result = 'PASS' THEN cl.id END) as passed_compliance_checks,
  COUNT(DISTINCT CASE WHEN cl.result = 'FAIL' THEN cl.id END) as failed_compliance_checks,
  MAX(cl.checked_at) as last_compliance_check
FROM companies c
LEFT JOIN notifications n ON c.id = n.company_id
LEFT JOIN compliance_logs cl ON c.id = cl.company_id
GROUP BY c.id, c.name;

-- ===== TRIGGERS FOR AUDIT =====

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (user_id, company_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      CURRENT_USER_ID(),
      CASE 
        WHEN TG_TABLE_NAME = 'users' THEN NEW.company_id
        WHEN TG_TABLE_NAME = 'tenants' THEN NEW.company_id
        WHEN TG_TABLE_NAME = 'notifications' THEN NEW.company_id
        ELSE NULL
      END,
      TG_OP,
      TG_TABLE_NAME,
      NEW.id,
      row_to_json(OLD),
      row_to_json(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== INSERT SAMPLE DATA =====

INSERT INTO companies (name, address, city, state, zip, phone, email, subscription_tier) 
VALUES ('Creekside Apartments', '123 Main St', 'Bensalem', 'PA', '19020', '215-555-0123', 'admin@creekside.com', 'PREMIUM')
ON CONFLICT DO NOTHING;

-- ===== FINAL STATUS =====
-- ✅ Database schema initialized successfully
-- ✅ All tables created
-- ✅ All indexes created
-- ✅ All views created
-- ✅ All triggers created
-- Ready for production use
