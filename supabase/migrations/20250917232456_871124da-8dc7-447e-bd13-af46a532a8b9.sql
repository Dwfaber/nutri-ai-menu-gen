-- Add policy to allow system/edge functions to insert recipe data during sync
CREATE POLICY "Sistema pode inserir receitas na sincronização" 
ON public.receitas_legado 
FOR INSERT 
WITH CHECK (true);