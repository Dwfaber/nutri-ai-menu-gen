-- Adicionar colunas de configuração de gramagem de proteínas
ALTER TABLE public.contratos_corporativos 
ADD COLUMN protein_grams_pp1 INTEGER DEFAULT 100,
ADD COLUMN protein_grams_pp2 INTEGER DEFAULT 90;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.contratos_corporativos.protein_grams_pp1 IS 'Gramagem da Proteína Principal 1 (90g ou 100g)';
COMMENT ON COLUMN public.contratos_corporativos.protein_grams_pp2 IS 'Gramagem da Proteína Principal 2 (90g ou 100g)';

-- Popular com valores padrão existentes se necessário
UPDATE public.contratos_corporativos 
SET protein_grams_pp1 = 100, protein_grams_pp2 = 90 
WHERE protein_grams_pp1 IS NULL OR protein_grams_pp2 IS NULL;