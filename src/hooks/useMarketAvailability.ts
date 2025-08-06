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
  quantidade_embalagem?: number;
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
          em_promocao_sim_nao,
          quantidade_embalagem
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

  // Calculate real cost of a recipe using proportional scaling and AI analysis
  const calculateRecipeRealCost = async (receitaId: string, targetServings?: number): Promise<number> => {
    try {
      console.log(`Calculando custo real da receita ${receitaId} para ${targetServings || 'servings originais'}...`);
      
      // Get recipe info including quantidade_refeicoes for proper scaling
      const { data: recipeData, error: recipeError } = await supabase
        .from('receitas_legado')
        .select('quantidade_refeicoes, porcoes')
        .eq('receita_id_legado', receitaId)
        .single();
        
      if (recipeError || !recipeData) {
        console.error('Recipe not found:', recipeError);
        return await calculateBasicRecipeCost(receitaId);
      }
      
      const originalServings = recipeData.quantidade_refeicoes || recipeData.porcoes || 1;
      const scalingFactor = targetServings ? (targetServings / originalServings) : 1;
      
      console.log(`Recipe serves ${originalServings}, scaling factor: ${scalingFactor}`);
      
      // Get recipe ingredients with new produto_base_descricao column
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('receita_ingredientes')
        .select('produto_base_id, quantidade, unidade, nome, produto_base_descricao')
        .eq('receita_id_legado', receitaId);
        
      if (ingredientsError || !ingredients?.length) {
        console.error('Ingredients not found:', ingredientsError);
        return 0;
      }
      
      // Try AI-powered calculation with proportional scaling
      try {
        const { data, error: functionError } = await supabase.functions.invoke('gpt-assistant', {
          body: {
            action: 'calculateRecipeCost',
            recipeId: receitaId,
            ingredients: ingredients,
            scalingFactor: scalingFactor,
            originalServings: originalServings,
            targetServings: targetServings,
            marketProducts: marketIngredients,
            includeOptimizations: true
          }
        });

        if (!functionError && data.success && data.cost > 0) {
          console.log(`Custo calculado pela IA com proporção: R$ ${data.cost.toFixed(2)}`);
          return data.cost;
        }
      } catch (aiError) {
        console.warn('AI calculation failed, using fallback:', aiError);
      }

      // Fallback to basic calculation with scaling
      return await calculateBasicRecipeCost(receitaId, scalingFactor);
    } catch (error) {
      console.error('Error calculating recipe real cost:', error);
      return await calculateBasicRecipeCost(receitaId);
    }
  };

  // Fallback basic cost calculation with scaling support
  const calculateBasicRecipeCost = async (receitaId: string, scalingFactor: number = 1): Promise<number> => {
    try {
      // Get recipe ingredients with quantities
      const { data: ingredientsData, error } = await supabase
        .from('receita_ingredientes')
        .select('produto_base_id, quantidade, unidade, nome')
        .eq('receita_id_legado', receitaId)
        .not('produto_base_id', 'is', null);

      if (error) throw error;

      let totalCost = 0;
      let foundIngredients = 0;

      // Calculate cost for each ingredient with improved matching
      for (const ingredient of ingredientsData || []) {
        const marketIngredient = marketIngredients.find(
          mi => mi.produto_base_id === ingredient.produto_base_id
        );

        if (marketIngredient && marketIngredient.preco > 0) {
          // Convert units and calculate proportional cost with scaling
          const baseQuantity = parseFloat(ingredient.quantidade?.toString()) || 0;
          const scaledQuantity = baseQuantity * scalingFactor; // Apply scaling factor
          const packageQuantity = parseFloat(marketIngredient.quantidade_embalagem?.toString()) || 1;
          
          // Use promotion price if available
          const unitPrice = marketIngredient.em_promocao_sim_nao ? 
            marketIngredient.preco * 0.85 : // 15% discount on promotion
            marketIngredient.preco;
          
          // Calculate proportional cost based on packaging and scaling
          const proportionalCost = (scaledQuantity / packageQuantity) * unitPrice;
          totalCost += proportionalCost;
          foundIngredients++;
          
          console.log(`Ingrediente: ${ingredient.nome} - Qtd original: ${baseQuantity} - Qtd escalonada: ${scaledQuantity} - Preço unit: R$ ${unitPrice.toFixed(2)} - Custo: R$ ${proportionalCost.toFixed(2)}`);
        } else {
          console.log(`Ingrediente não encontrado no mercado: ${ingredient.nome} (base_id: ${ingredient.produto_base_id})`);
        }
      }

      // If no ingredients found in market, return estimated cost
      if (foundIngredients === 0) {
        console.log(`Nenhum ingrediente encontrado no mercado para receita ${receitaId}, usando custo estimado`);
        return 5.0; // Default estimated cost
      }

      console.log(`Custo básico calculado: R$ ${totalCost.toFixed(2)} (${foundIngredients} ingredientes)`);
      return totalCost;
    } catch (error) {
      console.error('Error in basic recipe cost calculation:', error);
      return 5.0; // Default fallback cost
    }
  };

  // Calculate cost per serving for a recipe
  const calculateCostPerServing = async (receitaId: string, servings: number): Promise<number> => {
    const totalCost = await calculateRecipeRealCost(receitaId, servings);
    return servings > 0 ? totalCost / servings : 0;
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
  }, []); // Empty dependency array - run only on mount

  return {
    marketIngredients,
    viableRecipes,
    loading,
    error,
    fetchMarketIngredients,
    checkRecipeViability,
    getViableRecipesByCategory,
    getMarketIngredientsByCategory,
    isIngredientAvailable,
    calculateRecipeRealCost,
    calculateCostPerServing
  };
};