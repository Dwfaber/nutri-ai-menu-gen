-- CORREÇÕES DE SEGURANÇA CRÍTICAS - FASE 1
-- Implementar políticas RLS restritivas para proteger dados sensíveis

-- 1. CONTRATOS CORPORATIVOS (dados extremamente sensíveis)
DROP POLICY IF EXISTS "Contratos restritos a admins" ON contratos_corporativos;
CREATE POLICY "Contratos restritos a admins" 
ON contratos_corporativos 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. AUTOMATION CONTROL (controle de sistema)
DROP POLICY IF EXISTS "Sistema de automação restrito a admins" ON automation_control;
CREATE POLICY "Sistema de automação restrito a admins" 
ON automation_control 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. BACKUP DE CUSTOS (dados financeiros sensíveis)
DROP POLICY IF EXISTS "Backup de custos restrito" ON custos_filiais_backup_duplicatas;
CREATE POLICY "Backup de custos restrito" 
ON custos_filiais_backup_duplicatas 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Bloquear inserções/updates no backup (somente sistema)
CREATE POLICY "Backup somente sistema" 
ON custos_filiais_backup_duplicatas 
FOR INSERT 
WITH CHECK (false);

-- 4. PRODUTOS BASE (dados do negócio)
DROP POLICY IF EXISTS "Produtos base para nutricionistas" ON produtos_base;
CREATE POLICY "Produtos base para nutricionistas" 
ON produtos_base 
FOR SELECT 
USING (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar produtos base" 
ON produtos_base 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. RECEITA INGREDIENTES (receitas proprietárias)
DROP POLICY IF EXISTS "Ingredientes para nutricionistas" ON receita_ingredientes;
CREATE POLICY "Ingredientes para nutricionistas" 
ON receita_ingredientes 
FOR SELECT 
USING (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Nutricionistas podem gerenciar ingredientes" 
ON receita_ingredientes 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Nutricionistas podem atualizar ingredientes" 
ON receita_ingredientes 
FOR UPDATE 
USING (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 6. PRODUTOS LEGADO (catálogo de produtos)
DROP POLICY IF EXISTS "Produtos para usuários autenticados" ON produtos_legado;
CREATE POLICY "Produtos para usuários autenticados" 
ON produtos_legado 
FOR SELECT 
USING (has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Nutricionistas podem gerenciar produtos" 
ON produtos_legado 
FOR ALL 
USING (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 7. SHOPPING LISTS (listas de compras operacionais)
DROP POLICY IF EXISTS "Listas para usuários autenticados" ON shopping_lists;
CREATE POLICY "Listas para usuários autenticados" 
ON shopping_lists 
FOR SELECT 
USING (has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Nutricionistas podem gerenciar listas" 
ON shopping_lists 
FOR ALL 
USING (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 8. SHOPPING LIST ITEMS (itens das listas)
DROP POLICY IF EXISTS "Itens para usuários autenticados" ON shopping_list_items;
CREATE POLICY "Itens para usuários autenticados" 
ON shopping_list_items 
FOR SELECT 
USING (has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Nutricionistas podem gerenciar itens" 
ON shopping_list_items 
FOR ALL 
USING (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 9. SYNC LOGS (logs do sistema - acesso restrito)
DROP POLICY IF EXISTS "Logs restritos a admins" ON sync_logs;
CREATE POLICY "Logs restritos a admins" 
ON sync_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir logs" 
ON sync_logs 
FOR INSERT 
WITH CHECK (true); -- Edge functions precisam inserir logs

-- CORREÇÃO CRÍTICA: Atualizar função has_role com search_path seguro
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- CORREÇÃO CRÍTICA: Atualizar trigger de perfil com search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email
  );
  
  -- Assign default role (viewer) to new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$function$;

-- AUDITORIA: Criar tabela de logs de acesso (para monitoramento)
CREATE TABLE IF NOT EXISTS public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  table_name text NOT NULL,
  operation text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- RLS para access_logs
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs de acesso" 
ON public.access_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Log das correções aplicadas
INSERT INTO sync_logs (tabela_destino, operacao, status, detalhes) 
VALUES (
  'security_patches', 
  'critical_rls_implementation', 
  'concluido',
  jsonb_build_object(
    'tables_secured', 9,
    'functions_patched', 2,
    'timestamp', now(),
    'security_level', 'critical'
  )
);