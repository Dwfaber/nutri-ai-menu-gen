-- Adicionar coluna meals_per_day que estava faltando
ALTER TABLE public.generated_menus 
ADD COLUMN IF NOT EXISTS meals_per_day integer DEFAULT 50;