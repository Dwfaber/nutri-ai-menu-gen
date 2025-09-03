-- Adicionar colunas de configuração de sucos na tabela contratos_corporativos
ALTER TABLE contratos_corporativos 
ADD COLUMN use_pro_mix boolean DEFAULT false,
ADD COLUMN use_pro_vita boolean DEFAULT false,
ADD COLUMN use_suco_diet boolean DEFAULT false,
ADD COLUMN use_suco_natural boolean DEFAULT false;

-- Criar tabela catálogo de sucos com IDs fixos
CREATE TABLE sucos_disponiveis (
  id int PRIMARY KEY,
  nome text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  ativo boolean DEFAULT true
);

-- Inserir os sucos disponíveis com IDs fixos
INSERT INTO sucos_disponiveis (id, nome) VALUES
  (101, 'Suco Pró Mix'),
  (102, 'Suco Pro Vita Suco'),
  (103, 'Suco Diet'),
  (104, 'Suco Natural');

-- Habilitar RLS na tabela sucos_disponiveis
ALTER TABLE sucos_disponiveis ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura de sucos disponíveis
CREATE POLICY "Todos podem visualizar sucos disponíveis"
ON sucos_disponiveis
FOR SELECT
USING (true);

-- Política para admins gerenciarem sucos
CREATE POLICY "Admins podem gerenciar sucos"
ON sucos_disponiveis
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Função RPC para gerar cardápio com configuração de sucos
CREATE OR REPLACE FUNCTION gerar_cardapio(
  p_data_inicio text,
  p_data_fim text,
  p_use_pro_mix boolean DEFAULT false,
  p_use_pro_vita boolean DEFAULT false,
  p_use_suco_diet boolean DEFAULT false,
  p_use_suco_natural boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  resultado jsonb := '{}';
  suco1_config jsonb;
  suco2_config jsonb;
  sucos_ativos int[] := ARRAY[]::int[];
BEGIN
  -- Construir array de sucos ativos baseado nas flags
  IF p_use_pro_mix THEN
    sucos_ativos := sucos_ativos || 101;
  END IF;
  
  IF p_use_pro_vita THEN
    sucos_ativos := sucos_ativos || 102;
  END IF;
  
  IF p_use_suco_diet THEN
    sucos_ativos := sucos_ativos || 103;
  END IF;
  
  IF p_use_suco_natural THEN
    sucos_ativos := sucos_ativos || 104;
  END IF;
  
  -- Se nenhum suco configurado, usar Natural como padrão
  IF array_length(sucos_ativos, 1) IS NULL THEN
    sucos_ativos := ARRAY[104];
  END IF;
  
  -- Selecionar SUCO1 (prioridade: Pro Mix → Pro Vita → Diet → Natural)
  SELECT jsonb_build_object('id', id, 'nome', nome)
  INTO suco1_config
  FROM sucos_disponiveis 
  WHERE id = ANY(sucos_ativos)
  ORDER BY 
    CASE 
      WHEN id = 101 THEN 1  -- Pro Mix
      WHEN id = 102 THEN 2  -- Pro Vita  
      WHEN id = 103 THEN 3  -- Diet
      WHEN id = 104 THEN 4  -- Natural
      ELSE 5
    END
  LIMIT 1;
  
  -- Selecionar SUCO2 (diferente do SUCO1)
  SELECT jsonb_build_object('id', id, 'nome', nome)
  INTO suco2_config
  FROM sucos_disponiveis 
  WHERE id = ANY(sucos_ativos) 
    AND id != (suco1_config->>'id')::int
  ORDER BY 
    CASE 
      WHEN id = 101 THEN 1  -- Pro Mix
      WHEN id = 102 THEN 2  -- Pro Vita
      WHEN id = 103 THEN 3  -- Diet  
      WHEN id = 104 THEN 4  -- Natural
      ELSE 5
    END
  LIMIT 1;
  
  -- Se não há segundo suco diferente, usar o mesmo
  IF suco2_config IS NULL THEN
    suco2_config := suco1_config;
  END IF;
  
  -- Construir resultado
  resultado := jsonb_build_object(
    'periodo', jsonb_build_object(
      'inicio', p_data_inicio,
      'fim', p_data_fim
    ),
    'suco1', suco1_config,
    'suco2', suco2_config,
    'sucos_configurados', sucos_ativos,
    'gerado_em', now()
  );
  
  RETURN resultado;
END;
$$;