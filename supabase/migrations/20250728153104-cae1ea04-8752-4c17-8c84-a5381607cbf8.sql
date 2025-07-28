-- Criar tabela para cardápios gerados
CREATE TABLE public.generated_menus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  week_period TEXT NOT NULL,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  cost_per_meal NUMERIC NOT NULL DEFAULT 0,
  total_recipes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  approved_by TEXT,
  rejected_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para receitas do cardápio
CREATE TABLE public.menu_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id UUID NOT NULL REFERENCES public.generated_menus(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  day TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  servings INTEGER NOT NULL DEFAULT 1,
  ingredients JSONB DEFAULT '[]'::jsonb,
  nutritional_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.generated_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_recipes ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Sistema pode gerenciar cardápios gerados" 
ON public.generated_menus 
FOR ALL 
USING (true);

CREATE POLICY "Todos podem visualizar cardápios gerados" 
ON public.generated_menus 
FOR SELECT 
USING (true);

CREATE POLICY "Sistema pode gerenciar receitas de cardápios" 
ON public.menu_recipes 
FOR ALL 
USING (true);

CREATE POLICY "Todos podem visualizar receitas de cardápios" 
ON public.menu_recipes 
FOR SELECT 
USING (true);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_generated_menus_updated_at
BEFORE UPDATE ON public.generated_menus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_generated_menus_client_id ON public.generated_menus(client_id);
CREATE INDEX idx_generated_menus_status ON public.generated_menus(status);
CREATE INDEX idx_menu_recipes_menu_id ON public.menu_recipes(menu_id);
CREATE INDEX idx_menu_recipes_day ON public.menu_recipes(day);