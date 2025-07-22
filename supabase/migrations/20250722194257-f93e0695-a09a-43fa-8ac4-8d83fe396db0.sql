
-- Make cliente_id_legado column nullable in custos_filiais table
ALTER TABLE public.custos_filiais 
ALTER COLUMN cliente_id_legado DROP NOT NULL;
