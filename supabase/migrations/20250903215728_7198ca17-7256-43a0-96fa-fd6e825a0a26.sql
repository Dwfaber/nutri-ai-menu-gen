-- Enable RLS on sucos_disponiveis table
ALTER TABLE sucos_disponiveis ENABLE ROW LEVEL SECURITY;

-- Create policies for sucos_disponiveis
CREATE POLICY "Todos podem visualizar sucos disponíveis" 
ON sucos_disponiveis 
FOR SELECT 
USING (true);

CREATE POLICY "Admins podem gerenciar sucos" 
ON sucos_disponiveis 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));