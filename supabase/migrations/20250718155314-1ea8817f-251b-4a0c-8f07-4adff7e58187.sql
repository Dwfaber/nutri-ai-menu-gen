
-- Adicionar a coluna apenas_valor_inteiro à tabela co_solicitacao_produto_listagem
ALTER TABLE public.co_solicitacao_produto_listagem
ADD COLUMN apenas_valor_inteiro boolean DEFAULT false;

-- Adicionar comentário para documentar o propósito da coluna
COMMENT ON COLUMN public.co_solicitacao_produto_listagem.apenas_valor_inteiro 
IS 'Indica se o produto deve ser calculado apenas com valores inteiros';
