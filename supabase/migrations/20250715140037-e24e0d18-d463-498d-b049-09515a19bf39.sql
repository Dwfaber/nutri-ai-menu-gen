
-- Create shopping_lists table to link menus with purchase lists
CREATE TABLE public.shopping_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  budget_predicted NUMERIC NOT NULL DEFAULT 0,
  cost_actual NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for shopping_lists
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

-- Create policies for shopping_lists
CREATE POLICY "Sistema pode gerenciar listas de compras" 
  ON public.shopping_lists 
  FOR ALL 
  USING (true);

CREATE POLICY "Todos podem visualizar listas de compras" 
  ON public.shopping_lists 
  FOR SELECT 
  USING (true);

-- Create shopping_list_items table for detailed items
CREATE TABLE public.shopping_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopping_list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  product_id_legado TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for shopping_list_items
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

-- Create policies for shopping_list_items
CREATE POLICY "Sistema pode gerenciar itens de lista" 
  ON public.shopping_list_items 
  FOR ALL 
  USING (true);

CREATE POLICY "Todos podem visualizar itens de lista" 
  ON public.shopping_list_items 
  FOR SELECT 
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_shopping_lists_menu_id ON public.shopping_lists(menu_id);
CREATE INDEX idx_shopping_lists_status ON public.shopping_lists(status);
CREATE INDEX idx_shopping_list_items_shopping_list_id ON public.shopping_list_items(shopping_list_id);
CREATE INDEX idx_shopping_list_items_product_id ON public.shopping_list_items(product_id_legado);
