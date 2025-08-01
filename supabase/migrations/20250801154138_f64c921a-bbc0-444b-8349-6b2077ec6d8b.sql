-- Otimizar performance da tabela co_solicitacao_produto_listagem com índices estratégicos

-- Índice composto para consultas por solicitacao_id (para versionamento)
CREATE INDEX IF NOT EXISTS idx_co_solicitacao_produto_listagem_solicitacao_id 
ON co_solicitacao_produto_listagem (solicitacao_id);

-- Índice para produto_id (consultas por produto específico)
CREATE INDEX IF NOT EXISTS idx_co_solicitacao_produto_listagem_produto_id 
ON co_solicitacao_produto_listagem (produto_id);

-- Índice composto para categoria + grupo (consultas por categoria/grupo)
CREATE INDEX IF NOT EXISTS idx_co_solicitacao_produto_listagem_categoria_grupo 
ON co_solicitacao_produto_listagem (categoria_descricao, grupo);

-- Índice para created_at (consultas temporais)
CREATE INDEX IF NOT EXISTS idx_co_solicitacao_produto_listagem_created_at 
ON co_solicitacao_produto_listagem (criado_em);

-- Índice para consultas de limpeza (produtos obsoletos)
CREATE INDEX IF NOT EXISTS idx_co_solicitacao_produto_listagem_obsoletos 
ON co_solicitacao_produto_listagem (solicitacao_id, criado_em) 
WHERE solicitacao_id = -1;

-- Função para limpar versões antigas automaticamente (manter apenas as 5 últimas)
CREATE OR REPLACE FUNCTION public.cleanup_old_product_versions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  versions_to_keep INTEGER := 5;
  old_versions INTEGER[];
BEGIN
  -- Obter IDs de solicitação antigos (manter apenas os últimos 5)
  SELECT ARRAY(
    SELECT DISTINCT solicitacao_id 
    FROM co_solicitacao_produto_listagem 
    WHERE solicitacao_id > 0
    ORDER BY solicitacao_id DESC 
    OFFSET versions_to_keep
  ) INTO old_versions;
  
  -- Remover versões antigas se existirem
  IF array_length(old_versions, 1) > 0 THEN
    DELETE FROM co_solicitacao_produto_listagem 
    WHERE solicitacao_id = ANY(old_versions);
    
    -- Log da limpeza
    INSERT INTO sync_logs (
      tabela_destino, 
      operacao, 
      status, 
      detalhes
    ) VALUES (
      'co_solicitacao_produto_listagem',
      'cleanup_old_versions',
      'concluido',
      jsonb_build_object(
        'versions_removed', old_versions,
        'versions_kept', versions_to_keep,
        'cleanup_timestamp', now()
      )
    );
  END IF;
END;
$$;

-- Comentários explicativos
COMMENT ON INDEX idx_co_solicitacao_produto_listagem_solicitacao_id IS 'Índice para consultas por versão de solicitação - otimiza replace all';
COMMENT ON INDEX idx_co_solicitacao_produto_listagem_produto_id IS 'Índice para consultas por produto específico';
COMMENT ON INDEX idx_co_solicitacao_produto_listagem_categoria_grupo IS 'Índice composto para filtros por categoria e grupo';
COMMENT ON FUNCTION public.cleanup_old_product_versions() IS 'Função para limpeza automática de versões antigas da tabela de produtos';