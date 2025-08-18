-- Criar nova política RLS para permitir que viewers vejam dados básicos de clientes
CREATE POLICY "Viewers can view basic client cost data for selection" 
ON public.custos_filiais 
FOR SELECT 
USING (has_role(auth.uid(), 'viewer'::app_role));