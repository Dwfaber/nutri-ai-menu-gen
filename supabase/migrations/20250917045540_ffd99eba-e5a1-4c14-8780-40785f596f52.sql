-- Atualizar cardápios existentes para incluir receitas_adaptadas e receitas_ids
-- baseado no campo recipes existente
UPDATE generated_menus 
SET 
  receitas_adaptadas = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'receita_id_legado', (recipe->>'id')::text,
        'nome', COALESCE(recipe->>'name', 'Item'),
        'categoria', COALESCE(recipe->>'category', 'Outros'),
        'custo_por_porcao', COALESCE((recipe->>'cost')::numeric, 0),
        'porcoes_calculadas', COALESCE(meals_per_day, 50)
      )
    )
    FROM jsonb_array_elements(recipes) AS recipe
  ),
  receitas_ids = (
    SELECT jsonb_agg((recipe->>'id')::text)
    FROM jsonb_array_elements(recipes) AS recipe
    WHERE recipe->>'id' IS NOT NULL
  )
WHERE 
  (receitas_adaptadas IS NULL OR receitas_adaptadas = '[]'::jsonb)
  AND recipes IS NOT NULL 
  AND jsonb_array_length(recipes) > 0;