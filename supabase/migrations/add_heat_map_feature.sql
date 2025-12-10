-- Heat Map Feature Migration
-- Adds location_ranking_grid table for geographic ranking analysis

-- Location ranking grid table (for heat map visualization)
CREATE TABLE IF NOT EXISTS location_ranking_grid (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_keyword_id UUID REFERENCES location_keywords(id) ON DELETE CASCADE,
  keyword_combination TEXT NOT NULL,
  grid_x INTEGER NOT NULL,
  grid_y INTEGER NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  position INTEGER,
  search_location TEXT, -- The location used for DataForSEO search
  grid_size INTEGER NOT NULL, -- e.g., 7 for 7x7 grid
  radius_km INTEGER NOT NULL, -- Coverage radius in kilometers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, keyword_combination, grid_x, grid_y)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_ranking_grid_project_id ON location_ranking_grid(project_id);
CREATE INDEX IF NOT EXISTS idx_location_ranking_grid_keyword_combination ON location_ranking_grid(keyword_combination);
CREATE INDEX IF NOT EXISTS idx_location_ranking_grid_created_at ON location_ranking_grid(created_at);

-- Enable Row Level Security
ALTER TABLE location_ranking_grid ENABLE ROW LEVEL SECURITY;

-- RLS Policies for location_ranking_grid
CREATE POLICY "Users can view their own ranking grid data"
  ON location_ranking_grid FOR SELECT
  USING (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)
    )
  );

CREATE POLICY "Users can insert their own ranking grid data"
  ON location_ranking_grid FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)
    )
  );

CREATE POLICY "Users can update their own ranking grid data"
  ON location_ranking_grid FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT supabase_auth_user_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)
    )
  );

-- Trigger for updated_at column
CREATE TRIGGER update_location_ranking_grid_updated_at BEFORE UPDATE ON location_ranking_grid
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE location_ranking_grid IS 'Stores geographic grid points for heat map ranking analysis';
COMMENT ON COLUMN location_ranking_grid.keyword_combination IS 'The keyword phrase being analyzed (e.g., "web design in doncaster")';
COMMENT ON COLUMN location_ranking_grid.grid_x IS 'X coordinate in the grid (0 to grid_size-1)';
COMMENT ON COLUMN location_ranking_grid.grid_y IS 'Y coordinate in the grid (0 to grid_size-1)';
COMMENT ON COLUMN location_ranking_grid.position IS 'Google ranking position at this location (null if not ranked)';
COMMENT ON COLUMN location_ranking_grid.search_location IS 'The location string used for DataForSEO API call';
COMMENT ON COLUMN location_ranking_grid.grid_size IS 'Size of the grid (e.g., 7 for 7x7 grid)';
COMMENT ON COLUMN location_ranking_grid.radius_km IS 'Coverage radius in kilometers from center point';
