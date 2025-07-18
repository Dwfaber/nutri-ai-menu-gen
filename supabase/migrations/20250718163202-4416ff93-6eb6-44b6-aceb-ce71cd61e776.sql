
-- Remover a chave primária atual do solicitacao_id
ALTER TABLE public.co_solicitacao_produto_listagem
DROP CONSTRAINT co_solicitacao_produto_listagem_pkey;

-- Tornar solicitacao_id nullable (opcional)
ALTER TABLE public.co_solicitacao_produto_listagem
ALTER COLUMN solicitacao_id DROP NOT NULL;

-- Adicionar uma chave primária para solicitacao_produto_listagem_id
ALTER TABLE public.co_solicitacao_produto_listagem
ADD CONSTRAINT co_solicitacao_produto_listagem_pkey 
PRIMARY KEY (solicitacao_produto_listagem_id);

-- Adicionar valor padrão para solicitacao_id baseado em timestamp
ALTER TABLE public.co_solicitacao_produto_listagem
ALTER COLUMN solicitacao_id SET DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER;

-- Adicionar comentários para documentar as mudanças
COMMENT ON COLUMN public.co_solicitacao_produto_listagem.solicitacao_id 
IS 'ID da solicitação (opcional, pode vir da automação SQL Server)';

COMMENT ON COLUMN public.co_solicitacao_produto_listagem.solicitacao_produto_listagem_id 
IS 'Chave primária auto-incremento para identificação única';

-- Atualizar o cache da API REST
NOTIFY pgrst, 'reload schema';
