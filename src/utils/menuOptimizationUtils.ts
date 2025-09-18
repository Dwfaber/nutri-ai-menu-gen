// Utilities for menu optimization transformation and validation

export interface MenuDay {
  date: string;
  recipes: Array<{
    receita_id: string;
    nome: string;
    meals_quantity: number;
  }>;
}

export interface GeneratedMenuData {
  menu?: Array<{
    data: string;
    refeicoes: Record<string, any>;
  }>;
  mealsPerDay?: number;
  id: string;
}

/**
 * Transforms a generated menu into the format expected by optimization function
 * @param generatedMenu The menu data from generation
 * @param mealsPerDay Number of meals per day (fallback to 50 if not provided)
 * @returns Array of MenuDay objects ready for optimization
 */
export function transformMenuForOptimization(
  generatedMenu: GeneratedMenuData,
  mealsPerDay?: number
): { menuDays: MenuDay[]; totalMeals: number } {
  if (!generatedMenu?.menu || !Array.isArray(generatedMenu.menu)) {
    throw new Error('Menu inválido: dados do cardápio não encontrados');
  }

  const defaultMealsPerDay = mealsPerDay || generatedMenu.mealsPerDay || 50;

  const menuDays: MenuDay[] = generatedMenu.menu.map((day: any) => {
    if (!day.data) {
      throw new Error('Menu inválido: data não encontrada no dia');
    }

    const recipes = Object.entries(day.refeicoes || {}).flatMap(([slot, receitas]) => {
      // Normalizar receitas para array
      const receitasArray = Array.isArray(receitas) ? receitas : [receitas];
      
      return receitasArray
        .filter(receita => receita) // Remove valores null/undefined
        .map((receita: any) => ({
          receita_id: receita.receita_id || receita.id || 'unknown',
          nome: receita.nome || receita.receita || 'Receita sem nome',
          meals_quantity: defaultMealsPerDay
        }));
    });

    return {
      date: day.data,
      recipes
    };
  });

  // Calcular total de refeições baseado nos dados reais
  const totalMeals = menuDays.reduce((total, day) => 
    total + day.recipes.reduce((dayTotal, recipe) => 
      dayTotal + recipe.meals_quantity, 0
    ), 0
  );

  return { menuDays, totalMeals };
}

/**
 * Validates menu data before optimization
 * @param generatedMenu The menu to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateMenuForOptimization(generatedMenu: GeneratedMenuData): string[] {
  const errors: string[] = [];

  if (!generatedMenu) {
    errors.push('Menu não encontrado');
    return errors;
  }

  if (!generatedMenu.menu || !Array.isArray(generatedMenu.menu)) {
    errors.push('Dados do menu são inválidos');
    return errors;
  }

  if (generatedMenu.menu.length === 0) {
    errors.push('Menu está vazio');
    return errors;
  }

  // Validar cada dia do menu
  generatedMenu.menu.forEach((day, index) => {
    if (!day.data) {
      errors.push(`Dia ${index + 1}: data não encontrada`);
    }

    const hasRecipes = day.refeicoes && 
      Object.values(day.refeicoes).some(receitas => 
        Array.isArray(receitas) ? receitas.length > 0 : receitas
      );

    if (!hasRecipes) {
      errors.push(`Dia ${index + 1}: nenhuma receita encontrada`);
    }
  });

  return errors;
}