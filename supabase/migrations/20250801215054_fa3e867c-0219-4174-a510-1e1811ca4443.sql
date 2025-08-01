-- Add missing columns to shopping_list_items table
ALTER TABLE public.shopping_list_items 
ADD COLUMN promocao BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN optimized BOOLEAN NOT NULL DEFAULT false;