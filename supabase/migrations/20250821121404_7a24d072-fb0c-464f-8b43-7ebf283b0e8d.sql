-- Adicionar constraint UNIQUE na coluna receita_id_legado para permitir upserts
ALTER TABLE receitas_legado ADD CONSTRAINT receitas_legado_receita_id_legado_unique UNIQUE (receita_id_legado);