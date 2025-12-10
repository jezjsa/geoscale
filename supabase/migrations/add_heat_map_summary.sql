-- Add heat map summary table to store scan metadata and weak locations
CREATE TABLE IF NOT EXISTS heat_map_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword_combination TEXT NOT NULL,
  grid_size INTEGER NOT NULL,
  radius_km INTEGER NOT NULL,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  average_position INTEGER,
  ranked_count INTEGER NOT NULL DEFAULT 0,
  not_ranked_count INTEGER NOT NULL DEFAULT 0,
  weak_locations JSONB, -- Array of {name, position, lat, lng}
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_heat_map_scans_project_id ON heat_map_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_heat_map_scans_keyword ON heat_map_scans(keyword_combination);
CREATE INDEX IF NOT EXISTS idx_heat_map_scans_created_at ON heat_map_scans(scanned_at DESC);

-- Composite index for finding latest scan
CREATE INDEX IF NOT EXISTS idx_heat_map_scans_project_keyword ON heat_map_scans(project_id, keyword_combination, scanned_at DESC);

-- RLS
ALTER TABLE heat_map_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own heat map scans"
  ON heat_map_scans FOR SELECT
  USING (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)
    )
  );

CREATE POLICY "Users can insert their own heat map scans"
  ON heat_map_scans FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_heat_map_scans_updated_at BEFORE UPDATE ON heat_map_scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE heat_map_scans IS 'Stores metadata for heat map scans including weak locations';
COMMENT ON COLUMN heat_map_scans.weak_locations IS 'JSON array of weak location objects with name, position, lat, lng';
