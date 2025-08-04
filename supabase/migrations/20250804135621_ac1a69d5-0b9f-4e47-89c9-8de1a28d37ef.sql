-- Add columns to generated_menus table for violation approval tracking
ALTER TABLE generated_menus 
ADD COLUMN approved_violations jsonb DEFAULT '[]'::jsonb,
ADD COLUMN nutritionist_suggestions jsonb DEFAULT '{}'::jsonb,
ADD COLUMN violation_notes text;