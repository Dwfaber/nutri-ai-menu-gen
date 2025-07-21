
-- Criar tabela para ingredientes das receitas (normalizada)
CREATE TABLE public.receita_ingredientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receita_id_legado TEXT NOT NULL,
  receita_produto_id INTEGER,
  produto_base_id INTEGER,
  produto_id INTEGER,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  unidade_medida_id INTEGER,
  unidade TEXT,
  notas TEXT,
  receita_produto_classificacao_id INTEGER,
  user_name TEXT,
  user_date_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX idx_receita_ingredientes_receita_id ON public.receita_ingredientes(receita_id_legado);
CREATE INDEX idx_receita_ingredientes_produto_base_id ON public.receita_ingredientes(produto_base_id);
CREATE INDEX idx_receita_ingredientes_sync_at ON public.receita_ingredientes(sync_at);

-- Habilitar RLS
ALTER TABLE public.receita_ingredientes ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Sistema pode gerenciar ingredientes de receitas" 
  ON public.receita_ingredientes 
  FOR ALL 
  USING (true);

CREATE POLICY "Todos podem visualizar ingredientes de receitas" 
  ON public.receita_ingredientes 
  FOR SELECT 
  USING (true);

-- Remover o campo ingredientes da tabela receitas_legado (não mais necessário)
ALTER TABLE public.receitas_legado DROP COLUMN IF EXISTS ingredientes;

-- Comentários para documentação
COMMENT ON TABLE public.receita_ingredientes IS 'Ingredientes das receitas sincronizados da view vwCpReceitaProduto';
COMMENT ON COLUMN public.receita_ingredientes.receita_id_legado IS 'ID da receita no sistema legado';
COMMENT ON COLUMN public.receita_ingredientes.produto_base_id IS 'ID do produto base usado como ingrediente';
COMMENT ON COLUMN public.receita_ingredientes.quantidade IS 'Quantidade do ingrediente na receita';
COMMENT ON COLUMN public.receita_ingredientes.unidade IS 'Unidade de medida do ingrediente';
