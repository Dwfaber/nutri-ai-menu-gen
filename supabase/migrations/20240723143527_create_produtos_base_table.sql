-- Criar tabela para produtos base (EstProdutoBase)
CREATE TABLE public.produtos_base (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_base_id integer NOT NULL UNIQUE,
  descricao text,
  unidade_medida_id integer,
  user_name text,
  user_date_time timestamp with time zone,
  unidade text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sync_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.produtos_base ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Sistema pode gerenciar produtos base" 
ON public.produtos_base 
FOR ALL 
USING (true);

CREATE POLICY "Todos podem visualizar produtos base" 
ON public.produtos_base 
FOR SELECT 
USING (true);

-- Criar índices para melhor performance
CREATE INDEX idx_produtos_base_produto_base_id ON public.produtos_base(produto_base_id);
CREATE INDEX idx_produtos_base_unidade_medida_id ON public.produtos_base(unidade_medida_id);
CREATE INDEX idx_produtos_base_user_name ON public.produtos_base(user_name);

-- Adicionar comentários para documentar as colunas
COMMENT ON COLUMN public.produtos_base.produto_base_id IS 'ID único do produto base no sistema legado';
COMMENT ON COLUMN public.produtos_base.descricao IS 'Descrição do produto base';
COMMENT ON COLUMN public.produtos_base.unidade_medida_id IS 'ID da unidade de medida';
COMMENT ON COLUMN public.produtos_base.user_name IS 'Nome do usuário que criou/editou';
COMMENT ON COLUMN public.produtos_base.user_date_time IS 'Data e hora da última modificação pelo usuário';
COMMENT ON COLUMN public.produtos_base.unidade IS 'Descrição da unidade de medida';

-- Criar trigger para atualizar sync_at automaticamente
CREATE TRIGGER update_produtos_base_sync_at 
  BEFORE UPDATE ON public.produtos_base 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar o cache da API REST
NOTIFY pgrst, 'reload schema';