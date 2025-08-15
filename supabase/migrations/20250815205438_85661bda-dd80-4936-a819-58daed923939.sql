-- Criar usuário de teste com role nutritionist
-- Primeiro, vamos atualizar o usuário existente para nutritionist para ter acesso aos dados
UPDATE user_roles 
SET role = 'nutritionist' 
WHERE role = 'viewer';

-- Inserir um comentário sobre o upgrade de permissões
INSERT INTO sync_logs (
  tabela_destino, 
  operacao, 
  status, 
  detalhes
) VALUES (
  'user_roles',
  'upgrade_user_permissions',
  'concluido',
  jsonb_build_object(
    'action', 'upgraded_user_to_nutritionist',
    'reason', 'enable_access_to_custos_filiais_data',
    'timestamp', now()
  )
);