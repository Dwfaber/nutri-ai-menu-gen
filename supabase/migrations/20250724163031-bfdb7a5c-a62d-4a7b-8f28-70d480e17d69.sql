-- Create the new contratos_corporativos table with proper structure
CREATE TABLE public.contratos_corporativos_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id_legado TEXT NOT NULL,
  nome_empresa TEXT NOT NULL,
  total_funcionarios INTEGER DEFAULT 0,
  custo_maximo_refeicao NUMERIC DEFAULT 0,
  total_refeicoes_mes INTEGER DEFAULT 0,
  restricoes_alimentares TEXT[] DEFAULT '{}',
  periodicidade TEXT DEFAULT 'mensal',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contratos_corporativos_v2 ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Sistema pode gerenciar contratos corporativos" 
ON public.contratos_corporativos_v2 
FOR ALL 
USING (true);

CREATE POLICY "Todos podem visualizar contratos corporativos" 
ON public.contratos_corporativos_v2 
FOR SELECT 
USING (true);

-- Migrate existing data from contratos_corporativos to contratos_corporativos_v2
INSERT INTO public.contratos_corporativos_v2 (
  cliente_id_legado,
  nome_empresa,
  total_funcionarios,
  custo_maximo_refeicao,
  ativo,
  created_at,
  sync_at
)
SELECT 
  COALESCE(empresa_id_legado::text, filial_id_legado::text) as cliente_id_legado,
  COALESCE(nome_fantasia, razao_social, 'Cliente Sem Nome') as nome_empresa,
  50 as total_funcionarios, -- default value
  25.00 as custo_maximo_refeicao, -- default value
  true as ativo,
  COALESCE(data_contrato, now()) as created_at,
  now() as sync_at
FROM public.contratos_corporativos;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_contratos_corporativos_v2_updated_at
BEFORE UPDATE ON public.contratos_corporativos_v2
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();