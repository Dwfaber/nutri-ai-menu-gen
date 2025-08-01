-- Add nome column to receita_ingredientes table
ALTER TABLE receita_ingredientes 
ADD COLUMN nome TEXT;

-- Create index for better performance when querying by recipe name
CREATE INDEX idx_receita_ingredientes_nome ON receita_ingredientes(nome);

-- Create index for better performance when joining with receitas_legado
CREATE INDEX IF NOT EXISTS idx_receita_ingredientes_receita_id_legado ON receita_ingredientes(receita_id_legado);
CREATE INDEX IF NOT EXISTS idx_receitas_legado_receita_id_legado ON receitas_legado(receita_id_legado);