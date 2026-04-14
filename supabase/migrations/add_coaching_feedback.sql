-- Migration: Add coaching_feedback column
-- Feature 1: Post-interview coaching feedback for candidates

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS coaching_feedback jsonb;

-- Add comment for documentation
COMMENT ON COLUMN interviews.coaching_feedback IS 'JSON array of coaching tips generated post-assessment: [{type: "strength"|"tip", text: "..."}]';
