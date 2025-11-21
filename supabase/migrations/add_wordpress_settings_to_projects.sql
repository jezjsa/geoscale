-- Add WordPress publishing settings to projects table

-- Add page template column (stores the WordPress page template filename)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS wp_page_template TEXT DEFAULT '';

-- Add publish status column (draft or publish)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS wp_publish_status TEXT DEFAULT 'draft'
CHECK (wp_publish_status IN ('draft', 'publish'));

-- Add comment for clarity
COMMENT ON COLUMN projects.wp_page_template IS 'WordPress page template filename (e.g., template-full-width.php). Empty string means default template.';
COMMENT ON COLUMN projects.wp_publish_status IS 'WordPress publish status: draft (save as draft) or publish (publish immediately)';

-- Add index for faster queries by status
CREATE INDEX IF NOT EXISTS idx_projects_wp_publish_status ON projects(wp_publish_status);

