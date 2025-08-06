
-- Adicionar colunas quantidade_refeicoes e categoria_descricao na tabela receita_ingredientes
ALTER TABLE receita_ingredientes 
ADD COLUMN quantidade_refeicoes INTEGER DEFAULT 1,
ADD COLUMN categoria_descricao TEXT;

-- Popular as novas colunas com dados da tabela receitas_legado
UPDATE receita_ingredientes ri
SET 
  quantidade_refeicoes = rl.quantidade_refeicoes,
  categoria_descricao = rl.categoria_descricao
FROM receitas_legado rl
WHERE ri.receita_id_legado = rl.receita_id_legado;

-- Criar índice para otimizar consultas por receita_id_legado
CREATE INDEX IF NOT EXISTS idx_receita_ingredientes_receita_id_legado 
ON receita_ingredientes(receita_id_legado);
