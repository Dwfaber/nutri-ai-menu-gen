-- First create unique constraint on filial_id_legado, then add the foreign key
-- Step 1: Add unique constraint to enable foreign key reference
ALTER TABLE contratos_corporativos 
ADD CONSTRAINT uk_contratos_corporativos_filial_id_legado 
UNIQUE (filial_id_legado);

-- Step 2: Add foreign key constraint to enable PostgREST relationships
ALTER TABLE custos_filiais 
ADD CONSTRAINT fk_custos_filiais_contratos 
FOREIGN KEY (filial_id) 
REFERENCES contratos_corporativos(filial_id_legado) 
ON DELETE SET NULL 
ON UPDATE CASCADE;