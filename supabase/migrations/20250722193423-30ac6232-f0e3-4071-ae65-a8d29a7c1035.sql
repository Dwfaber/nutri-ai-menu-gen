
-- Atualizar estrutura da tabela custos_filiais com campos detalhados
ALTER TABLE public.custos_filiais 
ADD COLUMN IF NOT EXISTS "RefCustoSegunda" NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS "RefCustoTerca" NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS "RefCustoQuarta" NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS "RefCustoQuinta" NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS "RefCustoSexta" NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS "RefCustoSabado" NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS "RefCustoDomingo" NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS "RefCustoDiaEspecial" NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS "QtdeRefeicoesUsarMediaValidarSimNao" BOOLEAN,
ADD COLUMN IF NOT EXISTS "PorcentagemLimiteAcimaMedia" INTEGER,
ADD COLUMN IF NOT EXISTS custo_medio_semanal NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS solicitacao_filial_custo_id INTEGER,
ADD COLUMN IF NOT EXISTS solicitacao_compra_tipo_id INTEGER,
ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_date_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(255),
ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255),
ADD COLUMN IF NOT EXISTS solicitacao_compra_tipo_descricao VARCHAR(255);

-- Atualizar tipo da coluna cliente_id_legado para integer se necessário
-- (mantendo compatibilidade com dados existentes)
ALTER TABLE public.custos_filiais 
ALTER COLUMN cliente_id_legado TYPE INTEGER USING cliente_id_legado::INTEGER;

-- Criar índices adicionais para melhor performance
CREATE INDEX IF NOT EXISTS idx_custos_filiais_solicitacao_filial_custo_id 
  ON public.custos_filiais(solicitacao_filial_custo_id);

CREATE INDEX IF NOT EXISTS idx_custos_filiais_solicitacao_compra_tipo_id 
  ON public.custos_filiais(solicitacao_compra_tipo_id);

CREATE INDEX IF NOT EXISTS idx_custos_filiais_user_date_time 
  ON public.custos_filiais(user_date_time);
