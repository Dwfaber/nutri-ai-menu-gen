-- População das tabelas de Guarnições e Saladas (Fase 2)
-- =======================================================

-- 1. Popular tabela de guarnições com categorização automática
INSERT INTO public.guarnicoes_disponiveis (produto_base_id, receita_id_legado, nome, tipo, ativo, prioridade)
SELECT 
    CAST(SPLIT_PART(receita_id_legado, '-', 2) AS INTEGER) as produto_base_id,
    receita_id_legado,
    nome_receita,
    CASE 
        -- Batatas e derivados
        WHEN UPPER(nome_receita) LIKE '%BATATA%' OR UPPER(nome_receita) LIKE '%PURÊ%' THEN 'batatas'
        
        -- Massas
        WHEN UPPER(nome_receita) LIKE '%MACARRÃO%' OR UPPER(nome_receita) LIKE '%NHOQUE%' 
             OR UPPER(nome_receita) LIKE '%MASSA%' OR UPPER(nome_receita) LIKE '%TALHARIM%'
             OR UPPER(nome_receita) LIKE '%LASANHA%' OR UPPER(nome_receita) LIKE '%ESPAGUETE%' THEN 'massas'
        
        -- Raízes e tubérculos
        WHEN UPPER(nome_receita) LIKE '%MANDIOCA%' OR UPPER(nome_receita) LIKE '%INHAME%'
             OR UPPER(nome_receita) LIKE '%MANDIOQUINHA%' OR UPPER(nome_receita) LIKE '%MACAXEIRA%' THEN 'raizes'
        
        -- Cereais e grãos
        WHEN UPPER(nome_receita) LIKE '%ARROZ%' OR UPPER(nome_receita) LIKE '%QUINOA%'
             OR UPPER(nome_receita) LIKE '%POLENTA%' OR UPPER(nome_receita) LIKE '%FARINHA%' THEN 'cereais'
        
        -- Legumes (padrão para outras guarnições)
        ELSE 'legumes'
    END as tipo,
    true as ativo,
    1 as prioridade
FROM public.receitas_legado 
WHERE categoria_descricao = 'Guarnição'
  AND inativa = false
  AND nome_receita IS NOT NULL
  AND receita_id_legado ~ '^[0-9]+-[0-9]+$';

-- 2. Popular tabela de saladas com categorização automática
INSERT INTO public.saladas_disponiveis (produto_base_id, receita_id_legado, nome, tipo, ativo, prioridade)
SELECT 
    CAST(SPLIT_PART(receita_id_legado, '-', 2) AS INTEGER) as produto_base_id,
    receita_id_legado,
    nome_receita,
    CASE 
        -- Molhos e temperos
        WHEN UPPER(nome_receita) LIKE '%MOLHO%' OR UPPER(nome_receita) LIKE '%VINAGRETE%'
             OR UPPER(nome_receita) LIKE '%TEMPERO%' OR UPPER(nome_receita) LIKE '%AZEITE%' THEN 'molhos'
        
        -- Verduras folhas cruas
        WHEN UPPER(nome_receita) LIKE '%ALFACE%' OR UPPER(nome_receita) LIKE '%RÚCULA%'
             OR UPPER(nome_receita) LIKE '%AGRIÃO%' OR UPPER(nome_receita) LIKE '%ALMEIRÃO%'
             OR UPPER(nome_receita) LIKE '%ACELGA%' OR UPPER(nome_receita) LIKE '%COUVE%'
             OR UPPER(nome_receita) LIKE '%ESPINAFRE%' THEN 'verduras_folhas'
        
        -- Legumes cozidos (padrão para outras saladas)
        ELSE 'legumes_cozidos'
    END as tipo,
    true as ativo,
    1 as prioridade
FROM public.receitas_legado 
WHERE (categoria_descricao = 'Salada' OR categoria_descricao = 'Molho')
  AND inativa = false
  AND nome_receita IS NOT NULL
  AND receita_id_legado ~ '^[0-9]+-[0-9]+$';

-- 3. Adicionar colunas de configuração na tabela de contratos (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contratos_corporativos' AND column_name = 'use_guarnicao_batatas') THEN
        ALTER TABLE public.contratos_corporativos 
        ADD COLUMN use_guarnicao_batatas BOOLEAN DEFAULT true,
        ADD COLUMN use_guarnicao_massas BOOLEAN DEFAULT true,
        ADD COLUMN use_guarnicao_legumes BOOLEAN DEFAULT true,
        ADD COLUMN use_guarnicao_raizes BOOLEAN DEFAULT true,
        ADD COLUMN use_guarnicao_cereais BOOLEAN DEFAULT true,
        ADD COLUMN use_salada_verduras BOOLEAN DEFAULT true,
        ADD COLUMN use_salada_legumes_cozidos BOOLEAN DEFAULT true,
        ADD COLUMN use_salada_molhos BOOLEAN DEFAULT true;
    END IF;
END $$;