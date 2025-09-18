-- Enable natural juice for PLASTCOR client by default
UPDATE contratos_corporativos 
SET use_suco_natural = true 
WHERE nome_fantasia = 'PLASTCOR';