-- Primeiro, vamos criar uma tabela de backup das duplicatas que serão removidas
CREATE TABLE IF NOT EXISTS custos_filiais_backup_duplicatas AS
SELECT * FROM custos_filiais WHERE 1=0;

-- Inserir duplicatas na tabela de backup (mantendo apenas registros que serão deletados)
WITH duplicates_to_remove AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        filial_id, 
        cliente_id_legado, 
        nome_fantasia, 
        COALESCE(nome_filial, ''), 
        solicitacao_compra_tipo_descricao
      ORDER BY created_at DESC, updated_at DESC
    ) as rn
  FROM custos_filiais
)
INSERT INTO custos_filiais_backup_duplicatas
SELECT cf.* 
FROM custos_filiais cf
INNER JOIN duplicates_to_remove dtr ON cf.id = dtr.id
WHERE dtr.rn > 1;

-- Agora remover as duplicatas, mantendo apenas o registro mais recente de cada grupo
WITH duplicates_to_remove AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        filial_id, 
        cliente_id_legado, 
        nome_fantasia, 
        COALESCE(nome_filial, ''), 
        solicitacao_compra_tipo_descricao
      ORDER BY created_at DESC, updated_at DESC
    ) as rn
  FROM custos_filiais
)
DELETE FROM custos_filiais 
WHERE id IN (
  SELECT id FROM duplicates_to_remove WHERE rn > 1
);

-- Criar índice único composto para prevenir futuras duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_custos_filiais_unique_combination
ON custos_filiais (
  filial_id, 
  cliente_id_legado, 
  nome_fantasia, 
  COALESCE(nome_filial, ''), 
  solicitacao_compra_tipo_descricao
);

-- Criar índices para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_custos_filiais_cliente_id_legado 
ON custos_filiais (cliente_id_legado);

CREATE INDEX IF NOT EXISTS idx_custos_filiais_nome_fantasia 
ON custos_filiais (nome_fantasia);

-- Adicionar comentários para documentar as mudanças
COMMENT ON INDEX idx_custos_filiais_unique_combination IS 'Previne duplicatas baseado na combinação única de filial, cliente, nome fantasia, nome filial e tipo de solicitação';

COMMENT ON TABLE custos_filiais_backup_duplicatas IS 'Backup dos registros duplicados removidos da tabela custos_filiais';