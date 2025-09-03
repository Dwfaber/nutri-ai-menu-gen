-- Limpar registros duplicados da tabela co_solicitacao_produto_listagem
-- Manter apenas o registro mais recente de cada combinação solicitacao_id + produto_base_id

DO $$
DECLARE
    total_count INTEGER;
    unique_count INTEGER;
    duplicates_count INTEGER;
    cleaned_count INTEGER;
BEGIN
    -- Contar total de registros
    SELECT COUNT(*) INTO total_count FROM co_solicitacao_produto_listagem;
    
    -- Contar registros únicos por combinação solicitacao_id + produto_base_id
    SELECT COUNT(DISTINCT (COALESCE(solicitacao_id, 0), COALESCE(produto_base_id, 0)))
    INTO unique_count
    FROM co_solicitacao_produto_listagem
    WHERE produto_base_id IS NOT NULL;
    
    duplicates_count := total_count - unique_count;
    
    RAISE NOTICE 'Total de registros: %, Únicos: %, Duplicatas: %', total_count, unique_count, duplicates_count;
    
    -- Remover duplicatas mantendo apenas o registro mais recente
    WITH ranked_records AS (
        SELECT solicitacao_produto_listagem_id,
               ROW_NUMBER() OVER (
                   PARTITION BY COALESCE(solicitacao_id, 0), COALESCE(produto_base_id, 0) 
                   ORDER BY criado_em DESC NULLS LAST, solicitacao_produto_listagem_id DESC
               ) as rn
        FROM co_solicitacao_produto_listagem
        WHERE produto_base_id IS NOT NULL
    ),
    duplicates_to_delete AS (
        SELECT solicitacao_produto_listagem_id
        FROM ranked_records
        WHERE rn > 1
    )
    DELETE FROM co_solicitacao_produto_listagem
    WHERE solicitacao_produto_listagem_id IN (
        SELECT solicitacao_produto_listagem_id FROM duplicates_to_delete
    );
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RAISE NOTICE 'Registros duplicados removidos: %', cleaned_count;
    
    -- Log da operação de limpeza
    INSERT INTO sync_logs (
        tabela_destino,
        operacao,
        status,
        registros_processados,
        detalhes
    ) VALUES (
        'co_solicitacao_produto_listagem',
        'cleanup_duplicates',
        'concluido',
        cleaned_count,
        jsonb_build_object(
            'total_before', total_count,
            'unique_records', unique_count,
            'duplicates_found', duplicates_count,
            'records_removed', cleaned_count,
            'cleanup_strategy', 'keep_most_recent_by_solicitacao_produto_base',
            'cleanup_date', now()
        )
    );
    
    -- Verificar contagem final
    SELECT COUNT(*) INTO total_count FROM co_solicitacao_produto_listagem;
    RAISE NOTICE 'Registros restantes após limpeza: %', total_count;
    
END $$;