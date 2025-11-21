-- Add blog_url field to projects table
-- This stores the root URL where blog posts are published (e.g., https://example.com/blog)
-- Combined with the slug, this creates the full URL for rank tracking

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS blog_url TEXT;

COMMENT ON COLUMN projects.blog_url IS 'Root URL where blog posts are published (e.g., https://example.com/blog). Combined with slug for rank tracking.';

