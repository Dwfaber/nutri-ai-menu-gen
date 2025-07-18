
-- Adicionar a coluna solicitacao_produto_listagem_id à tabela co_solicitacao_produto_listagem
ALTER TABLE public.co_solicitacao_produto_listagem
ADD COLUMN solicitacao_produto_listagem_id uuid DEFAULT gen_random_uuid();

-- Adicionar comentário para documentar o propósito da coluna
COMMENT ON COLUMN public.co_solicitacao_produto_listagem.solicitacao_produto_listagem_id 
IS 'Identificador único UUID para a solicitação de produto';

-- Atualizar o cache da API REST
NOTIFY pgrst, 'reload schema';
