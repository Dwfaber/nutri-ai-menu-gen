-- Add policy to allow viewers to see recipes for analysis
CREATE POLICY "Viewers podem visualizar receitas para análise" 
ON public.receitas_legado 
FOR SELECT 
USING (has_role(auth.uid(), 'viewer'::app_role));