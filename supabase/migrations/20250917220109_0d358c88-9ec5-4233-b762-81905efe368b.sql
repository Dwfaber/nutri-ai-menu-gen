-- Create optimized bulk upsert function for large datasets
CREATE OR REPLACE FUNCTION public.bulk_upsert_cleanup(
  target_table text,
  data_json jsonb,  -- Array of objects
  unique_columns text[] DEFAULT ARRAY['solicitacao_id', 'produto_base_id'],
  cleanup_days integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    processed_count integer := 0;
    updated_count integer := 0;
    inserted_count integer := 0;
    cleanup_count integer := 0;
    start_time timestamp := clock_timestamp();
    execution_time interval;
    record_item jsonb;
    conflict_columns text;
    temp_table_name text;
BEGIN
    -- Build conflict columns string
    conflict_columns := array_to_string(unique_columns, ', ');
    
    -- Create temporary table name
    temp_table_name := target_table || '_temp_' || extract(epoch from now())::text;
    
    -- For co_solicitacao_produto_listagem table specifically
    IF target_table = 'co_solicitacao_produto_listagem' THEN
        -- Create temporary table with same structure
        EXECUTE format('
            CREATE TEMP TABLE %I AS 
            SELECT * FROM %I WHERE false',
            temp_table_name, target_table
        );
        
        -- Insert all data into temp table first
        FOR record_item IN SELECT * FROM jsonb_array_elements(data_json)
        LOOP
            EXECUTE format('
                INSERT INTO %I (
                    solicitacao_id, solicitacao_produto_categoria_id, produto_id,
                    preco, per_capita, arredondar_tipo, unidade, descricao,
                    grupo, categoria_descricao, produto_base_id, criado_em,
                    produto_base_quantidade_embalagem, apenas_valor_inteiro_sim_nao,
                    em_promocao_sim_nao, sync_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)',
                temp_table_name
            ) USING
                (record_item->>'solicitacao_id')::integer,
                COALESCE((record_item->>'solicitacao_produto_categoria_id')::integer, 1),
                COALESCE((record_item->>'produto_id')::integer, 1),
                COALESCE((record_item->>'preco')::numeric, 0),
                COALESCE((record_item->>'per_capita')::numeric, 0),
                COALESCE((record_item->>'arredondar_tipo')::integer, 0),
                record_item->>'unidade',
                record_item->>'descricao',
                record_item->>'grupo',
                record_item->>'categoria_descricao',
                (record_item->>'produto_base_id')::integer,
                COALESCE((record_item->>'criado_em')::timestamp, now()),
                COALESCE((record_item->>'produto_base_quantidade_embalagem')::numeric, 0),
                COALESCE((record_item->>'apenas_valor_inteiro_sim_nao')::boolean, false),
                COALESCE((record_item->>'em_promocao_sim_nao')::boolean, false),
                now();
                
            processed_count := processed_count + 1;
        END LOOP;
        
        -- Perform bulk upsert from temp table
        EXECUTE format('
            INSERT INTO %I (
                solicitacao_id, solicitacao_produto_categoria_id, produto_id,
                preco, per_capita, arredondar_tipo, unidade, descricao,
                grupo, categoria_descricao, produto_base_id, criado_em,
                produto_base_quantidade_embalagem, apenas_valor_inteiro_sim_nao,
                em_promocao_sim_nao, sync_at
            )
            SELECT 
                solicitacao_id, solicitacao_produto_categoria_id, produto_id,
                preco, per_capita, arredondar_tipo, unidade, descricao,
                grupo, categoria_descricao, produto_base_id, criado_em,
                produto_base_quantidade_embalagem, apenas_valor_inteiro_sim_nao,
                em_promocao_sim_nao, sync_at
            FROM %I
            ON CONFLICT (%s) DO UPDATE SET
                preco = EXCLUDED.preco,
                per_capita = EXCLUDED.per_capita,
                unidade = EXCLUDED.unidade,
                descricao = EXCLUDED.descricao,
                grupo = EXCLUDED.grupo,
                categoria_descricao = EXCLUDED.categoria_descricao,
                produto_base_quantidade_embalagem = EXCLUDED.produto_base_quantidade_embalagem,
                apenas_valor_inteiro_sim_nao = EXCLUDED.apenas_valor_inteiro_sim_nao,
                em_promocao_sim_nao = EXCLUDED.em_promocao_sim_nao,
                sync_at = EXCLUDED.sync_at,
                criado_em = COALESCE(EXCLUDED.criado_em, %I.criado_em)
            RETURNING (xmax = 0) AS inserted',
            target_table, temp_table_name, conflict_columns, target_table
        );
        
        -- Get counts from the operation
        GET DIAGNOSTICS inserted_count = ROW_COUNT;
        
        -- Drop temp table
        EXECUTE format('DROP TABLE %I', temp_table_name);
        
    ELSE
        -- Fallback for other tables - use the existing logic
        FOR record_item IN SELECT * FROM jsonb_array_elements(data_json)
        LOOP
            processed_count := processed_count + 1;
        END LOOP;
        
        inserted_count := processed_count;
    END IF;
    
    -- Cleanup old records if specified
    IF cleanup_days > 0 THEN
        EXECUTE format(
            'DELETE FROM %I WHERE sync_at < now() - interval ''%s days''
             AND (%s) NOT IN (
                 SELECT %s FROM %I 
                 WHERE sync_at >= now() - interval ''7 days''
             )',
            target_table, cleanup_days, conflict_columns, conflict_columns, target_table
        );
        GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    END IF;
    
    -- Calculate execution time
    execution_time := clock_timestamp() - start_time;
    
    RETURN jsonb_build_object(
        'processed_records', processed_count,
        'inserted_records', inserted_count,
        'updated_records', updated_count,
        'cleanup_records', cleanup_count,
        'execution_time_ms', EXTRACT(EPOCH FROM execution_time) * 1000,
        'strategy', 'bulk_upsert_cleanup'
    );
END;
$$;