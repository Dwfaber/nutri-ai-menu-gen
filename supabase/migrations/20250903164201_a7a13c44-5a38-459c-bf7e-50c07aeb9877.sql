-- Corrigir sequência desatualizada para co_solicitacao_produto_listagem
-- Primeiro encontrar o máximo ID atual
DO $$
DECLARE
    max_id INTEGER;
BEGIN
    -- Obter o maior ID atual na tabela
    SELECT COALESCE(MAX(solicitacao_produto_listagem_id), 0) + 1 
    INTO max_id 
    FROM co_solicitacao_produto_listagem;
    
    -- Ajustar a sequência para o próximo valor disponível
    PERFORM setval('co_solicitacao_produto_listag_solicitacao_produto_listagem__seq', max_id, false);
    
    -- Log da correção
    INSERT INTO sync_logs (
        tabela_destino, 
        operacao, 
        status, 
        detalhes
    ) VALUES (
        'co_solicitacao_produto_listagem',
        'fix_sequence',
        'concluido',
        jsonb_build_object(
            'sequence_adjusted_to', max_id,
            'fixed_timestamp', now()
        )
    );
END $$;

-- Criar função para estratégia de UPSERT com limpeza
CREATE OR REPLACE FUNCTION upsert_with_cleanup(
    target_table text,
    data_json jsonb,
    unique_columns text[],
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
BEGIN
    -- Construir lista de colunas (excluindo ID auto-incremento)
    SELECT string_agg(key, ', ')
    INTO columns_list
    FROM jsonb_object_keys((data_json->0)) AS key
    WHERE key != 'solicitacao_produto_listagem_id';
    
    -- Construir string de conflito
    conflict_columns := array_to_string(unique_columns, ', ');
    
    -- Processar cada registro
    FOR record_item IN SELECT * FROM jsonb_array_elements(data_json)
    LOOP
        -- Construir VALUES dinamicamente (excluindo ID)
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
        WHERE key != 'solicitacao_produto_listagem_id';
        
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
             ON CONFLICT (%s) DO UPDATE SET %s, criado_em = COALESCE(EXCLUDED.criado_em, %I.criado_em)
             RETURNING (xmax = 0) AS inserted',
            target_table, columns_list, values_list, conflict_columns, update_set, target_table
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
        'strategy', 'upsert_cleanup'
    );
END;
$$ LANGUAGE plpgsql;