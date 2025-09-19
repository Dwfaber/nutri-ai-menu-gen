import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Recipe {
  id: string;
  receita_id_legado: string;
  nome_receita: string;
  categoria_descricao: string | null;
  categoria_receita: string | null;
  custo_total: number | null;
  porcoes: number | null;
  tempo_preparo: number | null;
  inativa: boolean;
  modo_preparo: string | null;
  usuario: string | null;
  sync_at: string;
  created_at: string;
}

interface CategorySummary {
  name: string;
  count: number;
}

export const useRecipeAnalysis = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('receitas_legado')
          .select('*')
          .order('nome_receita');

        if (fetchError) {
          throw fetchError;
        }

        setRecipes(data || []);

        // Group by category and count
        const categoryMap = new Map<string, number>();
        (data || []).forEach(recipe => {
          const category = recipe.categoria_descricao || 'Sem Categoria';
          categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
        });

        const categorySummary = Array.from(categoryMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        setCategories(categorySummary);
      } catch (err) {
        console.error('Erro ao buscar receitas:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, []);

  return {
    recipes,
    categories,
    loading,
    error,
  };
};