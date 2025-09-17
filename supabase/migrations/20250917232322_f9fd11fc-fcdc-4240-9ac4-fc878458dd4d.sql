-- Add missing ingredientes column to receitas_legado to match payload from sync
ALTER TABLE public.receitas_legado
ADD COLUMN IF NOT EXISTS ingredientes jsonb NOT NULL DEFAULT '[]'::jsonb;