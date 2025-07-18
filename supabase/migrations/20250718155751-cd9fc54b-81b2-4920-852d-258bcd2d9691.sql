
-- Adicionar a coluna em_promocao à tabela co_solicitacao_produto_listagem
ALTER TABLE public.co_solicitacao_produto_listagem
ADD COLUMN em_promocao boolean DEFAULT false;

-- Adicionar comentário para documentar o propósito da coluna
COMMENT ON COLUMN public.co_solicitacao_produto_listagem.em_promocao 
IS 'Indica se o produto está em promoção';

-- Atualizar o cache da API REST
NOTIFY pgrst, 'reload schema';
