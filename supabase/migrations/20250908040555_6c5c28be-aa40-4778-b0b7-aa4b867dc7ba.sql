-- Corrigir população das tabelas de Guarnições e Saladas
-- ===================================================

-- 1. Popular tabela de guarnições com categorização automática (versão corrigida)
INSERT INTO public.guarnicoes_disponiveis (produto_base_id, receita_id_legado, nome, tipo, ativo, prioridade)
SELECT 
    CAST(receita_id_legado AS INTEGER) as produto_base_id,
    receita_id_legado,
    nome_receita,
    CASE 
        -- Batatas e derivados
        WHEN UPPER(nome_receita) LIKE '%BATATA%' OR UPPER(nome_receita) LIKE '%PURÊ%' THEN 'batatas'
        
        -- Massas
        WHEN UPPER(nome_receita) LIKE '%MACARRÃO%' OR UPPER(nome_receita) LIKE '%NHOQUE%' 
             OR UPPER(nome_receita) LIKE '%MASSA%' OR UPPER(nome_receita) LIKE '%TALHARIM%'
             OR UPPER(nome_receita) LIKE '%LASANHA%' OR UPPER(nome_receita) LIKE '%ESPAGUETE%' 
             OR UPPER(nome_receita) LIKE '%CUSCUZ%' THEN 'massas'
        
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
  AND receita_id_legado ~ '^[0-9]+$';

-- 2. Popular tabela de saladas com categorização automática (versão corrigida)
INSERT INTO public.saladas_disponiveis (produto_base_id, receita_id_legado, nome, tipo, ativo, prioridade)
SELECT 
    CAST(receita_id_legado AS INTEGER) as produto_base_id,
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
  AND receita_id_legado ~ '^[0-9]+$';