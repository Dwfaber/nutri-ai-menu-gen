-- Add missing sync_at column to co_solicitacao_produto_listagem table
ALTER TABLE public.co_solicitacao_produto_listagem 
ADD COLUMN IF NOT EXISTS sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Add index for better performance on sync operations
CREATE INDEX IF NOT EXISTS idx_co_solicitacao_produto_listagem_sync_at 
ON public.co_solicitacao_produto_listagem(sync_at);

-- Update existing records to have sync_at timestamp
UPDATE public.co_solicitacao_produto_listagem 
SET sync_at = COALESCE(criado_em, now()) 
WHERE sync_at IS NULL;