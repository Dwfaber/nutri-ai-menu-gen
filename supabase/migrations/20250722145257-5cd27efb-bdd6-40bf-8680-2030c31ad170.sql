
-- Criar tabela específica para custos de filiais
CREATE TABLE IF NOT EXISTS public.custos_filiais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id_legado TEXT NOT NULL,
  filial_id INTEGER,
  nome_filial TEXT,
  custo_total NUMERIC(10,2) DEFAULT 0,
  orcamento_mensal NUMERIC(10,2) DEFAULT 0,
  custo_maximo_refeicao NUMERIC(10,2) DEFAULT 0,
  dias_funcionamento_calculado INTEGER DEFAULT 0,
  -- Dias da semana como campos individuais
  segunda_feira BOOLEAN DEFAULT false,
  terca_feira BOOLEAN DEFAULT false,
  quarta_feira BOOLEAN DEFAULT false,
  quinta_feira BOOLEAN DEFAULT false,
  sexta_feira BOOLEAN DEFAULT false,
  sabado BOOLEAN DEFAULT false,
  domingo BOOLEAN DEFAULT false,
  -- Metadados de sincronização
  sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.custos_filiais ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Sistema pode gerenciar custos de filiais" 
  ON public.custos_filiais 
  FOR ALL 
  USING (true);

CREATE POLICY "Todos podem visualizar custos de filiais" 
  ON public.custos_filiais 
  FOR SELECT 
  USING (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_custos_filiais_cliente_id_legado 
  ON public.custos_filiais(cliente_id_legado);

CREATE INDEX IF NOT EXISTS idx_custos_filiais_filial_id 
  ON public.custos_filiais(filial_id);

CREATE INDEX IF NOT EXISTS idx_custos_filiais_sync_at 
  ON public.custos_filiais(sync_at);

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_custos_filiais_updated_at 
  BEFORE UPDATE ON public.custos_filiais 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
