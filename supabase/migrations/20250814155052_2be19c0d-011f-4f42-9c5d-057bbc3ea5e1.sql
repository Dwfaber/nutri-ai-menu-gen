-- Create helper function to check pricing data access
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

-- Fix security vulnerability in custos_filiais_backup_duplicatas table
-- Drop existing insecure policies that allow public access
DROP POLICY IF EXISTS "Sistema pode gerenciar backup de custos duplicatas" ON public.custos_filiais_backup_duplicatas;
DROP POLICY IF EXISTS "Todos podem visualizar backup de custos duplicatas" ON public.custos_filiais_backup_duplicatas;

-- Create secure RLS policies for backup financial data
-- Only admin and procurement roles can access sensitive backup financial information

-- Admin users can manage all backup cost data
CREATE POLICY "Admins can manage backup cost data" 
ON public.custos_filiais_backup_duplicatas 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Procurement users can view backup cost data
CREATE POLICY "Procurement can view backup cost data" 
ON public.custos_filiais_backup_duplicatas 
FOR SELECT 
TO authenticated 
USING (public.can_access_pricing_data());

-- Procurement users can insert backup cost data (for data management)
CREATE POLICY "Procurement can insert backup cost data" 
ON public.custos_filiais_backup_duplicatas 
FOR INSERT 
TO authenticated 
WITH CHECK (public.can_access_pricing_data());

-- Procurement users can update backup cost data (for data correction)
CREATE POLICY "Procurement can update backup cost data" 
ON public.custos_filiais_backup_duplicatas 
FOR UPDATE 
TO authenticated 
USING (public.can_access_pricing_data())
WITH CHECK (public.can_access_pricing_data());

-- Add helpful comment
COMMENT ON TABLE public.custos_filiais_backup_duplicatas IS 'Backup financial cost data for company branches. Access restricted to admin and procurement personnel only for data security.';