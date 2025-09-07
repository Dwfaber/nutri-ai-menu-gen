-- Criar tabela para proteínas disponíveis
CREATE TABLE public.proteinas_disponiveis (
  produto_base_id INTEGER NOT NULL PRIMARY KEY,
  receita_id_legado TEXT NOT NULL REFERENCES receitas_legado(receita_id_legado),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('carne_vermelha', 'carne_suina', 'frango', 'peixe', 'ovo', 'vegetariano')),
  subcategoria TEXT NOT NULL CHECK (subcategoria IN ('principal_1', 'principal_2')),
  prioridade INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.proteinas_disponiveis ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Todos podem visualizar proteínas disponíveis" 
ON public.proteinas_disponiveis 
FOR SELECT 
USING (true);

CREATE POLICY "Admins podem gerenciar proteínas disponíveis" 
ON public.proteinas_disponiveis 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Criar índices para performance
CREATE INDEX idx_proteinas_tipo ON public.proteinas_disponiveis(tipo);
CREATE INDEX idx_proteinas_subcategoria ON public.proteinas_disponiveis(subcategoria);
CREATE INDEX idx_proteinas_ativo ON public.proteinas_disponiveis(ativo);

-- Popular tabela com base nas receitas existentes
-- Carne vermelha (bife, acém, picanha, etc.)
INSERT INTO public.proteinas_disponiveis (produto_base_id, receita_id_legado, nome, tipo, subcategoria)
SELECT 
  ROW_NUMBER() OVER (ORDER BY receita_id_legado) + 10000 as produto_base_id,
  receita_id_legado,
  nome_receita,
  'carne_vermelha' as tipo,
  CASE 
    WHEN categoria_descricao = 'Prato Principal 1' THEN 'principal_1'
    ELSE 'principal_2'
  END as subcategoria
FROM receitas_legado 
WHERE categoria_descricao IN ('Prato Principal 1', 'Prato Principal 2')
  AND (
    UPPER(nome_receita) LIKE '%BIFE%' OR
    UPPER(nome_receita) LIKE '%ACÉM%' OR 
    UPPER(nome_receita) LIKE '%PICANHA%' OR
    UPPER(nome_receita) LIKE '%ALCATRA%' OR
    UPPER(nome_receita) LIKE '%COXÃO%' OR
    UPPER(nome_receita) LIKE '%MAMINHA%' OR
    UPPER(nome_receita) LIKE '%PATINHO%' OR
    UPPER(nome_receita) LIKE '%CARNE%' OR
    UPPER(nome_receita) LIKE '%BOVINA%'
  );

-- Carne suína (bisteca, pernil, lombo, etc.)
INSERT INTO public.proteinas_disponiveis (produto_base_id, receita_id_legado, nome, tipo, subcategoria)
SELECT 
  ROW_NUMBER() OVER (ORDER BY receita_id_legado) + 20000 as produto_base_id,
  receita_id_legado,
  nome_receita,
  'carne_suina' as tipo,
  CASE 
    WHEN categoria_descricao = 'Prato Principal 1' THEN 'principal_1'
    ELSE 'principal_2'
  END as subcategoria
FROM receitas_legado 
WHERE categoria_descricao IN ('Prato Principal 1', 'Prato Principal 2')
  AND (
    UPPER(nome_receita) LIKE '%BISTECA%' OR
    UPPER(nome_receita) LIKE '%PERNIL%' OR 
    UPPER(nome_receita) LIKE '%LOMBO%' OR
    UPPER(nome_receita) LIKE '%PORCO%' OR
    UPPER(nome_receita) LIKE '%SUÍNA%' OR
    UPPER(nome_receita) LIKE '%SUINO%' OR
    UPPER(nome_receita) LIKE '%COSTELA%'
  )
  AND receita_id_legado NOT IN (
    SELECT receita_id_legado FROM receitas_legado 
    WHERE categoria_descricao IN ('Prato Principal 1', 'Prato Principal 2')
      AND (
        UPPER(nome_receita) LIKE '%BIFE%' OR
        UPPER(nome_receita) LIKE '%ACÉM%' OR 
        UPPER(nome_receita) LIKE '%PICANHA%' OR
        UPPER(nome_receita) LIKE '%ALCATRA%' OR
        UPPER(nome_receita) LIKE '%COXÃO%' OR
        UPPER(nome_receita) LIKE '%MAMINHA%' OR
        UPPER(nome_receita) LIKE '%PATINHO%' OR
        UPPER(nome_receita) LIKE '%CARNE%' OR
        UPPER(nome_receita) LIKE '%BOVINA%'
      )
  );

-- Frango
INSERT INTO public.proteinas_disponiveis (produto_base_id, receita_id_legado, nome, tipo, subcategoria)
SELECT 
  ROW_NUMBER() OVER (ORDER BY receita_id_legado) + 30000 as produto_base_id,
  receita_id_legado,
  nome_receita,
  'frango' as tipo,
  CASE 
    WHEN categoria_descricao = 'Prato Principal 1' THEN 'principal_1'
    ELSE 'principal_2'
  END as subcategoria
FROM receitas_legado 
WHERE categoria_descricao IN ('Prato Principal 1', 'Prato Principal 2')
  AND (
    UPPER(nome_receita) LIKE '%FRANGO%' OR
    UPPER(nome_receita) LIKE '%GALINHA%' OR 
    UPPER(nome_receita) LIKE '%COXA%' OR
    UPPER(nome_receita) LIKE '%SOBRECOXA%' OR
    UPPER(nome_receita) LIKE '%PEITO%' OR
    UPPER(nome_receita) LIKE '%AVES%'
  )
  AND receita_id_legado NOT IN (
    SELECT receita_id_legado FROM public.proteinas_disponiveis
  );

-- Peixe
INSERT INTO public.proteinas_disponiveis (produto_base_id, receita_id_legado, nome, tipo, subcategoria)
SELECT 
  ROW_NUMBER() OVER (ORDER BY receita_id_legado) + 40000 as produto_base_id,
  receita_id_legado,
  nome_receita,
  'peixe' as tipo,
  CASE 
    WHEN categoria_descricao = 'Prato Principal 1' THEN 'principal_1'
    ELSE 'principal_2'
  END as subcategoria
FROM receitas_legado 
WHERE categoria_descricao IN ('Prato Principal 1', 'Prato Principal 2')
  AND (
    UPPER(nome_receita) LIKE '%PEIXE%' OR
    UPPER(nome_receita) LIKE '%TILÁPIA%' OR 
    UPPER(nome_receita) LIKE '%SALMÃO%' OR
    UPPER(nome_receita) LIKE '%PESCADA%' OR
    UPPER(nome_receita) LIKE '%BACALHAU%' OR
    UPPER(nome_receita) LIKE '%SARDINHA%' OR
    UPPER(nome_receita) LIKE '%FILÉ DE%' OR
    UPPER(nome_receita) LIKE '%MERLUZA%'
  )
  AND receita_id_legado NOT IN (
    SELECT receita_id_legado FROM public.proteinas_disponiveis
  );

-- Ovo
INSERT INTO public.proteinas_disponiveis (produto_base_id, receita_id_legado, nome, tipo, subcategoria)
SELECT 
  ROW_NUMBER() OVER (ORDER BY receita_id_legado) + 50000 as produto_base_id,
  receita_id_legado,
  nome_receita,
  'ovo' as tipo,
  CASE 
    WHEN categoria_descricao = 'Prato Principal 1' THEN 'principal_1'
    ELSE 'principal_2'
  END as subcategoria
FROM receitas_legado 
WHERE categoria_descricao IN ('Prato Principal 1', 'Prato Principal 2')
  AND (
    UPPER(nome_receita) LIKE '%OVO%' OR
    UPPER(nome_receita) LIKE '%OMELETE%'
  )
  AND receita_id_legado NOT IN (
    SELECT receita_id_legado FROM public.proteinas_disponiveis
  );

-- Vegetariano (tudo que restou)
INSERT INTO public.proteinas_disponiveis (produto_base_id, receita_id_legado, nome, tipo, subcategoria)
SELECT 
  ROW_NUMBER() OVER (ORDER BY receita_id_legado) + 60000 as produto_base_id,
  receita_id_legado,
  nome_receita,
  'vegetariano' as tipo,
  CASE 
    WHEN categoria_descricao = 'Prato Principal 1' THEN 'principal_1'
    ELSE 'principal_2'
  END as subcategoria
FROM receitas_legado 
WHERE categoria_descricao IN ('Prato Principal 1', 'Prato Principal 2')
  AND receita_id_legado NOT IN (
    SELECT receita_id_legado FROM public.proteinas_disponiveis
  );