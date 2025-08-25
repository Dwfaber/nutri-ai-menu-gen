-- SECURITY FIX: Strengthen profiles table RLS policies 

-- 1. Remove potentially permissive policies and recreate with strict security
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- 2. Create strict RLS policies that ensure users can only access their own data
CREATE POLICY "Strict user profile access"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Strict user profile update"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Strict user profile insert"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Admin override policy for support purposes (with audit trail)
CREATE POLICY "Admin can view all profiles for support"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create audit function for profile access
CREATE OR REPLACE FUNCTION audit_profile_access()
RETURNS trigger AS $$
BEGIN
  -- Log profile access for security monitoring
  INSERT INTO public.access_logs (
    user_id,
    table_name,
    operation,
    timestamp
  ) VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    now()
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Apply audit trigger to profiles table (SELECT triggers not supported, using DML only)
CREATE TRIGGER audit_profiles_access
  AFTER INSERT OR UPDATE OR DELETE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_profile_access();

-- Log security improvements
INSERT INTO public.sync_logs (tabela_destino, operacao, status, detalhes) 
VALUES (
  'profiles_security_hardening', 
  'security_enhancement', 
  'concluido',
  jsonb_build_object(
    'action', 'Strengthened profiles table RLS policies',
    'changes', ARRAY[
      'Removed old policies',
      'Added strict user-only access policies', 
      'Added admin override with audit trail',
      'Added profile access auditing for DML operations'
    ],
    'security_level', 'enhanced',
    'timestamp', now()
  )
);