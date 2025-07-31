-- Remove a tabela menu_recipes que não é mais necessária
DROP TABLE IF EXISTS menu_recipes;

-- Modificar generated_menus para referenciar receitas_legado diretamente
ALTER TABLE generated_menus 
ADD COLUMN IF NOT EXISTS receitas_ids text[],
ADD COLUMN IF NOT EXISTS receitas_adaptadas jsonb DEFAULT '[]'::jsonb;