-- Primeiro, limpar duplicatas antes de criar os índices únicos

-- Remover duplicatas da tabela receita_ingredientes
-- Manter apenas o registro mais recente de cada combinação receita_id_legado + produto_base_id
DELETE FROM receita_ingredientes 
WHERE id NOT IN (
  SELECT DISTINCT ON (receita_id_legado, produto_base_id) id
  FROM receita_ingredientes 
  ORDER BY receita_id_legado, produto_base_id, created_at DESC
);

-- Remover duplicatas da tabela receitas_legado
-- Manter apenas o registro mais recente de cada receita_id_legado
DELETE FROM receitas_legado 
WHERE id NOT IN (
  SELECT DISTINCT ON (receita_id_legado) id
  FROM receitas_legado 
  ORDER BY receita_id_legado, created_at DESC
);

-- Agora criar os índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS idx_receitas_legado_unique_receita_id 
ON receitas_legado (receita_id_legado);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receita_ingredientes_unique_key
ON receita_ingredientes (receita_id_legado, produto_base_id);

-- Comentários para documentar os índices
COMMENT ON INDEX idx_receitas_legado_unique_receita_id IS 'Evita duplicatas de receitas baseado no ID legado';
COMMENT ON INDEX idx_receita_ingredientes_unique_key IS 'Evita duplicatas de ingredientes baseado em receita + produto';