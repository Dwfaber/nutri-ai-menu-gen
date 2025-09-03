-- Criar índices únicos para prevenir duplicatas nas tabelas de receitas

-- Índice único para receitas_legado baseado no receita_id_legado
CREATE UNIQUE INDEX IF NOT EXISTS idx_receitas_legado_unique_receita_id 
ON receitas_legado (receita_id_legado);

-- Índice único composto para receita_ingredientes baseado em receita_id_legado + produto_base_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_receita_ingredientes_unique_key
ON receita_ingredientes (receita_id_legado, produto_base_id);

-- Comentários para documentar os índices
COMMENT ON INDEX idx_receitas_legado_unique_receita_id IS 'Evita duplicatas de receitas baseado no ID legado';
COMMENT ON INDEX idx_receita_ingredientes_unique_key IS 'Evita duplicatas de ingredientes baseado em receita + produto';