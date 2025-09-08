-- Fase 2: Criação das tabelas de Guarnições e Saladas
-- =====================================================

-- 1. Criar tabela de guarnições disponíveis
CREATE TABLE public.guarnicoes_disponiveis (
    produto_base_id INTEGER PRIMARY KEY,
    receita_id_legado TEXT NOT NULL REFERENCES public.receitas_legado(receita_id_legado),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'batatas', 'massas', 'legumes', 'raizes', 'cereais'
    ativo BOOLEAN DEFAULT TRUE,
    prioridade INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de saladas disponíveis
CREATE TABLE public.saladas_disponiveis (
    produto_base_id INTEGER PRIMARY KEY,
    receita_id_legado TEXT NOT NULL REFERENCES public.receitas_legado(receita_id_legado),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'verduras_folhas', 'legumes_cozidos', 'molhos'
    ativo BOOLEAN DEFAULT TRUE,
    prioridade INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS nas tabelas
ALTER TABLE public.guarnicoes_disponiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saladas_disponiveis ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas RLS para guarnições
CREATE POLICY "Admins podem gerenciar guarnições disponíveis" 
ON public.guarnicoes_disponiveis 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos podem visualizar guarnições disponíveis" 
ON public.guarnicoes_disponiveis 
FOR SELECT 
USING (true);

-- 5. Criar políticas RLS para saladas
CREATE POLICY "Admins podem gerenciar saladas disponíveis" 
ON public.saladas_disponiveis 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos podem visualizar saladas disponíveis" 
ON public.saladas_disponiveis 
FOR SELECT 
USING (true);

-- 6. Popular tabela de guarnições com categorização automática
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

-- 7. Popular tabela de saladas com categorização automática
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

-- 8. Criar índices para performance
CREATE INDEX idx_guarnicoes_tipo ON public.guarnicoes_disponiveis(tipo);
CREATE INDEX idx_guarnicoes_ativo ON public.guarnicoes_disponiveis(ativo);
CREATE INDEX idx_saladas_tipo ON public.saladas_disponiveis(tipo);
CREATE INDEX idx_saladas_ativo ON public.saladas_disponiveis(ativo);

-- 9. Adicionar colunas de configuração na tabela de contratos
ALTER TABLE public.contratos_corporativos 
ADD COLUMN IF NOT EXISTS use_guarnicao_batatas BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS use_guarnicao_massas BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS use_guarnicao_legumes BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS use_guarnicao_raizes BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS use_guarnicao_cereais BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS use_salada_verduras BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS use_salada_legumes_cozidos BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS use_salada_molhos BOOLEAN DEFAULT true;