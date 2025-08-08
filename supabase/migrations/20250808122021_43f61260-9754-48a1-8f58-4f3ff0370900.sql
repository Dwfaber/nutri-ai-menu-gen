
-- 1) Remover duplicados em receita_ingredientes, mantendo o registro mais recente
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY receita_id_legado, receita_produto_id
      ORDER BY sync_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.receita_ingredientes
)
DELETE FROM public.receita_ingredientes ri
USING ranked r
WHERE ri.id = r.id
  AND r.rn > 1;

-- 2) Garantir que futuros upserts façam update em vez de inserir novos duplicados
CREATE UNIQUE INDEX IF NOT EXISTS ux_receita_ingredientes_legado_prod
  ON public.receita_ingredientes (receita_id_legado, receita_produto_id);

-- 3) (Opcional mas recomendado) Índice auxiliar para consultas por receita
CREATE INDEX IF NOT EXISTS idx_receita_ingredientes_receita
  ON public.receita_ingredientes (receita_id_legado);
