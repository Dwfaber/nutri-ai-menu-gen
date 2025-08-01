-- Habilitar RLS na tabela de backup criada
ALTER TABLE custos_filiais_backup_duplicatas ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir que o sistema gerencie a tabela de backup
CREATE POLICY "Sistema pode gerenciar backup de custos duplicatas" 
ON custos_filiais_backup_duplicatas 
FOR ALL 
USING (true);

-- Criar política para visualização da tabela de backup
CREATE POLICY "Todos podem visualizar backup de custos duplicatas" 
ON custos_filiais_backup_duplicatas 
FOR SELECT 
USING (true);