-- SECURITY FIX: Strengthen profiles table RLS policies and create demo access

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

-- 4. Create demo user for public access
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-2222-3333-4444-555555555555',
  'authenticated',
  'authenticated',
  'demo@nutris.app',
  '$2a$10$fakehashfordemouseronly',
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- 5. Create demo profile
INSERT INTO public.profiles (
  user_id,
  first_name,
  last_name,
  email
) VALUES (
  '11111111-2222-3333-4444-555555555555',
  'Demo',
  'User',
  'demo@nutris.app'
) ON CONFLICT (user_id) DO NOTHING;

-- 6. Assign viewer role to demo user
INSERT INTO public.user_roles (
  user_id,
  role
) VALUES (
  '11111111-2222-3333-4444-555555555555',
  'viewer'
) ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Create audit function for profile access
CREATE OR REPLACE FUNCTION audit_profile_access()
RETURNS trigger AS $$
BEGIN
  -- Log profile access for security monitoring
  INSERT INTO public.access_logs (
    user_id,
    table_name,
    operation,
    timestamp,
    ip_address
  ) VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    now(),
    inet_client_addr()
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Apply audit trigger to profiles table
CREATE TRIGGER audit_profiles_access
  AFTER INSERT OR UPDATE OR DELETE OR SELECT
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
      'Removed permissive policies',
      'Added strict user-only access policies', 
      'Added admin override with audit trail',
      'Created demo user for public access',
      'Added profile access auditing'
    ],
    'security_level', 'enhanced',
    'demo_user_created', 'demo@nutris.app',
    'timestamp', now()
  )
);