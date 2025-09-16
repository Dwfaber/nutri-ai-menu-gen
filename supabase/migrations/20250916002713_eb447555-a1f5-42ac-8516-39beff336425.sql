-- Adicionar a coluna menu_data que está sendo referenciada no código
ALTER TABLE public.generated_menus 
ADD COLUMN IF NOT EXISTS menu_data jsonb DEFAULT NULL;

-- Adicionar as colunas recipes e warnings que também estão sendo referenciadas
ALTER TABLE public.generated_menus 
ADD COLUMN IF NOT EXISTS recipes jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.generated_menus 
ADD COLUMN IF NOT EXISTS warnings jsonb DEFAULT '[]'::jsonb;