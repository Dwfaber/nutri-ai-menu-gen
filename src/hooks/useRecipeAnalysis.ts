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
  ingredientes: any;
}

interface CategorySummary {
  name: string;
  count: number;
  withCost: number;
  withoutCost: number;
  withIngredients: number;
  withoutIngredients: number;
}

interface RecipeStatistics {
  total: number;
  withCost: number;
  withoutCost: number;
  withIngredients: number;
  withoutIngredients: number;
  active: number;
  inactive: number;
  readyForProduction: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
}

interface RecipeStatus {
  costStatus: 'with_cost' | 'without_cost' | 'null_cost';
  ingredientStatus: 'complete' | 'partial' | 'none';
  activeStatus: 'active' | 'inactive';
  priority: 'high' | 'medium' | 'low';
  readyForProduction: boolean;
}

interface ProblematicRecipe {
  id: string;
  nome_receita: string;
  categoria_descricao: string | null;
  issues: string[];
  priority: 'high' | 'medium' | 'low';
}

export const useRecipeAnalysis = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [statistics, setStatistics] = useState<RecipeStatistics | null>(null);
  const [problematicRecipes, setProblematicRecipes] = useState<ProblematicRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const analyzeRecipeStatus = (recipe: Recipe): RecipeStatus => {
    const ingredientesArray = Array.isArray(recipe.ingredientes) ? recipe.ingredientes : [];
    const hasIngredients = ingredientesArray.length > 0;
    const hasCost = recipe.custo_total !== null && recipe.custo_total > 0;
    
    return {
      costStatus: hasCost ? 'with_cost' : recipe.custo_total === null ? 'null_cost' : 'without_cost',
      ingredientStatus: hasIngredients ? 'complete' : 'none',
      activeStatus: recipe.inativa ? 'inactive' : 'active',
      priority: !hasIngredients ? 'high' : !hasCost ? 'medium' : 'low',
      readyForProduction: hasCost && hasIngredients && !recipe.inativa
    };
  };

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoading(true);
        setError(null);

        // Buscar receitas com ingredientes
        const { data: recipesData, error: fetchError } = await supabase
          .from('receitas_legado')
          .select(`
            *,
            ingredientes
          `)
          .order('nome_receita');

        if (fetchError) {
          throw fetchError;
        }

        const recipesWithAnalysis = (recipesData || []).map(recipe => {
          const ingredientesArray = Array.isArray(recipe.ingredientes) ? recipe.ingredientes : [];
          return {
            ...recipe,
            ingredientes: ingredientesArray,
            status: analyzeRecipeStatus({ ...recipe, ingredientes: ingredientesArray })
          };
        });

        setRecipes(recipesWithAnalysis);

        // Calcular estatísticas detalhadas
        const stats: RecipeStatistics = {
          total: recipesWithAnalysis.length,
          withCost: recipesWithAnalysis.filter(r => r.custo_total !== null && r.custo_total > 0).length,
          withoutCost: recipesWithAnalysis.filter(r => r.custo_total === null || r.custo_total === 0).length,
          withIngredients: recipesWithAnalysis.filter(r => {
            const ingredientesArray = Array.isArray(r.ingredientes) ? r.ingredientes : [];
            return ingredientesArray.length > 0;
          }).length,
          withoutIngredients: recipesWithAnalysis.filter(r => {
            const ingredientesArray = Array.isArray(r.ingredientes) ? r.ingredientes : [];
            return ingredientesArray.length === 0;
          }).length,
          active: recipesWithAnalysis.filter(r => !r.inativa).length,
          inactive: recipesWithAnalysis.filter(r => r.inativa).length,
          readyForProduction: recipesWithAnalysis.filter(r => {
            const ingredientesArray = Array.isArray(r.ingredientes) ? r.ingredientes : [];
            return analyzeRecipeStatus({ ...r, ingredientes: ingredientesArray }).readyForProduction;
          }).length,
          highPriority: recipesWithAnalysis.filter(r => {
            const ingredientesArray = Array.isArray(r.ingredientes) ? r.ingredientes : [];
            return analyzeRecipeStatus({ ...r, ingredientes: ingredientesArray }).priority === 'high';
          }).length,
          mediumPriority: recipesWithAnalysis.filter(r => {
            const ingredientesArray = Array.isArray(r.ingredientes) ? r.ingredientes : [];
            return analyzeRecipeStatus({ ...r, ingredientes: ingredientesArray }).priority === 'medium';
          }).length,
          lowPriority: recipesWithAnalysis.filter(r => {
            const ingredientesArray = Array.isArray(r.ingredientes) ? r.ingredientes : [];
            return analyzeRecipeStatus({ ...r, ingredientes: ingredientesArray }).priority === 'low';
          }).length,
        };

        setStatistics(stats);

        // Identificar receitas problemáticas
        const problematic: ProblematicRecipe[] = recipesWithAnalysis
          .filter(recipe => {
            const ingredientesArray = Array.isArray(recipe.ingredientes) ? recipe.ingredientes : [];
            const status = analyzeRecipeStatus({ ...recipe, ingredientes: ingredientesArray });
            return status.priority === 'high' || status.priority === 'medium';
          })
          .map(recipe => {
            const ingredientesArray = Array.isArray(recipe.ingredientes) ? recipe.ingredientes : [];
            const status = analyzeRecipeStatus({ ...recipe, ingredientes: ingredientesArray });
            const issues: string[] = [];
            
            if (ingredientesArray.length === 0) {
              issues.push('Sem ingredientes');
            }
            if (recipe.custo_total === null || recipe.custo_total === 0) {
              issues.push('Sem custo calculado');
            }
            if (recipe.inativa) {
              issues.push('Receita inativa');
            }

            return {
              id: recipe.id,
              nome_receita: recipe.nome_receita,
              categoria_descricao: recipe.categoria_descricao,
              issues,
              priority: status.priority
            };
          })
          .sort((a, b) => {
            if (a.priority === 'high' && b.priority !== 'high') return -1;
            if (b.priority === 'high' && a.priority !== 'high') return 1;
            return 0;
          });

        setProblematicRecipes(problematic);

        // Análise por categoria
        const categoryMap = new Map<string, CategorySummary>();
        recipesWithAnalysis.forEach(recipe => {
          const category = recipe.categoria_descricao || 'Sem Categoria';
          const existing = categoryMap.get(category) || {
            name: category,
            count: 0,
            withCost: 0,
            withoutCost: 0,
            withIngredients: 0,
            withoutIngredients: 0
          };

          existing.count++;
          if (recipe.custo_total !== null && recipe.custo_total > 0) {
            existing.withCost++;
          } else {
            existing.withoutCost++;
          }
          const ingredientesArray = Array.isArray(recipe.ingredientes) ? recipe.ingredientes : [];
          if (ingredientesArray.length > 0) {
            existing.withIngredients++;
          } else {
            existing.withoutIngredients++;
          }

          categoryMap.set(category, existing);
        });

        const categorySummary = Array.from(categoryMap.values())
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

  const getRecipeStatus = (recipe: Recipe): RecipeStatus => {
    return analyzeRecipeStatus(recipe);
  };

  const getRecipesByStatus = (status: 'with_cost' | 'without_cost' | 'with_ingredients' | 'without_ingredients' | 'high_priority' | 'medium_priority' | 'ready_for_production') => {
    return recipes.filter(recipe => {
      const recipeStatus = analyzeRecipeStatus(recipe);
      switch (status) {
        case 'with_cost':
          return recipeStatus.costStatus === 'with_cost';
        case 'without_cost':
          return recipeStatus.costStatus === 'without_cost' || recipeStatus.costStatus === 'null_cost';
        case 'with_ingredients':
          return recipeStatus.ingredientStatus === 'complete';
        case 'without_ingredients':
          return recipeStatus.ingredientStatus === 'none';
        case 'high_priority':
          return recipeStatus.priority === 'high';
        case 'medium_priority':
          return recipeStatus.priority === 'medium';
        case 'ready_for_production':
          return recipeStatus.readyForProduction;
        default:
          return false;
      }
    });
  };

  return {
    recipes,
    categories,
    statistics,
    problematicRecipes,
    loading,
    error,
    getRecipeStatus,
    getRecipesByStatus,
    analyzeRecipeStatus,
  };
};