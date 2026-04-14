-- Migration to add deep intelligence feature columns
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS speech_analytics jsonb,
ADD COLUMN IF NOT EXISTS integrity_report jsonb,
ADD COLUMN IF NOT EXISTS interview_quality jsonb;
