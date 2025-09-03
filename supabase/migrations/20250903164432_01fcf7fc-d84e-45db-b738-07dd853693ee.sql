-- Criar índice único composto para co_solicitacao_produto_listagem
-- Isso permitirá que a função upsert_with_cleanup funcione corretamente

-- Primeiro verificar se o índice já existe
DO $$
BEGIN
  -- Criar índice único para (solicitacao_id, produto_base_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'co_solicitacao_produto_listagem' 
    AND indexname = 'idx_co_solicitacao_unique_key'
  ) THEN
    CREATE UNIQUE INDEX idx_co_solicitacao_unique_key 
    ON co_solicitacao_produto_listagem (solicitacao_id, produto_base_id)
    WHERE solicitacao_id IS NOT NULL AND produto_base_id IS NOT NULL;
  END IF;
END $$;

-- Atualizar função upsert_with_cleanup para lidar melhor com casos onde unique columns não existem
CREATE OR REPLACE FUNCTION upsert_with_cleanup_safe(
    target_table text,
    data_json jsonb,
    unique_columns text[] DEFAULT ARRAY['solicitacao_id', 'produto_base_id'],
    cleanup_days integer DEFAULT 30
) RETURNS jsonb AS $$
DECLARE
    result jsonb := '{}';
    record_item jsonb;
    upsert_query text;
    cleanup_query text;
    columns_list text;
    values_list text;
    conflict_columns text;
    update_set text;
    processed_count integer := 0;
    updated_count integer := 0;
    inserted_count integer := 0;
    cleanup_count integer := 0;
    has_conflict_target boolean := false;
BEGIN
    -- Verificar se a tabela tem as colunas de conflito necessárias
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = target_table 
        AND column_name = ANY(unique_columns)
        AND table_schema = 'public'
    ) INTO has_conflict_target;
    
    -- Se não tiver as colunas necessárias, usar UPSERT simples com ID
    IF NOT has_conflict_target THEN
        unique_columns := ARRAY['solicitacao_produto_listagem_id'];
    END IF;
    
    -- Construir lista de colunas (excluindo ID auto-incremento se usando chave natural)
    SELECT string_agg(key, ', ')
    INTO columns_list
    FROM jsonb_object_keys((data_json->0)) AS key
    WHERE CASE 
        WHEN unique_columns = ARRAY['solicitacao_produto_listagem_id'] THEN key != 'solicitacao_produto_listagem_id'
        ELSE true
    END;
    
    -- Construir string de conflito
    conflict_columns := array_to_string(unique_columns, ', ');
    
    -- Processar cada registro
    FOR record_item IN SELECT * FROM jsonb_array_elements(data_json)
    LOOP
        -- Construir VALUES dinamicamente
        SELECT string_agg(
            CASE 
                WHEN jsonb_typeof(record_item->key) = 'string' 
                THEN quote_literal(record_item->>key)
                WHEN record_item->key = 'null'::jsonb
                THEN 'NULL'
                ELSE (record_item->>key)
            END, 
            ', '
        )
        INTO values_list
        FROM jsonb_object_keys(record_item) AS key
        WHERE CASE 
            WHEN unique_columns = ARRAY['solicitacao_produto_listagem_id'] 
            THEN key != 'solicitacao_produto_listagem_id'
            ELSE true
        END;
        
        -- Construir UPDATE SET clause
        SELECT string_agg(
            key || ' = EXCLUDED.' || key, 
            ', '
        )
        INTO update_set
        FROM jsonb_object_keys(record_item) AS key
        WHERE key NOT IN ('solicitacao_produto_listagem_id', 'criado_em') 
        AND key != ALL(unique_columns);
        
        -- Executar UPSERT
        upsert_query := format(
            'INSERT INTO %I (%s) VALUES (%s) 
             ON CONFLICT (%s) DO UPDATE SET %s
             RETURNING (xmax = 0) AS inserted',
            target_table, columns_list, values_list, conflict_columns, update_set
        );
        
        EXECUTE upsert_query INTO result;
        
        processed_count := processed_count + 1;
        
        IF (result->>'inserted')::boolean THEN
            inserted_count := inserted_count + 1;
        ELSE
            updated_count := updated_count + 1;
        END IF;
    END LOOP;
    
    -- Limpeza de registros órfãos (mais antigos que cleanup_days)
    IF cleanup_days > 0 THEN
        cleanup_query := format(
            'DELETE FROM %I WHERE criado_em < now() - interval ''%s days'' 
             AND solicitacao_id NOT IN (
                 SELECT DISTINCT solicitacao_id 
                 FROM %I 
                 WHERE criado_em >= now() - interval ''7 days''
             )',
            target_table, cleanup_days, target_table
        );
        
        EXECUTE cleanup_query;
        GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    END IF;
    
    RETURN jsonb_build_object(
        'processed_records', processed_count,
        'inserted_records', inserted_count,
        'updated_records', updated_count,
        'cleanup_records', cleanup_count,
        'strategy', 'upsert_cleanup',
        'conflict_columns', conflict_columns
    );
END;
$$ LANGUAGE plpgsql SET search_path = public;