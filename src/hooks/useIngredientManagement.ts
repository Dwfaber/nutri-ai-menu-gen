import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MenuViolation } from './useMenuBusinessRules';

export interface SpecialIngredient {
  id: number;
  name: string;
  type: 'zero_cost' | 'substitution';
  substituteName?: string;
  substituteId?: number;
}

export interface RecipeValidation {
  recipeId: string;
  recipeName: string;
  classification: '100_valid' | 'almost_valid' | 'invalid';
  missingIngredients: number;
  totalIngredients: number;
  cost: number;
  violations: MenuViolation[];
}

export const useIngredientManagement = () => {
  const [violations, setViolations] = useState<MenuViolation[]>([]);

  // Lista de ingredientes especiais
  const specialIngredients: SpecialIngredient[] = [
    // Custo zero
    { id: 17, name: 'ÁGUA', type: 'zero_cost' },
    { id: 999, name: 'SAL', type: 'zero_cost' },
    { id: 998, name: 'TEMPERO BÁSICO', type: 'zero_cost' },
    
    // Substituições automáticas
    { id: 71, name: 'CALDO DE CARNE', type: 'substitution', substituteName: 'TEMPERO PRONTO', substituteId: 500 },
    { id: 72, name: 'CALDO DE GALINHA', type: 'substitution', substituteName: 'TEMPERO GALINHA', substituteId: 501 },
    { id: 191, name: 'LEITE EM PÓ SEM AÇÚCAR', type: 'substitution', substituteName: 'LEITE EM PÓ', substituteId: 502 }
  ];

  // Buscar substituição por similaridade
  const findIngredientSubstitute = async (ingredientName: string, marketIngredients: any[]): Promise<any | null> => {
    const name = ingredientName.toLowerCase();
    
    // Primeiro: busca exata por palavras-chave
    const exactMatches = marketIngredients.filter(ing => {
      const marketName = ing.descricao.toLowerCase();
      return name.includes(marketName.split(' ')[0]) || marketName.includes(name.split(' ')[0]);
    });
    
    if (exactMatches.length > 0) {
      return exactMatches[0]; // Retorna o primeiro match
    }
    
    // Segundo: busca por categoria similar
    const categoryMatches = marketIngredients.filter(ing => {
      const category = ing.categoria_descricao?.toLowerCase() || '';
      if (name.includes('carne')) return category.includes('carne') || category.includes('proteína');
      if (name.includes('verdura')) return category.includes('verdura') || category.includes('vegetal');
      if (name.includes('tempero')) return category.includes('tempero') || category.includes('condimento');
      return false;
    });
    
    return categoryMatches.length > 0 ? categoryMatches[0] : null;
  };

  // Calcular custo com sistema de substituições
  const calculateIngredientCost = async (
    ingredient: any,
    marketIngredients: any[],
    quantity: number
  ): Promise<{ cost: number; violation?: MenuViolation }> => {
    const ingredientId = ingredient.produto_base_id;
    const ingredientName = ingredient.produto_base_descricao || ingredient.nome;
    
    // Verificar se é ingrediente especial
    const special = specialIngredients.find(s => s.id === ingredientId);
    
    if (special) {
      if (special.type === 'zero_cost') {
        return {
          cost: 0,
          violation: {
            type: 'ingredient_zero_cost',
            message: `Ingrediente ${ingredientName} tem custo zero (água, sal, tempero básico)`,
            ingredientId,
            ingredientName,
            cost: 0
          }
        };
      }
      
      if (special.type === 'substitution' && special.substituteName) {
        // Buscar substituto no mercado
        const substitute = marketIngredients.find(ing => 
          ing.descricao.toLowerCase().includes(special.substituteName!.toLowerCase())
        );
        
        if (substitute) {
          const cost = (quantity / (substitute.produto_base_quantidade_embalagem || 1)) * substitute.preco;
          return {
            cost,
            violation: {
              type: 'ingredient_substituted',
              message: `${ingredientName} substituído por ${substitute.descricao}`,
              ingredientId,
              ingredientName,
              substituteName: substitute.descricao,
              cost
            }
          };
        }
      }
    }
    
    // Buscar ingrediente no mercado
    const marketIngredient = marketIngredients.find(ing => ing.produto_base_id === ingredientId);
    
    if (marketIngredient && marketIngredient.preco > 0) {
      const cost = (quantity / (marketIngredient.produto_base_quantidade_embalagem || 1)) * marketIngredient.preco;
      return { cost };
    }
    
    // Buscar substituição por similaridade
    const substitute = await findIngredientSubstitute(ingredientName, marketIngredients);
    
    if (substitute) {
      const cost = (quantity / (substitute.produto_base_quantidade_embalagem || 1)) * substitute.preco;
      return {
        cost,
        violation: {
          type: 'ingredient_substituted',
          message: `${ingredientName} não encontrado, usando ${substitute.descricao}`,
          ingredientId,
          ingredientName,
          substituteName: substitute.descricao,
          cost
        }
      };
    }
    
    // Se não encontrou nada, registra custo zero e violação
    return {
      cost: 0,
      violation: {
        type: 'ingredient_missing',
        message: `Ingrediente ${ingredientName} não encontrado no mercado - custo zerado`,
        ingredientId,
        ingredientName,
        cost: 0
      }
    };
  };

  // Classificar receitas por validação
  const classifyRecipes = async (recipes: any[], marketIngredients: any[]): Promise<RecipeValidation[]> => {
    const classifications: RecipeValidation[] = [];
    
    for (const recipe of recipes) {
      const { data: ingredients } = await supabase
        .from('receita_ingredientes')
        .select('produto_base_id, nome, produto_base_descricao, quantidade, unidade')
        .eq('receita_id_legado', String(recipe.receita_id_legado));
      
      if (!ingredients || ingredients.length === 0) {
        classifications.push({
          recipeId: String(recipe.receita_id_legado),
          recipeName: recipe.nome_receita,
          classification: 'invalid',
          missingIngredients: 0,
          totalIngredients: 0,
          cost: 0,
          violations: []
        });
        continue;
      }
      
      let totalCost = 0;
      const recipeViolations: MenuViolation[] = [];
      let problematicIngredients = 0;
      
      for (const ingredient of ingredients) {
        const result = await calculateIngredientCost(
          ingredient,
          marketIngredients,
          parseFloat(String(ingredient.quantidade)) || 0
        );
        
        totalCost += result.cost;
        
        if (result.violation) {
          recipeViolations.push(result.violation);
          if (result.violation.type === 'ingredient_missing') {
            problematicIngredients++;
          }
        }
      }
      
      let classification: '100_valid' | 'almost_valid' | 'invalid';
      if (problematicIngredients === 0) {
        classification = '100_valid';
      } else if (problematicIngredients <= 2) {
        classification = 'almost_valid';
      } else {
        classification = 'invalid';
      }
      
      classifications.push({
        recipeId: String(recipe.receita_id_legado),
        recipeName: recipe.nome_receita,
        classification,
        missingIngredients: problematicIngredients,
        totalIngredients: ingredients.length,
        cost: totalCost,
        violations: recipeViolations
      });
    }
    
    return classifications;
  };

  // Filtrar receitas válidas para uso
  const getValidRecipes = (classifications: RecipeValidation[]): RecipeValidation[] => {
    // Priorizar receitas 100% válidas
    const fullValid = classifications.filter(r => r.classification === '100_valid');
    
    // Se não há receitas 100% válidas suficientes, incluir "quase válidas"
    if (fullValid.length < 10) {
      const almostValid = classifications.filter(r => r.classification === 'almost_valid');
      return [...fullValid, ...almostValid];
    }
    
    return fullValid;
  };

  return {
    violations,
    setViolations,
    specialIngredients,
    findIngredientSubstitute,
    calculateIngredientCost,
    classifyRecipes,
    getValidRecipes
  };
};