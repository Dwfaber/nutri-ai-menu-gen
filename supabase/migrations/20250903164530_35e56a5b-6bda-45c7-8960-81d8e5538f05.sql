-- Limpeza de dados duplicados e implementação de UPSERT seguro

-- 1. Primeiro, vamos identificar e remover registros duplicados
WITH duplicates AS (
  SELECT 
    solicitacao_produto_listagem_id,
    ROW_NUMBER() OVER (
      PARTITION BY solicitacao_id, produto_base_id 
      ORDER BY criado_em DESC
    ) as rn
  FROM co_solicitacao_produto_listagem
  WHERE solicitacao_id IS NOT NULL AND produto_base_id IS NOT NULL
),
to_delete AS (
  SELECT solicitacao_produto_listagem_id 
  FROM duplicates 
  WHERE rn > 1
)
DELETE FROM co_solicitacao_produto_listagem 
WHERE solicitacao_produto_listagem_id IN (SELECT solicitacao_produto_listagem_id FROM to_delete);

-- 2. Agora criar o índice único
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_co_solicitacao_unique_key 
ON co_solicitacao_produto_listagem (solicitacao_id, produto_base_id)
WHERE solicitacao_id IS NOT NULL AND produto_base_id IS NOT NULL;

-- 3. Atualizar função para usar a nova função mais segura
CREATE OR REPLACE FUNCTION smart_upsert_with_cleanup(
    target_table text,
    data_json jsonb,
    unique_columns text[] DEFAULT ARRAY['solicitacao_id', 'produto_base_id'],
    cleanup_days integer DEFAULT 30
) RETURNS jsonb AS $$
DECLARE
    result_summary jsonb;
    processed_count integer := 0;
    updated_count integer := 0;
    inserted_count integer := 0;
    cleanup_count integer := 0;
    record_item jsonb;
    existing_id integer;
    insert_data jsonb;
BEGIN
    -- Processar cada registro individualmente com UPSERT inteligente
    FOR record_item IN SELECT * FROM jsonb_array_elements(data_json)
    LOOP
        -- Verificar se registro já existe baseado na chave natural
        EXECUTE format(
            'SELECT solicitacao_produto_listagem_id FROM %I WHERE solicitacao_id = %L AND produto_base_id = %L',
            target_table,
            record_item->>'solicitacao_id',
            record_item->>'produto_base_id'
        ) INTO existing_id;
        
        -- Remover o ID do JSON para inserção/atualização
        insert_data := record_item - 'solicitacao_produto_listagem_id';
        
        IF existing_id IS NOT NULL THEN
            -- UPDATE: registro existe
            EXECUTE format(
                'UPDATE %I SET %s WHERE solicitacao_produto_listagem_id = %L',
                target_table,
                (
                    SELECT string_agg(format('%I = %L', key, value), ', ')
                    FROM jsonb_each_text(insert_data)
                    WHERE key NOT IN ('solicitacao_id', 'produto_base_id')
                ),
                existing_id
            );
            updated_count := updated_count + 1;
        ELSE
            -- INSERT: novo registro
            EXECUTE format(
                'INSERT INTO %I (%s) VALUES (%s)',
                target_table,
                (SELECT string_agg(quote_ident(key), ', ') FROM jsonb_object_keys(insert_data) key),
                (SELECT string_agg(quote_literal(value), ', ') FROM jsonb_each_text(insert_data) value)
            );
            inserted_count := inserted_count + 1;
        END IF;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    -- Limpeza de registros órfãos se solicitado
    IF cleanup_days > 0 THEN
        EXECUTE format(
            'DELETE FROM %I WHERE criado_em < now() - interval ''%s days''',
            target_table, cleanup_days
        );
        GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    END IF;
    
    -- Log da operação
    INSERT INTO sync_logs (
        tabela_destino, 
        operacao, 
        status, 
        registros_processados,
        detalhes
    ) VALUES (
        target_table,
        'smart_upsert_cleanup',
        'concluido',
        processed_count,
        jsonb_build_object(
            'processed_records', processed_count,
            'inserted_records', inserted_count,
            'updated_records', updated_count,
            'cleanup_records', cleanup_count,
            'strategy', 'smart_upsert_cleanup'
        )
    );
    
    RETURN jsonb_build_object(
        'processed_records', processed_count,
        'inserted_records', inserted_count,
        'updated_records', updated_count,
        'cleanup_records', cleanup_count,
        'strategy', 'smart_upsert_cleanup'
    );
END;
$$ LANGUAGE plpgsql SET search_path = public;