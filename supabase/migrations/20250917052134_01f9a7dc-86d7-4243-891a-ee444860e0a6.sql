-- Backfill total_cost e cost_per_meal dos cardápios existentes onde estão zerados
UPDATE generated_menus 
SET 
  total_cost = (
    SELECT COALESCE(
      SUM(
        COALESCE(
          (recipe->>'cost')::numeric,
          (recipe->>'custo')::numeric,
          (recipe->>'custo_por_refeicao')::numeric,
          0
        )
      ),
      0
    )
    FROM jsonb_array_elements(recipes) AS recipe
    WHERE recipes IS NOT NULL AND jsonb_array_length(recipes) > 0
  ),
  cost_per_meal = (
    SELECT COALESCE(
      SUM(
        COALESCE(
          (recipe->>'cost')::numeric,
          (recipe->>'custo')::numeric,
          (recipe->>'custo_por_refeicao')::numeric,
          0
        )
      ) / GREATEST(meals_per_day, 1),
      0
    )
    FROM jsonb_array_elements(recipes) AS recipe
    WHERE recipes IS NOT NULL AND jsonb_array_length(recipes) > 0
  )
WHERE 
  (total_cost = 0 OR total_cost IS NULL OR cost_per_meal = 0 OR cost_per_meal IS NULL)
  AND recipes IS NOT NULL 
  AND jsonb_array_length(recipes) > 0;