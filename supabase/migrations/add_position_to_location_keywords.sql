-- Add position tracking columns to location_keywords table
-- Position is the Google ranking position (1-100+)
-- last_position_check is when we last checked the ranking

ALTER TABLE location_keywords
ADD COLUMN IF NOT EXISTS position INTEGER,
ADD COLUMN IF NOT EXISTS last_position_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS previous_position INTEGER;

COMMENT ON COLUMN location_keywords.position IS 'Current Google ranking position (1-100+). NULL if not ranked or not yet checked.';
COMMENT ON COLUMN location_keywords.last_position_check IS 'Timestamp of last position check via DataForSEO SERP API.';
COMMENT ON COLUMN location_keywords.previous_position IS 'Previous ranking position for tracking movement.';

