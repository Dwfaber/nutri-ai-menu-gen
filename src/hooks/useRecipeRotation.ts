import { useState } from 'react';

export interface RecipeRotationState {
  usedThisWeek: Set<string>;
  usedByCategory: Record<string, Set<string>>;
  weeklyCount: Record<string, number>;
}

export const useRecipeRotation = () => {
  const [rotationState, setRotationState] = useState<RecipeRotationState>({
    usedThisWeek: new Set(),
    usedByCategory: {},
    weeklyCount: {}
  });

  // Marcar receita como usada
  const markRecipeUsed = (recipeId: string, category: string) => {
    setRotationState(prev => ({
      ...prev,
      usedThisWeek: new Set([...prev.usedThisWeek, recipeId]),
      usedByCategory: {
        ...prev.usedByCategory,
        [category]: new Set([...(prev.usedByCategory[category] || []), recipeId])
      },
      weeklyCount: {
        ...prev.weeklyCount,
        [recipeId]: (prev.weeklyCount[recipeId] || 0) + 1
      }
    }));
  };

  // Verificar se receita foi usada
  const isRecipeUsed = (recipeId: string, category?: string): boolean => {
    if (category) {
      return rotationState.usedByCategory[category]?.has(recipeId) || false;
    }
    return rotationState.usedThisWeek.has(recipeId);
  };

  // Obter receitas não usadas de um pool
  const getUnusedRecipes = (recipes: any[], category: string): any[] => {
    return recipes.filter(recipe => 
      !isRecipeUsed(String(recipe.receita_id_legado), category)
    );
  };

  // Escolher melhor receita com rotação inteligente
  const selectBestRecipe = (
    recipes: any[], 
    category: string, 
    preferValidClassification: boolean = true
  ): any | null => {
    // Primeiro: receitas não usadas
    const unused = getUnusedRecipes(recipes, category);
    
    if (unused.length > 0) {
      if (preferValidClassification) {
        // Priorizar receitas 100% válidas
        const fullValid = unused.filter(r => r.classificacao === '100_valid');
        if (fullValid.length > 0) {
          return fullValid[0]; // Mais barata entre as 100% válidas
        }
        
        // Depois "quase válidas"
        const almostValid = unused.filter(r => r.classificacao === 'almost_valid');
        if (almostValid.length > 0) {
          return almostValid[0];
        }
      }
      
      return unused[0]; // Mais barata não usada
    }
    
    // Se todas foram usadas, resetar e usar a mais barata
    if (recipes.length > 0) {
      resetCategoryRotation(category);
      return recipes[0];
    }
    
    return null;
  };

  // Resetar rotação de uma categoria
  const resetCategoryRotation = (category: string) => {
    setRotationState(prev => ({
      ...prev,
      usedByCategory: {
        ...prev.usedByCategory,
        [category]: new Set()
      }
    }));
  };

  // Resetar rotação semanal
  const resetWeeklyRotation = () => {
    setRotationState({
      usedThisWeek: new Set(),
      usedByCategory: {},
      weeklyCount: {}
    });
  };

  // Obter estatísticas de rotação
  const getRotationStats = () => {
    const totalUsed = rotationState.usedThisWeek.size;
    const categoriesWithRotation = Object.keys(rotationState.usedByCategory).length;
    const mostUsedRecipe = Object.entries(rotationState.weeklyCount)
      .sort(([,a], [,b]) => b - a)[0];
    
    return {
      totalUsed,
      categoriesWithRotation,
      mostUsedRecipe: mostUsedRecipe ? {
        recipeId: mostUsedRecipe[0],
        count: mostUsedRecipe[1]
      } : null
    };
  };

  return {
    rotationState,
    markRecipeUsed,
    isRecipeUsed,
    getUnusedRecipes,
    selectBestRecipe,
    resetCategoryRotation,
    resetWeeklyRotation,
    getRotationStats
  };
};