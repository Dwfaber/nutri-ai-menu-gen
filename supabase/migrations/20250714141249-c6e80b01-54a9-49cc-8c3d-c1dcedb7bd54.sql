
-- Criar tabela para armazenar produtos do banco legado
CREATE TABLE public.produtos_legado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id_legado TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT NOT NULL,
  peso_unitario DECIMAL(10,3) NOT NULL DEFAULT 0,
  preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  disponivel BOOLEAN NOT NULL DEFAULT true,
  sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para contratos corporativos
CREATE TABLE public.contratos_corporativos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id_legado TEXT NOT NULL UNIQUE,
  nome_empresa TEXT NOT NULL,
  custo_maximo_refeicao DECIMAL(10,2) NOT NULL DEFAULT 0,
  restricoes_alimentares TEXT[] DEFAULT '{}',
  total_funcionarios INTEGER NOT NULL DEFAULT 0,
  total_refeicoes_mes INTEGER NOT NULL DEFAULT 0,
  periodicidade TEXT NOT NULL DEFAULT 'mensal',
  ativo BOOLEAN NOT NULL DEFAULT true,
  sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para receitas do sistema legado
CREATE TABLE public.receitas_legado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receita_id_legado TEXT NOT NULL UNIQUE,
  nome_receita TEXT NOT NULL,
  ingredientes JSONB NOT NULL DEFAULT '[]',
  modo_preparo TEXT,
  tempo_preparo INTEGER DEFAULT 0,
  porcoes INTEGER DEFAULT 1,
  custo_total DECIMAL(10,2) DEFAULT 0,
  categoria_receita TEXT,
  sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para logs de sincronização
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela_destino TEXT NOT NULL,
  operacao TEXT NOT NULL DEFAULT 'sync',
  status TEXT NOT NULL DEFAULT 'iniciado',
  registros_processados INTEGER DEFAULT 0,
  ultima_sync TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tempo_execucao_ms INTEGER DEFAULT 0,
  erro_msg TEXT,
  detalhes JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.produtos_legado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_corporativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas_legado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para produtos_legado (público para leitura)
CREATE POLICY "Todos podem visualizar produtos" 
  ON public.produtos_legado 
  FOR SELECT 
  USING (true);

CREATE POLICY "Sistema pode gerenciar produtos" 
  ON public.produtos_legado 
  FOR ALL 
  USING (true);

-- Políticas para contratos_corporativos (público para leitura)
CREATE POLICY "Todos podem visualizar contratos" 
  ON public.contratos_corporativos 
  FOR SELECT 
  USING (true);

CREATE POLICY "Sistema pode gerenciar contratos" 
  ON public.contratos_corporativos 
  FOR ALL 
  USING (true);

-- Políticas para receitas_legado (público para leitura)
CREATE POLICY "Todos podem visualizar receitas" 
  ON public.receitas_legado 
  FOR SELECT 
  USING (true);

CREATE POLICY "Sistema pode gerenciar receitas" 
  ON public.receitas_legado 
  FOR ALL 
  USING (true);

-- Políticas para sync_logs (público para leitura)
CREATE POLICY "Todos podem visualizar logs de sync" 
  ON public.sync_logs 
  FOR SELECT 
  USING (true);

CREATE POLICY "Sistema pode gerenciar logs" 
  ON public.sync_logs 
  FOR ALL 
  USING (true);

-- Criar índices para performance
CREATE INDEX idx_produtos_legado_categoria ON public.produtos_legado(categoria);
CREATE INDEX idx_produtos_legado_sync_at ON public.produtos_legado(sync_at);
CREATE INDEX idx_contratos_corporativos_ativo ON public.contratos_corporativos(ativo);
CREATE INDEX idx_receitas_legado_categoria ON public.receitas_legado(categoria_receita);
CREATE INDEX idx_sync_logs_tabela_status ON public.sync_logs(tabela_destino, status);
