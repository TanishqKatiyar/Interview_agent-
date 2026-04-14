-- Migration to add hiring score feature column
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS hiring_score jsonb;
