-- Create foreign key relationship between custos_filiais and contratos_corporativos
-- This will enable proper PostgREST relationship queries

-- First, let's check if we need to add an index for better performance
CREATE INDEX IF NOT EXISTS idx_custos_filiais_filial_id ON custos_filiais(filial_id);
CREATE INDEX IF NOT EXISTS idx_contratos_corporativos_filial_id_legado ON contratos_corporativos(filial_id_legado);

-- Add foreign key constraint to enable PostgREST relationships
-- Note: We're linking custos_filiais.filial_id to contratos_corporativos.filial_id_legado
ALTER TABLE custos_filiais 
ADD CONSTRAINT fk_custos_filiais_contratos 
FOREIGN KEY (filial_id) 
REFERENCES contratos_corporativos(filial_id_legado) 
ON DELETE SET NULL 
ON UPDATE CASCADE;