-- Backfill receitas_adaptadas (jsonb) e receitas_ids (text[]) a partir de recipes
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
    SELECT array_agg((recipe->>'id')::text)
    FROM jsonb_array_elements(recipes) AS recipe
    WHERE recipe->>'id' IS NOT NULL
  )
WHERE 
  (receitas_adaptadas IS NULL OR receitas_adaptadas = '[]'::jsonb)
  AND (receitas_ids IS NULL OR array_length(receitas_ids,1) = 0)
  AND recipes IS NOT NULL 
  AND jsonb_array_length(recipes) > 0;