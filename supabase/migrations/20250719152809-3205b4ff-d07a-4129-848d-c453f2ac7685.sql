
-- Adicionar novos campos à tabela receitas_legado para comportar dados da view cpReceitas
ALTER TABLE public.receitas_legado 
ADD COLUMN categoria_id INTEGER,
ADD COLUMN quantidade_refeicoes INTEGER DEFAULT 1,
ADD COLUMN inativa BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN usuario TEXT,
ADD COLUMN categoria_descricao TEXT;

-- Criar índices para melhor performance
CREATE INDEX idx_receitas_legado_categoria_id ON public.receitas_legado(categoria_id);
CREATE INDEX idx_receitas_legado_inativa ON public.receitas_legado(inativa);
CREATE INDEX idx_receitas_legado_usuario ON public.receitas_legado(usuario);

-- Atualizar comentários da tabela
COMMENT ON COLUMN public.receitas_legado.categoria_id IS 'ID numérico da categoria da receita';
COMMENT ON COLUMN public.receitas_legado.quantidade_refeicoes IS 'Número de refeições que a receita serve';
COMMENT ON COLUMN public.receitas_legado.inativa IS 'Indica se a receita está ativa ou inativa';
COMMENT ON COLUMN public.receitas_legado.usuario IS 'Usuário que criou ou editou a receita';
COMMENT ON COLUMN public.receitas_legado.categoria_descricao IS 'Descrição textual da categoria';
