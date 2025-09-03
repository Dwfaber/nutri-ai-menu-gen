-- Recriar tabela sucos_disponiveis com estrutura melhorada
DROP TABLE IF EXISTS sucos_disponiveis;

CREATE TABLE sucos_disponiveis (
  produto_base_id integer PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('pro_mix','vita_suco','diet','natural')),
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Inserir dados reais dos produtos base
-- Pró Mix (9 produtos)
INSERT INTO sucos_disponiveis (produto_base_id, tipo, nome) VALUES
  (437, 'pro_mix', 'Suco Pró Mix Laranja'),
  (438, 'pro_mix', 'Suco Pró Mix Uva'),
  (439, 'pro_mix', 'Suco Pró Mix Maçã'),
  (440, 'pro_mix', 'Suco Pró Mix Pêssego'),
  (441, 'pro_mix', 'Suco Pró Mix Manga'),
  (442, 'pro_mix', 'Suco Pró Mix Goiaba'),
  (443, 'pro_mix', 'Suco Pró Mix Caju'),
  (444, 'pro_mix', 'Suco Pró Mix Maracujá'),
  (445, 'pro_mix', 'Suco Pró Mix Abacaxi');

-- Vita Suco/Regulares (16 produtos)
INSERT INTO sucos_disponiveis (produto_base_id, tipo, nome) VALUES
  (315, 'vita_suco', 'Vita Suco Laranja'),
  (316, 'vita_suco', 'Vita Suco Uva'),
  (317, 'vita_suco', 'Vita Suco Maçã'),
  (318, 'vita_suco', 'Vita Suco Pêssego'),
  (319, 'vita_suco', 'Vita Suco Manga'),
  (320, 'vita_suco', 'Vita Suco Goiaba'),
  (321, 'vita_suco', 'Vita Suco Caju'),
  (322, 'vita_suco', 'Vita Suco Maracujá'),
  (323, 'vita_suco', 'Vita Suco Abacaxi'),
  (324, 'vita_suco', 'Vita Suco Acerola'),
  (325, 'vita_suco', 'Vita Suco Tangerina'),
  (364, 'vita_suco', 'Vita Suco Tropical'),
  (367, 'vita_suco', 'Vita Suco Morango'),
  (368, 'vita_suco', 'Vita Suco Limão'),
  (369, 'vita_suco', 'Vita Suco Cajá'),
  (370, 'vita_suco', 'Vita Suco Graviola');

-- Diet (5 produtos)
INSERT INTO sucos_disponiveis (produto_base_id, tipo, nome) VALUES
  (385, 'diet', 'Suco Diet Laranja'),
  (386, 'diet', 'Suco Diet Uva'),
  (388, 'diet', 'Suco Diet Maçã'),
  (389, 'diet', 'Suco Diet Pêssego'),
  (390, 'diet', 'Suco Diet Manga');

-- Natural/Concentrados (13 produtos)
INSERT INTO sucos_disponiveis (produto_base_id, tipo, nome) VALUES
  (371, 'natural', 'Suco Natural Laranja'),
  (372, 'natural', 'Suco Natural Uva'),
  (373, 'natural', 'Suco Natural Maçã'),
  (374, 'natural', 'Suco Natural Pêssego'),
  (375, 'natural', 'Suco Natural Manga'),
  (376, 'natural', 'Suco Natural Goiaba'),
  (377, 'natural', 'Suco Natural Caju'),
  (378, 'natural', 'Suco Natural Maracujá'),
  (379, 'natural', 'Suco Natural Abacaxi'),
  (380, 'natural', 'Suco Natural Acerola'),
  (381, 'natural', 'Suco Natural Tangerina'),
  (382, 'natural', 'Suco Natural Tropical'),
  (383, 'natural', 'Suco Natural Morango');

-- Atualizar função gerar_cardapio para usar a nova estrutura
CREATE OR REPLACE FUNCTION public.gerar_cardapio(
  p_data_inicio text, 
  p_data_fim text, 
  p_use_pro_mix boolean DEFAULT false, 
  p_use_pro_vita boolean DEFAULT false, 
  p_use_suco_diet boolean DEFAULT false, 
  p_use_suco_natural boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  resultado jsonb := '{}';
  suco1_config jsonb;
  suco2_config jsonb;
  tipos_ativos text[] := ARRAY[]::text[];
  cardapio_semanal jsonb := '[]'::jsonb;
  dia_atual date;
  suco1_id int;
  suco1_nome text;
  suco2_id int;
  suco2_nome text;
BEGIN
  -- Construir array de tipos ativos baseado nas flags
  IF p_use_pro_mix THEN
    tipos_ativos := tipos_ativos || 'pro_mix';
  END IF;
  
  IF p_use_pro_vita THEN
    tipos_ativos := tipos_ativos || 'vita_suco';
  END IF;
  
  IF p_use_suco_diet THEN
    tipos_ativos := tipos_ativos || 'diet';
  END IF;
  
  IF p_use_suco_natural THEN
    tipos_ativos := tipos_ativos || 'natural';
  END IF;
  
  -- Se nenhum suco configurado, usar Natural como padrão
  IF array_length(tipos_ativos, 1) IS NULL THEN
    tipos_ativos := ARRAY['natural'];
  END IF;
  
  -- Gerar cardápio para cada dia útil no período
  dia_atual := p_data_inicio::date;
  WHILE dia_atual <= p_data_fim::date LOOP
    -- Só processar dias úteis (segunda a sexta)
    IF EXTRACT(ISODOW FROM dia_atual) BETWEEN 1 AND 5 THEN
      
      -- Selecionar SUCO1 (prioridade: Pró Mix → Vita Suco → Diet → Natural)
      SELECT produto_base_id, nome
      INTO suco1_id, suco1_nome
      FROM sucos_disponiveis 
      WHERE tipo = ANY(tipos_ativos)
        AND ativo = true
      ORDER BY 
        CASE 
          WHEN tipo = 'pro_mix' THEN 1
          WHEN tipo = 'vita_suco' THEN 2
          WHEN tipo = 'diet' THEN 3
          WHEN tipo = 'natural' THEN 4
          ELSE 5
        END,
        RANDOM()
      LIMIT 1;
      
      -- Selecionar SUCO2 (diferente do SUCO1, se possível)
      SELECT produto_base_id, nome
      INTO suco2_id, suco2_nome
      FROM sucos_disponiveis 
      WHERE tipo = ANY(tipos_ativos)
        AND ativo = true
        AND produto_base_id != COALESCE(suco1_id, 0)
      ORDER BY 
        CASE 
          WHEN tipo = 'pro_mix' THEN 1
          WHEN tipo = 'vita_suco' THEN 2
          WHEN tipo = 'diet' THEN 3
          WHEN tipo = 'natural' THEN 4
          ELSE 5
        END,
        RANDOM()
      LIMIT 1;
      
      -- Se não encontrou SUCO2 diferente, usar o mesmo que SUCO1
      IF suco2_id IS NULL THEN
        suco2_id := suco1_id;
        suco2_nome := suco1_nome;
      END IF;
      
      -- Adicionar dia ao cardápio
      cardapio_semanal := cardapio_semanal || jsonb_build_object(
        'data', dia_atual,
        'dia_semana', CASE EXTRACT(ISODOW FROM dia_atual)
          WHEN 1 THEN 'Segunda-feira'
          WHEN 2 THEN 'Terça-feira'
          WHEN 3 THEN 'Quarta-feira'
          WHEN 4 THEN 'Quinta-feira'
          WHEN 5 THEN 'Sexta-feira'
        END,
        'suco1', jsonb_build_object(
          'id', suco1_id,
          'nome', suco1_nome
        ),
        'suco2', jsonb_build_object(
          'id', suco2_id,
          'nome', suco2_nome
        ),
        'sobremesa', CASE EXTRACT(ISODOW FROM dia_atual)
          WHEN 1 THEN 'Fruta da estação'
          WHEN 2 THEN 'Gelatina'
          WHEN 3 THEN 'Doce de leite'
          WHEN 4 THEN 'Salada de frutas'
          WHEN 5 THEN 'Fruta da estação'
        END
      );
      
    END IF;
    
    dia_atual := dia_atual + interval '1 day';
  END LOOP;
  
  -- Construir resultado final
  resultado := jsonb_build_object(
    'periodo', jsonb_build_object(
      'inicio', p_data_inicio,
      'fim', p_data_fim
    ),
    'tipos_configurados', tipos_ativos,
    'cardapio_semanal', cardapio_semanal,
    'gerado_em', now()
  );
  
  RETURN resultado;
END;
$function$;