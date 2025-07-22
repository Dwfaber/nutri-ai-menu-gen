-- Limpar registros vazios duplicados da tabela custos_filiais
-- Manter apenas registros com dados válidos (filial_id não nulo)
DELETE FROM public.custos_filiais 
WHERE filial_id IS NULL 
   OR nome_filial IS NULL 
   OR (filial_id IS NULL AND nome_filial IS NULL AND custo_total = 0);