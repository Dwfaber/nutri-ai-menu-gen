-- Fix security vulnerability in custos_filiais table
-- Drop existing insecure policies that allow public access to sensitive financial data
DROP POLICY IF EXISTS "Sistema pode gerenciar custos de filiais" ON public.custos_filiais;
DROP POLICY IF EXISTS "Todos podem visualizar custos de filiais" ON public.custos_filiais;

-- Create secure RLS policies for financial cost data
-- Only admin and nutritionist roles can access financial information

-- Admin users can manage all financial cost data
CREATE POLICY "Admins can manage financial cost data" 
ON public.custos_filiais 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Nutritionists can view cost data for menu planning (read-only access)
CREATE POLICY "Nutritionists can view cost data for planning" 
ON public.custos_filiais 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'nutritionist'::app_role));

-- Nutritionists can insert cost data (for data management)
CREATE POLICY "Nutritionists can insert cost data" 
ON public.custos_filiais 
FOR INSERT 
TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'nutritionist'::app_role));

-- Nutritionists can update cost data (for data correction)
CREATE POLICY "Nutritionists can update cost data" 
ON public.custos_filiais 
FOR UPDATE 
TO authenticated 
USING (public.has_role(auth.uid(), 'nutritionist'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'nutritionist'::app_role));

-- Add helpful comment
COMMENT ON TABLE public.custos_filiais IS 'Financial cost data for company branches. Contains sensitive financial information restricted to admin and nutritionist personnel only.';