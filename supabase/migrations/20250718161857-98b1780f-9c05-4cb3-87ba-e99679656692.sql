
-- Remover a coluna UUID atual
ALTER TABLE public.co_solicitacao_produto_listagem
DROP COLUMN solicitacao_produto_listagem_id;

-- Adicionar nova coluna INTEGER com auto-incremento
ALTER TABLE public.co_solicitacao_produto_listagem
ADD COLUMN solicitacao_produto_listagem_id SERIAL;

-- Adicionar comentário para documentar o propósito da coluna
COMMENT ON COLUMN public.co_solicitacao_produto_listagem.solicitacao_produto_listagem_id 
IS 'Identificador único INTEGER para a solicitação de produto (auto-incremento)';

-- Atualizar o cache da API REST
NOTIFY pgrst, 'reload schema';
