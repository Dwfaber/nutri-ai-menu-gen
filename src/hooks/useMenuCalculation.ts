/**
 * Hook for local menu calculation logic
 */

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { calculateRecipeCost, findProductByName, type IngredientCostDetails } from '@/utils/menuCalculations';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = "https://wzbhhioegxdpegirglbq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YmhoaW9lZ3hkcGVnaXJnbGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDA0MDUsImV4cCI6MjA2ODA3NjQwNX0.ufwv_XD8LZ2SGMPYUy7Z-CkK2GRNx8mailJb6ZRZHXQ";

const localSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export interface MenuCalculationProgress {
  stage: 'fetching_products' | 'calculating_costs' | 'processing_recipes' | 'finalizing';
  current: number;
  total: number;
  message: string;
}

export interface CalculatedMenu {
  recipes: any[];
  totalCost: number;
  costPerMeal: number;
  violatedIngredients: IngredientCostDetails[];
  ingredientDetails: IngredientCostDetails[];
}

export function useMenuCalculation() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState<MenuCalculationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const updateProgress = (stage: 'fetching_products' | 'calculating_costs' | 'processing_recipes' | 'finalizing', current: number, total: number, message: string) => {
    setProgress({ stage, current, total, message });
  };

  const fetchMarketProducts = async (): Promise<any[]> => {
    updateProgress('fetching_products', 0, 1, 'Carregando produtos do mercado...');
    
    const { data, error } = await localSupabase
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .eq('disponivel_sim_nao', true)
      .order('preco_reais', { ascending: true });

    if (error) {
      throw new Error(`Erro ao carregar produtos: ${error.message}`);
    }

    return data || [];
  };

  const calculateMenuCosts = async (
    recipes: any[],
    mealQuantity: number = 50
  ): Promise<CalculatedMenu> => {
    setIsCalculating(true);
    setError(null);
    
    try {
      // 1. Fetch products
      const produtos = await fetchMarketProducts();
      updateProgress('fetching_products', 1, 1, `${produtos.length} produtos carregados`);

      // 2. Process each recipe
      updateProgress('calculating_costs', 0, recipes.length, 'Calculando custos das receitas...');
      
      let totalCost = 0;
      const allIngredientDetails: IngredientCostDetails[] = [];
      const violatedIngredients: IngredientCostDetails[] = [];
      const processedRecipes = [];

      for (let i = 0; i < recipes.length; i++) {
        const recipe = recipes[i];
        updateProgress('calculating_costs', i + 1, recipes.length, `Processando: ${recipe.nome || 'Receita ' + (i + 1)}`);

        // Calculate cost for this recipe
        const { custo, ingredientes } = calculateRecipeCost(recipe, produtos, mealQuantity);
        
        // Update recipe with cost
        const processedRecipe = {
          ...recipe,
          custo_total: custo,
          custo_por_refeicao: custo / mealQuantity,
          ingredientes_calculados: ingredientes
        };
        
        processedRecipes.push(processedRecipe);
        totalCost += custo;
        allIngredientDetails.push(...ingredientes);
        
        // Collect violations
        const violated = ingredientes.filter(ing => ing.violacao || !ing.produto_encontrado);
        violatedIngredients.push(...violated);

        // Small delay to prevent UI blocking
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      // 3. Finalize
      updateProgress('finalizing', 1, 1, 'Finalizando cálculos...');
      
      const costPerMeal = totalCost / mealQuantity;

      console.log(`Menu calculation completed:`, {
        totalRecipes: recipes.length,
        totalCost: totalCost.toFixed(2),
        costPerMeal: costPerMeal.toFixed(2),
        violations: violatedIngredients.length
      });

      return {
        recipes: processedRecipes,
        totalCost,
        costPerMeal,
        violatedIngredients,
        ingredientDetails: allIngredientDetails
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      
      toast({
        title: "Erro no cálculo",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsCalculating(false);
      setProgress(null);
    }
  };

  const findIngredientProducts = async (ingredientName: string): Promise<any[]> => {
    try {
      const produtos = await fetchMarketProducts();
      return findProductByName(ingredientName, produtos);
    } catch (error) {
      console.error('Error finding ingredient products:', error);
      return [];
    }
  };

  return {
    isCalculating,
    progress,
    error,
    calculateMenuCosts,
    findIngredientProducts,
    clearError: () => setError(null)
  };
}