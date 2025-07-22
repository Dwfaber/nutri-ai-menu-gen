
-- Adicionar campos para armazenar os dias de funcionamento na tabela contratos_corporativos
ALTER TABLE public.contratos_corporativos 
ADD COLUMN dias_funcionamento_mes INTEGER DEFAULT 22,
ADD COLUMN segunda_feira BOOLEAN DEFAULT true,
ADD COLUMN terca_feira BOOLEAN DEFAULT true,
ADD COLUMN quarta_feira BOOLEAN DEFAULT true,
ADD COLUMN quinta_feira BOOLEAN DEFAULT true,
ADD COLUMN sexta_feira BOOLEAN DEFAULT true,
ADD COLUMN sabado BOOLEAN DEFAULT false,
ADD COLUMN domingo BOOLEAN DEFAULT false;

-- Criar índice para melhor performance nas consultas por dias de funcionamento
CREATE INDEX idx_contratos_corporativos_dias_funcionamento ON public.contratos_corporativos(dias_funcionamento_mes);
