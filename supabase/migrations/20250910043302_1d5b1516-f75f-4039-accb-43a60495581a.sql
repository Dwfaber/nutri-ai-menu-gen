-- Add meals_per_day column to generated_menus table
ALTER TABLE generated_menus 
ADD COLUMN meals_per_day integer NOT NULL DEFAULT 1;