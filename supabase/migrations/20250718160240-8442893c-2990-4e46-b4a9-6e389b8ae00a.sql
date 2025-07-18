
-- Adicionar a coluna produto_base_qtd_embalagem à tabela co_solicitacao_produto_listagem
ALTER TABLE public.co_solicitacao_produto_listagem
ADD COLUMN produto_base_qtd_embalagem numeric;

-- Adicionar comentário para documentar o propósito da coluna
COMMENT ON COLUMN public.co_solicitacao_produto_listagem.produto_base_qtd_embalagem 
IS 'Quantidade base por embalagem do produto';

-- Atualizar o cache da API REST
NOTIFY pgrst, 'reload schema';
