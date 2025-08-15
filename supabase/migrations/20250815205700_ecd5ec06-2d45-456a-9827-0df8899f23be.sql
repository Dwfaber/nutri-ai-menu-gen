-- CORREÇÃO DE SEGURANÇA CRÍTICA: Proteger dados proprietários de receitas
-- Remover políticas públicas perigosas da tabela receitas_legado

-- 1. Remover todas as políticas públicas existentes
DROP POLICY IF EXISTS "Sistema pode gerenciar receitas" ON public.receitas_legado;
DROP POLICY IF EXISTS "Todos podem visualizar receitas" ON public.receitas_legado;

-- 2. Criar políticas seguras baseadas em autenticação e roles
-- Apenas administradores podem ter acesso completo
CREATE POLICY "Admins podem gerenciar todas as receitas" 
ON public.receitas_legado 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Nutricionistas podem visualizar e trabalhar com receitas para planejamento
CREATE POLICY "Nutricionistas podem visualizar receitas para planejamento" 
ON public.receitas_legado 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Nutricionistas podem criar receitas (mas não deletar)
CREATE POLICY "Nutricionistas podem criar receitas" 
ON public.receitas_legado 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Nutricionistas podem atualizar receitas existentes
CREATE POLICY "Nutricionistas podem atualizar receitas" 
ON public.receitas_legado 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'nutritionist'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Log da correção de segurança
INSERT INTO sync_logs (
  tabela_destino, 
  operacao, 
  status, 
  detalhes
) VALUES (
  'receitas_legado',
  'security_fix_critical',
  'concluido',
  jsonb_build_object(
    'action', 'removed_public_access_to_proprietary_recipes',
    'security_level', 'CRITICAL_FIX',
    'risk_mitigated', 'competitor_recipe_theft',
    'access_model', 'role_based_authenticated_only',
    'timestamp', now()
  )
);