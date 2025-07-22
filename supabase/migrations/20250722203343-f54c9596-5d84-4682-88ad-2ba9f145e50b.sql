
-- Remove duplicate boolean day-of-week fields from custos_filiais table
-- Keep only the RefCusto* fields which already contain the numeric values
ALTER TABLE public.custos_filiais 
DROP COLUMN IF EXISTS segunda_feira,
DROP COLUMN IF EXISTS terca_feira,
DROP COLUMN IF EXISTS quarta_feira,
DROP COLUMN IF EXISTS quinta_feira,
DROP COLUMN IF EXISTS sexta_feira,
DROP COLUMN IF EXISTS sabado,
DROP COLUMN IF EXISTS domingo,
DROP COLUMN IF EXISTS dias_funcionamento_calculado,
DROP COLUMN IF EXISTS custo_maximo_refeicao,
DROP COLUMN IF EXISTS orcamento_mensal;

-- Keep the essential fields that match the legacy system structure:
-- cliente_id_legado, filial_id, nome_filial, custo_total
-- RefCustoSegunda, RefCustoTerca, RefCustoQuarta, RefCustoQuinta, RefCustoSexta, RefCustoSabado, RefCustoDomingo
-- RefCustoDiaEspecial, QtdeRefeicoesUsarMediaValidarSimNao, PorcentagemLimiteAcimaMedia
-- custo_medio_semanal, solicitacao_filial_custo_id, solicitacao_compra_tipo_id
-- user_name, user_date_time, nome_fantasia, razao_social, solicitacao_compra_tipo_descricao

-- The remaining fields now match exactly with the legacy system structure
-- This will make the sync function much simpler and more reliable
