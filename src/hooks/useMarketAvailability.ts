import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MarketIngredient {
  produto_base_id: number;
  descricao: string;
  categoria_descricao: string;
  unidade: string;
  preco: number;
  promocao: boolean;
  em_promocao_sim_nao: boolean;
  disponivel: boolean;
}

export interface ViableRecipe {
  receita_id_legado: string;
  nome_receita: string;
  categoria_descricao: string;
  custo_total: number;
  porcoes: number;
  missingIngredients: string[];
  availableIngredients: number;
  totalIngredients: number;
  isViable: boolean;
}

export const useMarketAvailability = () => {
  const [marketIngredients, setMarketIngredients] = useState<MarketIngredient[]>([]);
  const [viableRecipes, setViableRecipes] = useState<ViableRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available ingredients from market
  const fetchMarketIngredients = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select(`
          produto_base_id,
          descricao,
          categoria_descricao,
          unidade,
          preco,
          promocao,
          em_promocao_sim_nao
        `)
        .not('produto_base_id', 'is', null)
        .order('categoria_descricao');

      if (error) throw error;

      const ingredients = data?.map(item => ({
        ...item,
        disponivel: true
      })) || [];

      setMarketIngredients(ingredients);
      return ingredients;
    } catch (err) {
      console.error('Error fetching market ingredients:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar ingredientes do mercado');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Check recipe viability based on ingredient availability
  const checkRecipeViability = async (marketData?: MarketIngredient[]) => {
    try {
      const ingredients = marketData || marketIngredients;
      if (ingredients.length === 0) return [];

      const availableProductIds = new Set(ingredients.map(ing => ing.produto_base_id));

      // Fetch all recipes with their ingredients
      const { data: recipesData, error: recipesError } = await supabase
        .from('receitas_legado')
        .select(`
          receita_id_legado,
          nome_receita,
          categoria_descricao,
          custo_total,
          porcoes,
          inativa
        `)
        .eq('inativa', false);

      if (recipesError) throw recipesError;

      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('receita_ingredientes')
        .select(`
          receita_id_legado,
          produto_base_id,
          nome
        `)
        .not('produto_base_id', 'is', null);

      if (ingredientsError) throw ingredientsError;

      // Group ingredients by recipe
      const recipeIngredients: { [key: string]: any[] } = {};
      ingredientsData?.forEach(ing => {
        if (!recipeIngredients[ing.receita_id_legado]) {
          recipeIngredients[ing.receita_id_legado] = [];
        }
        recipeIngredients[ing.receita_id_legado].push(ing);
      });

      // Check viability for each recipe
      const viable = recipesData?.map(recipe => {
        const ingredients = recipeIngredients[recipe.receita_id_legado] || [];
        const totalIngredients = ingredients.length;
        
        const availableIngredients = ingredients.filter(ing => 
          availableProductIds.has(ing.produto_base_id)
        ).length;

        const missingIngredients = ingredients
          .filter(ing => !availableProductIds.has(ing.produto_base_id))
          .map(ing => ing.nome);

        const isViable = totalIngredients > 0 && (availableIngredients / totalIngredients) >= 0.8; // 80% dos ingredientes disponíveis

        return {
          receita_id_legado: recipe.receita_id_legado,
          nome_receita: recipe.nome_receita,
          categoria_descricao: recipe.categoria_descricao,
          custo_total: recipe.custo_total,
          porcoes: recipe.porcoes,
          missingIngredients,
          availableIngredients,
          totalIngredients,
          isViable
        };
      }).filter(recipe => recipe.isViable) || [];

      setViableRecipes(viable);
      return viable;
    } catch (err) {
      console.error('Error checking recipe viability:', err);
      setError(err instanceof Error ? err.message : 'Erro ao verificar viabilidade das receitas');
      return [];
    }
  };

  // Get viable recipes by category
  const getViableRecipesByCategory = (category: string) => {
    return viableRecipes.filter(recipe => recipe.categoria_descricao === category);
  };

  // Get market ingredients by category
  const getMarketIngredientsByCategory = (category: string) => {
    return marketIngredients.filter(ing => ing.categoria_descricao === category);
  };

  // Check if specific ingredient is available
  const isIngredientAvailable = (produtoBaseId: number) => {
    return marketIngredients.some(ing => ing.produto_base_id === produtoBaseId);
  };

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      const ingredients = await fetchMarketIngredients();
      if (ingredients.length > 0) {
        await checkRecipeViability(ingredients);
      }
    };

    initializeData();
  }, []);

  return {
    marketIngredients,
    viableRecipes,
    loading,
    error,
    fetchMarketIngredients,
    checkRecipeViability,
    getViableRecipesByCategory,
    getMarketIngredientsByCategory,
    isIngredientAvailable
  };
};