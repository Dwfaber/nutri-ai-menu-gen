-- ============================================================================
-- CORREÇÃO DE SEGURANÇA: Restrição de Acesso a Dados de Preços
-- ============================================================================
-- 
-- PROBLEMA: As tabelas produtos_legado e co_solicitacao_produto_listagem 
-- estão com políticas RLS que permitem acesso público aos dados de preços,
-- permitindo que concorrentes vejam informações sensíveis de preços.
--
-- SOLUÇÃO: Implementar políticas restritivas baseadas em roles que só permitem
-- acesso a usuários autorizados (admins e procurement).
-- ============================================================================

-- 1. Primeiro, adicionar role de procurement se não existir
DO $$
BEGIN
    -- Verificar se o tipo já tem o valor 'procurement'
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'app_role'::regtype 
        AND enumlabel = 'procurement'
    ) THEN
        -- Adicionar o novo valor ao enum
        ALTER TYPE app_role ADD VALUE 'procurement';
    END IF;
END $$;

-- 2. Remover políticas antigas não seguras
DROP POLICY IF EXISTS "Todos podem visualizar produtos" ON produtos_legado;
DROP POLICY IF EXISTS "Sistema pode gerenciar produtos" ON produtos_legado;

DROP POLICY IF EXISTS "Todos podem visualizar solicitações de produtos" ON co_solicitacao_produto_listagem;
DROP POLICY IF EXISTS "Sistema pode gerenciar solicitações de produtos" ON co_solicitacao_produto_listagem;

-- ============================================================================
-- POLÍTICAS SEGURAS PARA produtos_legado
-- ============================================================================

-- Admins podem fazer tudo
CREATE POLICY "Admins podem gerenciar produtos" 
ON produtos_legado 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Procurement pode ver e atualizar produtos
CREATE POLICY "Procurement pode ver produtos" 
ON produtos_legado 
FOR SELECT 
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'procurement'::app_role)
);

CREATE POLICY "Procurement pode atualizar produtos" 
ON produtos_legado 
FOR UPDATE 
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'procurement'::app_role)
)
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'procurement'::app_role)
);

-- ============================================================================
-- POLÍTICAS SEGURAS PARA co_solicitacao_produto_listagem
-- ============================================================================

-- Admins podem fazer tudo
CREATE POLICY "Admins podem gerenciar listagem de produtos" 
ON co_solicitacao_produto_listagem 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Procurement pode ver e gerenciar solicitações
CREATE POLICY "Procurement pode ver listagem de produtos" 
ON co_solicitacao_produto_listagem 
FOR SELECT 
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'procurement'::app_role)
);

CREATE POLICY "Procurement pode inserir listagem de produtos" 
ON co_solicitacao_produto_listagem 
FOR INSERT 
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'procurement'::app_role)
);

CREATE POLICY "Procurement pode atualizar listagem de produtos" 
ON co_solicitacao_produto_listagem 
FOR UPDATE 
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'procurement'::app_role)
)
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'procurement'::app_role)
);

-- ============================================================================
-- FUNÇÃO HELPER PARA VERIFICAR SE USUÁRIO PODE ACESSAR PREÇOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_pricing_data()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin'::app_role) OR 
         has_role(auth.uid(), 'procurement'::app_role);
$$;

-- ============================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON POLICY "Admins podem gerenciar produtos" ON produtos_legado IS 
'Administradores têm acesso completo aos dados de produtos';

COMMENT ON POLICY "Procurement pode ver produtos" ON produtos_legado IS 
'Equipe de procurement pode visualizar dados de produtos para suas operações';

COMMENT ON POLICY "Admins podem gerenciar listagem de produtos" ON co_solicitacao_produto_listagem IS 
'Administradores têm acesso completo aos dados de listagem e preços';

COMMENT ON POLICY "Procurement pode ver listagem de produtos" ON co_solicitacao_produto_listagem IS 
'Equipe de procurement pode visualizar listagem de produtos e preços para operações';

COMMENT ON FUNCTION public.can_access_pricing_data() IS 
'Função helper para verificar se usuário atual pode acessar dados sensíveis de preços';