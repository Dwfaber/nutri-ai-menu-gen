-- Implementação simplificada do UPSERT com limpeza

-- 1. Remover registros duplicados mantendo apenas o mais recente
DELETE FROM co_solicitacao_produto_listagem 
WHERE solicitacao_produto_listagem_id IN (
  SELECT solicitacao_produto_listagem_id 
  FROM (
    SELECT 
      solicitacao_produto_listagem_id,
      ROW_NUMBER() OVER (
        PARTITION BY solicitacao_id, produto_base_id 
        ORDER BY criado_em DESC
      ) as rn
    FROM co_solicitacao_produto_listagem
    WHERE solicitacao_id IS NOT NULL AND produto_base_id IS NOT NULL
  ) duplicates
  WHERE rn > 1
);

-- 2. Criar função UPSERT simples e eficiente
CREATE OR REPLACE FUNCTION simple_upsert_cleanup(
    target_table text,
    data_json jsonb,
    cleanup_days integer DEFAULT 30
) RETURNS jsonb AS $$
DECLARE
    processed_count integer := 0;
    updated_count integer := 0;
    inserted_count integer := 0;
    cleanup_count integer := 0;
    record_item jsonb;
    existing_record record;
    update_sql text;
    insert_sql text;
    values_sql text;
    columns_sql text;
BEGIN
    -- Processar cada registro
    FOR record_item IN SELECT * FROM jsonb_array_elements(data_json)
    LOOP
        -- Verificar se existe registro com mesma chave natural
        EXECUTE format(
            'SELECT * FROM %I WHERE solicitacao_id = $1 AND produto_base_id = $2',
            target_table
        ) INTO existing_record 
        USING 
            (record_item->>'solicitacao_id')::integer,
            (record_item->>'produto_base_id')::integer;
        
        IF existing_record IS NOT NULL THEN
            -- UPDATE: atualizar registro existente
            update_sql := format(
                'UPDATE %I SET 
                 preco = $1,
                 per_capita = $2,
                 unidade = $3,
                 descricao = $4,
                 grupo = $5,
                 categoria_descricao = $6,
                 apenas_valor_inteiro_sim_nao = $7,
                 arredondar_tipo = $8,
                 produto_base_quantidade_embalagem = $9,
                 em_promocao_sim_nao = $10,
                 criado_em = COALESCE($11::timestamp, criado_em)
                 WHERE solicitacao_id = $12 AND produto_base_id = $13',
                target_table
            );
            
            EXECUTE update_sql USING
                COALESCE((record_item->>'preco')::numeric, 0),
                COALESCE((record_item->>'per_capita')::numeric, 0),
                record_item->>'unidade',
                record_item->>'descricao',
                record_item->>'grupo',
                record_item->>'categoria_descricao',
                COALESCE((record_item->>'apenas_valor_inteiro_sim_nao')::boolean, false),
                COALESCE((record_item->>'arredondar_tipo')::integer, 0),
                COALESCE((record_item->>'produto_base_quantidade_embalagem')::numeric, 0),
                COALESCE((record_item->>'em_promocao_sim_nao')::boolean, false),
                record_item->>'criado_em',
                (record_item->>'solicitacao_id')::integer,
                (record_item->>'produto_base_id')::integer;
                
            updated_count := updated_count + 1;
        ELSE
            -- INSERT: novo registro (sem solicitacao_produto_listagem_id)
            insert_sql := format(
                'INSERT INTO %I (
                    solicitacao_id, solicitacao_produto_categoria_id, produto_id,
                    preco, per_capita, arredondar_tipo, unidade, descricao,
                    grupo, categoria_descricao, produto_base_id, criado_em,
                    produto_base_quantidade_embalagem, apenas_valor_inteiro_sim_nao,
                    em_promocao_sim_nao
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
                target_table
            );
            
            EXECUTE insert_sql USING
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
                COALESCE((record_item->>'em_promocao_sim_nao')::boolean, false);
                
            inserted_count := inserted_count + 1;
        END IF;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    -- Limpeza opcional de registros antigos
    IF cleanup_days > 0 THEN
        EXECUTE format(
            'DELETE FROM %I WHERE criado_em < now() - interval ''%s days''',
            target_table, cleanup_days
        );
        GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    END IF;
    
    RETURN jsonb_build_object(
        'processed_records', processed_count,
        'inserted_records', inserted_count,
        'updated_records', updated_count,
        'cleanup_records', cleanup_count,
        'strategy', 'simple_upsert_cleanup'
    );
END;
$$ LANGUAGE plpgsql SET search_path = public;