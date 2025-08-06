-- Add missing column produto_base_descricao to receita_ingredientes
ALTER TABLE receita_ingredientes 
ADD COLUMN produto_base_descricao TEXT;

-- Update the column with product descriptions from produtos_base
UPDATE receita_ingredientes 
SET produto_base_descricao = pb.descricao
FROM produtos_base pb
WHERE receita_ingredientes.produto_base_id = pb.produto_base_id;