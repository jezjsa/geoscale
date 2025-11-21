-- GeoScale Database Schema
-- This file contains the initial database schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agencies table (created first, foreign key added later to avoid circular dependency)
CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL, -- Foreign key constraint added after users table is created
  plan TEXT NOT NULL CHECK (plan IN ('agency', 'agency_plus')),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'individual' CHECK (plan IN ('individual', 'agency', 'agency_plus')),
  agency_id UUID, -- Foreign key constraint added after agencies table exists
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints after both tables exist (resolves circular dependency)
DO $$
BEGIN
  -- Add foreign key from users.agency_id to agencies.id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_agency_id'
  ) THEN
    ALTER TABLE users 
      ADD CONSTRAINT fk_users_agency_id 
      FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
  END IF;

  -- Add foreign key from agencies.owner_user_id to users.id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_agencies_owner_user_id'
  ) THEN
    ALTER TABLE agencies 
      ADD CONSTRAINT fk_agencies_owner_user_id 
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  wp_url TEXT NOT NULL,
  blog_url TEXT, -- Root URL where blog posts are published (e.g., https://example.com/blog)
  wp_api_key TEXT NOT NULL, -- Generated API key for WordPress plugin
  project_name TEXT NOT NULL,
  base_keyword TEXT,
  base_location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project locations table
CREATE TABLE IF NOT EXISTS project_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  place_id TEXT, -- Google Places API place_id
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  region TEXT,
  country TEXT DEFAULT 'GB',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, place_id)
);

-- Keyword variations table
CREATE TABLE IF NOT EXISTS keyword_variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  difficulty DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, keyword)
);

-- Location keywords table (junction table for locations × keywords)
CREATE TABLE IF NOT EXISTS location_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES project_locations(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES keyword_variations(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL, -- Combined phrase (e.g., "web design in London")
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'pushed')),
  wp_page_id INTEGER, -- WordPress page ID after push
  wp_page_url TEXT, -- WordPress page URL after push
  position INTEGER, -- Google ranking position (1-100+)
  previous_position INTEGER, -- Previous ranking position for tracking movement
  last_position_check TIMESTAMPTZ, -- Timestamp of last position check via DataForSEO SERP API
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, location_id, keyword_id)
);

-- Generated pages table
CREATE TABLE IF NOT EXISTS generated_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_keyword_id UUID NOT NULL REFERENCES location_keywords(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- HTML content
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_keyword_id)
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_count INTEGER DEFAULT 0,
  location_count INTEGER DEFAULT 0,
  keyword_variation_count INTEGER DEFAULT 0,
  generated_page_count INTEGER DEFAULT 0,
  wordpress_push_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- API logs table (for debugging API calls)
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  api_type TEXT NOT NULL CHECK (api_type IN ('google', 'dataforseo', 'openai', 'wordpress')),
  endpoint TEXT,
  method TEXT,
  status_code INTEGER,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_user_id ON users(supabase_auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_agency_id ON users(agency_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_agency_id ON projects(agency_id);
CREATE INDEX IF NOT EXISTS idx_project_locations_project_id ON project_locations(project_id);
CREATE INDEX IF NOT EXISTS idx_keyword_variations_project_id ON keyword_variations(project_id);
CREATE INDEX IF NOT EXISTS idx_location_keywords_project_id ON location_keywords(project_id);
CREATE INDEX IF NOT EXISTS idx_location_keywords_status ON location_keywords(status);
CREATE INDEX IF NOT EXISTS idx_generated_pages_project_id ON generated_pages(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_pages_location_keyword_id ON generated_pages(location_keyword_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = supabase_auth_user_id);

CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = supabase_auth_user_id);

-- Agencies policies
CREATE POLICY "Users can view agencies they own"
  ON agencies FOR SELECT
  USING (auth.uid() IN (SELECT supabase_auth_user_id FROM users WHERE id = owner_user_id));

-- Projects policies
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = user_id
    )
  );

CREATE POLICY "Users can create their own projects"
  ON projects FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = user_id
    )
  );

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = user_id
    )
  );

-- Similar policies for other tables (project_locations, keyword_variations, etc.)
-- For brevity, I'll create a function to check project ownership
CREATE OR REPLACE FUNCTION user_owns_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = project_uuid AND u.supabase_auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Project locations policies
CREATE POLICY "Users can manage locations in their projects"
  ON project_locations FOR ALL
  USING (user_owns_project(project_id));

-- Keyword variations policies
CREATE POLICY "Users can manage keywords in their projects"
  ON keyword_variations FOR ALL
  USING (user_owns_project(project_id));

-- Location keywords policies
CREATE POLICY "Users can manage location keywords in their projects"
  ON location_keywords FOR ALL
  USING (user_owns_project(project_id));

-- Generated pages policies
CREATE POLICY "Users can manage generated pages in their projects"
  ON generated_pages FOR ALL
  USING (user_owns_project(project_id));

-- Usage tracking policies
CREATE POLICY "Users can view their own usage"
  ON usage_tracking FOR SELECT
  USING (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = user_id
    )
  );

-- API logs policies
CREATE POLICY "Users can view their own API logs"
  ON api_logs FOR SELECT
  USING (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = user_id
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_keywords_updated_at BEFORE UPDATE ON location_keywords
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_pages_updated_at BEFORE UPDATE ON generated_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

