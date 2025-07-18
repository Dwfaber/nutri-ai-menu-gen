
-- Create table for product requests in menus
CREATE TABLE IF NOT EXISTS public.co_solicitacao_produto_listagem (
  solicitacao_id int PRIMARY KEY,
  categoria_id int,
  categoria_descricao text,
  grupo text,
  produto_id int,
  preco numeric(10,2),
  per_capita numeric(10,2),
  inteiro boolean,
  arredondar_tipo int,
  promocao boolean,
  descricao text,
  unidade text,
  preco_compra numeric(10,2),
  produto_base_id int,
  quantidade_embalagem numeric(10,2),
  criado_em timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.co_solicitacao_produto_listagem ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Sistema pode gerenciar solicitações de produtos" 
  ON public.co_solicitacao_produto_listagem 
  FOR ALL 
  USING (true);

CREATE POLICY "Todos podem visualizar solicitações de produtos" 
  ON public.co_solicitacao_produto_listagem 
  FOR SELECT 
  USING (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_solicitacao_produto_produto_id 
  ON public.co_solicitacao_produto_listagem(produto_id);

CREATE INDEX IF NOT EXISTS idx_solicitacao_produto_categoria_id 
  ON public.co_solicitacao_produto_listagem(categoria_id);

CREATE INDEX IF NOT EXISTS idx_solicitacao_produto_grupo 
  ON public.co_solicitacao_produto_listagem(grupo);
