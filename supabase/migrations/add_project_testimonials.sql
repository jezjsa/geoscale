-- Create project_testimonials table
CREATE TABLE IF NOT EXISTS project_testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  testimonial_text TEXT NOT NULL,
  customer_name TEXT,
  business_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_project_testimonials_project_id ON project_testimonials(project_id);

-- Row Level Security
ALTER TABLE project_testimonials ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage testimonials for their own projects
CREATE POLICY "Users can manage testimonials in their projects"
  ON project_testimonials FOR ALL
  USING (user_owns_project(project_id));

-- Trigger for updated_at
CREATE TRIGGER update_project_testimonials_updated_at BEFORE UPDATE ON project_testimonials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

