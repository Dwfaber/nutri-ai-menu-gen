-- Limpeza da tabela custos_filiais: manter apenas um registro por empresa-filial
-- Critério: maior custo diário, depois mais recente, depois menor ID

-- Primeiro, fazer backup dos registros que serão removidos
INSERT INTO custos_filiais_backup_duplicatas 
SELECT * FROM custos_filiais 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY nome_fantasia, filial_id 
      ORDER BY 
        GREATEST(
          COALESCE("RefCustoSegunda", 0),
          COALESCE("RefCustoTerca", 0), 
          COALESCE("RefCustoQuarta", 0),
          COALESCE("RefCustoQuinta", 0),
          COALESCE("RefCustoSexta", 0),
          COALESCE("RefCustoSabado", 0),
          COALESCE("RefCustoDomingo", 0)
        ) DESC,
        updated_at DESC,
        id ASC
    ) as rn
    FROM custos_filiais
  ) ranked
  WHERE rn = 1
);

-- Agora deletar os registros duplicados, mantendo apenas um por empresa-filial
DELETE FROM custos_filiais 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY nome_fantasia, filial_id 
      ORDER BY 
        GREATEST(
          COALESCE("RefCustoSegunda", 0),
          COALESCE("RefCustoTerca", 0), 
          COALESCE("RefCustoQuarta", 0),
          COALESCE("RefCustoQuinta", 0),
          COALESCE("RefCustoSexta", 0),
          COALESCE("RefCustoSabado", 0),
          COALESCE("RefCustoDomingo", 0)
        ) DESC,
        updated_at DESC,
        id ASC
    ) as rn
    FROM custos_filiais
  ) ranked
  WHERE rn = 1
);

-- Log da operação de limpeza
INSERT INTO sync_logs (
  tabela_destino, 
  operacao, 
  status, 
  detalhes
) VALUES (
  'custos_filiais',
  'cleanup_duplicates',
  'concluido',
  jsonb_build_object(
    'cleanup_timestamp', now(),
    'remaining_records', (SELECT COUNT(*) FROM custos_filiais),
    'backup_records', (SELECT COUNT(*) FROM custos_filiais_backup_duplicatas),
    'criteria', 'highest_daily_cost_then_recent_then_lowest_id'
  )
);