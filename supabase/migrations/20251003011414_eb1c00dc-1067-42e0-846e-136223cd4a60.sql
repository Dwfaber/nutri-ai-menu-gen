-- Criar tabela de configuração de produtos pré-prontos
CREATE TABLE IF NOT EXISTS produtos_pre_prontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_base_id integer NOT NULL UNIQUE,
  tipo_preparo text NOT NULL CHECK (tipo_preparo IN ('pronto', 'semi_preparado', 'base')),
  nome_produto text NOT NULL,
  categoria text,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar coluna de classificação em receitas_legado
ALTER TABLE receitas_legado 
ADD COLUMN IF NOT EXISTS tipo_preparo text;

-- RLS policies
ALTER TABLE produtos_pre_prontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar produtos pré-prontos"
  ON produtos_pre_prontos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos podem visualizar produtos pré-prontos"
  ON produtos_pre_prontos FOR SELECT
  USING (true);

-- Popular com dados conhecidos de produtos pré-prontos
INSERT INTO produtos_pre_prontos (produto_base_id, tipo_preparo, nome_produto, categoria, notas) VALUES
  (480, 'pronto', 'MEDALHÃO DE FRANGO', 'Prato Principal 1', 'Produto comprado pronto, apenas aquece'),
  (481, 'pronto', 'HAMBÚRGUER', 'Prato Principal 2', 'Produto pré-moldado')
ON CONFLICT (produto_base_id) DO NOTHING;