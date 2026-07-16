-- SQL Schema Setup Script for Supabase (PostgreSQL)
-- Copy and execute this script inside the "SQL Editor" in your Supabase Dashboard

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL, -- 'super_admin', 'admin', 'user'
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL, -- Normalized e.g., 919876543210
    company TEXT,
    designation TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Templates Table
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    background_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'archived'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Template Fields Table
CREATE TABLE IF NOT EXISTS template_fields (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'text', 'image'
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    is_default INTEGER DEFAULT 0, -- 1 for default, 0 for custom
    font_family TEXT,
    font_size INTEGER,
    font_weight TEXT,
    text_color TEXT,
    extra_styles TEXT -- JSON string structure
);

-- 5. Create Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Campaign Templates Join Table
CREATE TABLE IF NOT EXISTS campaign_templates (
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, template_id)
);

-- 7. Create Share History Table
CREATE TABLE IF NOT EXISTS share_history (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    generated_image_url TEXT NOT NULL,
    share_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivery_status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    channel TEXT NOT NULL, -- 'manual', 'api'
    message_id TEXT
);

-- 8. Create Share Link Events Table
CREATE TABLE IF NOT EXISTS share_link_events (
    id SERIAL PRIMARY KEY,
    share_id INTEGER REFERENCES share_history(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'opened', 'clicked', 'deleted', 'expired', 'resent', 'failed', 'delivered', 'read'
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
);

-- 9. Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 9. Seed Default Administrative Users
-- admin@cap.com / admin123
-- user@cap.com / user123
INSERT INTO users (email, password_hash, role, name) VALUES 
('admin@cap.com', 'scrypt:32768:8:1$IT8ijLOSFMhcZY5e$05eed0272845c61cae1a2d83ac2bdd4d9e1769f2213692c327bdade88b8a4a69175f4ad922e2bf7a8eebe6adea85c9b29fd834a3294dca31ca443e404dd8f56esuper_admin', 'super_admin', 'Super Admin'),
('user@cap.com', 'scrypt:32768:8:1$Z5XwOphc57Q7nx6X$eea68de7efd25b319df47ededc31328d3e5f1628fb297c357ff2e370362fd094372d7b5fbc258b8c9c492ec5e19fc5f0863c7175540feb845676de62f76c6e9b', 'user', 'Standard User')
ON CONFLICT (email) DO NOTHING;

-- 10. Seed Default Application Settings
INSERT INTO settings (key, value) VALUES 
('sharing_mode', 'manual'),
('meta_phone_id', ''),
('meta_access_token', '')
ON CONFLICT (key) DO NOTHING;

-- 11. Create Storage Bucket 'cap-creatives'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cap-creatives', 'cap-creatives', true)
ON CONFLICT (id) DO NOTHING;

-- 12. Set up RLS Policies for the Storage Bucket 'cap-creatives'
-- Allow public select/read access to files
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'cap-creatives');

-- Allow public insert/upload access to files
CREATE POLICY "Public Insert Access" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'cap-creatives');

-- Allow public update access to files (for overwrites/upserts)
CREATE POLICY "Public Update Access" 
ON storage.objects FOR UPDATE 
TO public 
USING (bucket_id = 'cap-creatives');

-- 13. Create Database Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON contacts(mobile);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_share_history_msg ON share_history(message_id);
CREATE INDEX IF NOT EXISTS idx_share_history_contact_template ON share_history(contact_id, template_id);

-- 14. Disable Row Level Security (RLS) on all application tables to allow API access
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE template_fields DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE share_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE share_link_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;



