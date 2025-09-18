/**
 * Mapeamento de receitas injetadas para receitas reais
 * e validação de custos de receitas
 */

// Mapeamento de itens base injetados para produto_base_id ou receitas reais
export const BASE_RECIPE_MAPPING: Record<string, { 
  id: string; 
  name: string; 
  cost: number; 
  type: 'produto_base' | 'receita' 
}> = {
  'base-injected-0': { id: '123', name: 'Arroz Branco', cost: 0.65, type: 'produto_base' },
  'base-injected-1': { id: '124', name: 'Feijão Carioca', cost: 0.85, type: 'produto_base' },
  'base-injected-2': { id: '125', name: 'Café', cost: 0.45, type: 'produto_base' },
  'base-injected-3': { id: '126', name: 'Pão', cost: 1.25, type: 'produto_base' },
  'base-injected-4': { id: '127', name: 'Margarina', cost: 0.35, type: 'produto_base' },
};

// Custos mínimos realistas por categoria
export const MINIMUM_COSTS_BY_CATEGORY: Record<string, number> = {
  'Proteína': 2.50,
  'Proteina': 2.50,
  'Guarnição': 1.20,
  'Guarnicao': 1.20,
  'Salada': 0.85,
  'Suco': 0.65,
  'Base': 0.45,
  'Sobremesa': 1.80,
  'Lanche': 1.50,
  'default': 1.75
};

// Custos máximos para detectar anomalias
export const MAXIMUM_COSTS_BY_CATEGORY: Record<string, number> = {
  'Proteína': 8.50,
  'Proteina': 8.50,
  'Guarnição': 4.20,
  'Guarnicao': 4.20,
  'Salada': 2.85,
  'Suco': 2.15,
  'Base': 1.85,
  'Sobremesa': 5.80,
  'Lanche': 4.50,
  'default': 6.00
};

/**
 * Mapeia um ID de receita injetada para uma receita real
 */
export function mapInjectedRecipe(injectedId: string): { id: string; cost: number } | null {
  const mapping = BASE_RECIPE_MAPPING[injectedId];
  if (mapping) {
    return { id: mapping.id, cost: mapping.cost };
  }
  return null;
}

/**
 * Valida se um custo está dentro dos limites realistas
 */
export function validateRecipeCost(
  cost: number, 
  category: string = 'default',
  recipeName: string = ''
): { isValid: boolean; suggestion?: number; reason?: string } {
  const minCost = MINIMUM_COSTS_BY_CATEGORY[category] || MINIMUM_COSTS_BY_CATEGORY.default;
  const maxCost = MAXIMUM_COSTS_BY_CATEGORY[category] || MAXIMUM_COSTS_BY_CATEGORY.default;
  
  // Custo muito baixo
  if (cost < minCost) {
    return {
      isValid: false,
      suggestion: minCost,
      reason: `Custo muito baixo para categoria ${category}. Mínimo esperado: R$ ${minCost.toFixed(2)}`
    };
  }
  
  // Custo muito alto (possível erro)
  if (cost > maxCost) {
    return {
      isValid: false,
      suggestion: maxCost,
      reason: `Custo muito alto para categoria ${category}. Máximo esperado: R$ ${maxCost.toFixed(2)}`
    };
  }
  
  return { isValid: true };
}

/**
 * Obtém um custo de fallback realista baseado na categoria
 */
export function getFallbackCostByCategory(category: string = 'default', recipeName: string = ''): number {
  // Se for item base
  if (recipeName.toLowerCase().includes('arroz')) return 0.65;
  if (recipeName.toLowerCase().includes('feijão') || recipeName.toLowerCase().includes('feijao')) return 0.85;
  if (recipeName.toLowerCase().includes('café') || recipeName.toLowerCase().includes('cafe')) return 0.45;
  
  // Por categoria
  const minCost = MINIMUM_COSTS_BY_CATEGORY[category] || MINIMUM_COSTS_BY_CATEGORY.default;
  const maxCost = MAXIMUM_COSTS_BY_CATEGORY[category] || MAXIMUM_COSTS_BY_CATEGORY.default;
  
  // Retorna um valor médio da faixa
  return (minCost + maxCost) / 2;
}

/**
 * Verifica se um ID de receita é artificial
 */
export function isInjectedRecipe(recipeId: string): boolean {
  return recipeId.startsWith('base-injected-') || BASE_RECIPE_MAPPING.hasOwnProperty(recipeId);
}

/**
 * Corrige custos usando validação e fallbacks
 */
export function correctRecipeCost(
  originalCost: number,
  category: string = 'default',
  recipeName: string = '',
  recipeId: string = ''
): { cost: number; wasAdjusted: boolean; reason?: string } {
  const validation = validateRecipeCost(originalCost, category, recipeName);
  
  if (validation.isValid) {
    return { cost: originalCost, wasAdjusted: false };
  }
  
  // Se for receita injetada, usar mapeamento
  if (isInjectedRecipe(recipeId)) {
    const mapped = mapInjectedRecipe(recipeId);
    if (mapped) {
      return { 
        cost: mapped.cost, 
        wasAdjusted: true, 
        reason: 'Usado mapeamento de receita base' 
      };
    }
  }
  
  // Usar fallback por categoria
  const fallbackCost = validation.suggestion || getFallbackCostByCategory(category, recipeName);
  
  return {
    cost: fallbackCost,
    wasAdjusted: true,
    reason: validation.reason || 'Custo ajustado para valor realista'
  };
}