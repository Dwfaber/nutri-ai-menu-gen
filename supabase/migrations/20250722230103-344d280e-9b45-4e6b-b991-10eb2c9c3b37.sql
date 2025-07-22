-- Renomear colunas da tabela co_solicitacao_produto_listagem para coincidir com os nomes da view
-- Isso facilitará o fluxo da automação

-- Renomear as colunas conforme a imagem
ALTER TABLE public.co_solicitacao_produto_listagem 
RENAME COLUMN solicitacao_produto_listagem_id TO solicitacao_produto_listagem_id;

ALTER TABLE public.co_solicitacao_produto_listagem 
RENAME COLUMN categoria_id TO solicitacao_produto_categoria_id;

ALTER TABLE public.co_solicitacao_produto_listagem 
RENAME COLUMN apenas_valor_inteiro TO apenas_valor_inteiro_sim_nao;

ALTER TABLE public.co_solicitacao_produto_listagem 
RENAME COLUMN em_promocao TO em_promocao_sim_nao;

ALTER TABLE public.co_solicitacao_produto_listagem 
RENAME COLUMN produto_base_qtd_embalagem TO produto_base_quantidade_embalagem;

-- Adicionar comentários para documentar as mudanças
COMMENT ON COLUMN public.co_solicitacao_produto_listagem.solicitacao_produto_categoria_id 
IS 'ID da categoria do produto (renomeado para coincidir com view)';

COMMENT ON COLUMN public.co_solicitacao_produto_listagem.apenas_valor_inteiro_sim_nao 
IS 'Indica se o produto deve ser calculado apenas com valores inteiros (sim/não)';

COMMENT ON COLUMN public.co_solicitacao_produto_listagem.em_promocao_sim_nao 
IS 'Indica se o produto está em promoção (sim/não)';

COMMENT ON COLUMN public.co_solicitacao_produto_listagem.produto_base_quantidade_embalagem 
IS 'Quantidade base por embalagem do produto (nome alinhado com view)';

-- Atualizar o cache da API REST
NOTIFY pgrst, 'reload schema';