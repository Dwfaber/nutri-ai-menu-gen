-- Create helper function to check pricing data access for financial cost tables
CREATE OR REPLACE FUNCTION public.can_access_pricing_data()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'procurement'::app_role)
  )
$$;

-- Fix security vulnerability in custos_filiais table
-- Drop existing insecure policies that allow public access to sensitive financial data
DROP POLICY IF EXISTS "Sistema pode gerenciar custos de filiais" ON public.custos_filiais;
DROP POLICY IF EXISTS "Todos podem visualizar custos de filiais" ON public.custos_filiais;

-- Create secure RLS policies for financial cost data
-- Only admin, procurement, and nutritionist roles can access financial information

-- Admin users can manage all financial cost data
CREATE POLICY "Admins can manage financial cost data" 
ON public.custos_filiais 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Procurement users can view financial cost data
CREATE POLICY "Procurement can view financial cost data" 
ON public.custos_filiais 
FOR SELECT 
TO authenticated 
USING (public.can_access_pricing_data());

-- Procurement users can insert financial cost data (for data management)
CREATE POLICY "Procurement can insert financial cost data" 
ON public.custos_filiais 
FOR INSERT 
TO authenticated 
WITH CHECK (public.can_access_pricing_data());

-- Procurement users can update financial cost data (for data correction)
CREATE POLICY "Procurement can update financial cost data" 
ON public.custos_filiais 
FOR UPDATE 
TO authenticated 
USING (public.can_access_pricing_data())
WITH CHECK (public.can_access_pricing_data());

-- Nutritionists can view cost data for menu planning (read-only access)
CREATE POLICY "Nutritionists can view cost data for planning" 
ON public.custos_filiais 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'nutritionist'::app_role));

-- Add helpful comment
COMMENT ON TABLE public.custos_filiais IS 'Financial cost data for company branches. Contains sensitive financial information restricted to authorized personnel only.';