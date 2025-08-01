-- Corrigir warning de segurança: definir search_path para a função de limpeza
CREATE OR REPLACE FUNCTION public.cleanup_old_product_versions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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