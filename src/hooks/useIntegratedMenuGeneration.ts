import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useSimplifiedMenuGeneration, GeneratedMenu } from './useSimplifiedMenuGeneration';
import { useMenuBusinessRules } from './useMenuBusinessRules';
import { useSelectedClient } from '../contexts/SelectedClientContext';
import { useShoppingList } from './useShoppingList';

// Re-export type for consumers
export type { GeneratedMenu } from './useSimplifiedMenuGeneration';

export interface SimpleMenuFormData {
  clientId: string;
  period: {
    type: string;
    label: string;
    days: number;
    includeWeekends: boolean;
  };
  mealsPerDay: number;
  estimatedMeals?: number;
  budgetPerMeal?: number;
  preferences?: string[];
  juiceConfig?: any;
  proteinGrams?: string;
  diasUteis: boolean;
}

interface UseIntegratedMenuGenerationReturn {
  isGenerating: boolean;
  generatedMenu: GeneratedMenu | null;
  error: string | null;
  // generation
  generateMenuWithFormData: (formData: SimpleMenuFormData) => Promise<GeneratedMenu | null>;
  clearGeneratedMenu: () => void;
  // approvals
  approveMenu: (menuId: string, approverName: string) => Promise<boolean>;
  rejectMenu: (menuId: string, reason: string) => Promise<boolean>;
  deleteGeneratedMenu: (menuId: string) => Promise<boolean>;
  updateGeneratedMenu: (menuId: string, updates: Partial<GeneratedMenu>) => Promise<boolean>;
  // shopping list
  generateShoppingListFromMenu: (menu: GeneratedMenu) => Promise<void>;
  // validation
  violations: any[];
  validateMenu: (recipes: any[]) => any;
  validateMenuAndSetViolations: (recipes: any[]) => any;
  // saved menus
  savedMenus: GeneratedMenu[];
  loadSavedMenus: () => Promise<void>;
}

export function useIntegratedMenuGeneration(): UseIntegratedMenuGenerationReturn {
  const { isGenerating, generatedMenu, error, generateMenu, clearGeneratedMenu } = useSimplifiedMenuGeneration();
  const { violations, validateMenu, validateMenuAndSetViolations } = useMenuBusinessRules();
  const { selectedClient } = useSelectedClient();
  const { generateShoppingList } = useShoppingList();

  const [savedMenus, setSavedMenus] = useState<GeneratedMenu[]>([]);

  const mapRowToMenu = (row: any): GeneratedMenu => {
    // If recipes is empty but we have receitas_adaptadas, convert them
    let recipes = row.recipes || [];
    if ((!recipes || recipes.length === 0) && row.receitas_adaptadas) {
      recipes = Array.isArray(row.receitas_adaptadas) ? row.receitas_adaptadas.map((r: any, idx: number) => ({
        id: r.receita_id || idx,
        name: r.nome || r.name || 'Item',
        category: r.categoria || r.category || 'Outros',
        day: r.day || 'Segunda-feira',
        cost: Number(r.custo_por_porcao || r.cost || 0),
        servings: Number(r.porcoes_calculadas || r.servings || 1)
      })) : [];
    }

    // Calculate costs from recipes or cardapio if total_cost is 0 or missing
    let totalCost = Number(row.total_cost || 0);
    let costPerMeal = Number(row.cost_per_meal || 0);
    
    if (totalCost === 0) {
      // First try from recipes
      if (recipes && recipes.length > 0) {
        totalCost = recipes.reduce((sum: number, recipe: any) => {
          return sum + (Number(recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0));
        }, 0);
        costPerMeal = totalCost / (Number(row.meals_per_day || 1));
      }
      // Fallback to cardapio calculation
      else if (row.menu_data?.cardapio && Array.isArray(row.menu_data.cardapio)) {
        const dayTotals = row.menu_data.cardapio.map((day: any) => {
          if (day.receitas && Array.isArray(day.receitas)) {
            return day.receitas.reduce((daySum: number, receita: any) => {
              const cost = Number(receita.cost || receita.custo || receita.custo_por_refeicao || 0);
              return daySum + cost;
            }, 0);
          }
          return 0;
        });
        
        costPerMeal = dayTotals.length > 0 ? dayTotals.reduce((sum: number, day: number) => sum + day, 0) / dayTotals.length : 0;
        totalCost = costPerMeal * (Number(row.meals_per_day || 50));
        
        console.log('💰 Cost calculated from cardapio for menu:', row.id, {
          dayTotals,
          costPerMeal: costPerMeal.toFixed(2),
          totalCost: totalCost.toFixed(2)
        });
      }
    }

    return {
      id: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      weekPeriod: row.week_period,
      status: row.status,
      totalCost,
      costPerMeal,
      totalRecipes: Number(row.total_recipes || 0),
      mealsPerDay: Number(row.meals_per_day || 50),
      recipes,
      createdAt: row.created_at,
      menu: row.menu_data || null,
      warnings: row.warnings || []
    };
  };

  const loadSavedMenus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('generated_menus')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading saved menus:', error);
        setSavedMenus([]);
        return;
      }

      const mappedMenus = data?.map(mapRowToMenu) || [];
      setSavedMenus(mappedMenus);
      console.log('📋 Loaded saved menus:', mappedMenus.length);
    } catch (error) {
      console.error('❌ Error loading saved menus:', error);
      setSavedMenus([]);
    }
  }, []);

  useEffect(() => {
    loadSavedMenus();
  }, [loadSavedMenus]);

  const generateMenuWithFormData = useCallback(async (formData: SimpleMenuFormData) => {
    const periodLabel = formData.period.label;
    const periodDays = formData.period.days;
    const menu = await generateMenu(
      selectedClient,
      periodLabel,
      formData.mealsPerDay,
      [],
      formData.preferences || [],
      formData.juiceConfig,
      formData.proteinGrams,
      periodDays,
      formData.budgetPerMeal
    );
    if (menu) {
      await loadSavedMenus();
    }
    return menu;
  }, [generateMenu, selectedClient, loadSavedMenus]);

  const approveMenu = useCallback(async (menuId: string, approverName: string) => {
    const { error } = await supabase
      .from('generated_menus')
      .update({ status: 'approved', approved_by: approverName })
      .eq('id', menuId);
    return !error;
  }, []);

  const rejectMenu = useCallback(async (menuId: string, reason: string) => {
    const { error } = await supabase
      .from('generated_menus')
      .update({ status: 'rejected', rejected_reason: reason })
      .eq('id', menuId);
    return !error;
  }, []);

  const deleteGeneratedMenu = useCallback(async (menuId: string) => {
    const { error } = await supabase
      .from('generated_menus')
      .delete()
      .eq('id', menuId);
    if (!error) await loadSavedMenus();
    return !error;
  }, [loadSavedMenus]);

  const updateGeneratedMenu = useCallback(async (menuId: string, updates: Partial<GeneratedMenu>) => {
    try {
      const { error } = await supabase
        .from('generated_menus')
        .update(updates)
        .eq('id', menuId);
      
      if (!error) {
        await loadSavedMenus();
        // Update current generated menu if it's the same one being edited
        if (generatedMenu?.id === menuId) {
          const updatedMenu = { ...generatedMenu, ...updates };
          // This would need to be implemented in useSimplifiedMenuGeneration
          console.log('Menu updated:', updatedMenu);
        }
      }
      return !error;
    } catch (error) {
      console.error('Error updating menu:', error);
      return false;
    }
  }, [loadSavedMenus, generatedMenu]);

  const generateShoppingListFromMenu = useCallback(async (menu: GeneratedMenu) => {
    // Calculate budget fallback from recipes or cardapio if totalCost is 0
    let budgetPredicted = menu.totalCost || 0;
    
    if (budgetPredicted === 0) {
      // Try from recipes first
      if (menu.recipes && menu.recipes.length > 0) {
        budgetPredicted = menu.recipes.reduce((sum: number, recipe: any) => {
          return sum + (Number(recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0));
        }, 0);
      }
      // Fallback to cardapio calculation
      else if (menu.menu?.cardapio && Array.isArray(menu.menu.cardapio)) {
        const dayTotals = menu.menu.cardapio.map((day: any) => {
          if (day.receitas && Array.isArray(day.receitas)) {
            return day.receitas.reduce((daySum: number, receita: any) => {
              const cost = Number(receita.cost || receita.custo || receita.custo_por_refeicao || 0);
              return daySum + cost;
            }, 0);
          }
          return 0;
        });
        
        const costPerMeal = dayTotals.length > 0 ? dayTotals.reduce((sum: number, day: number) => sum + day, 0) / dayTotals.length : 0;
        budgetPredicted = costPerMeal * (menu.mealsPerDay || 50);
        
        console.log('💰 Shopping list budget calculated from cardapio:', {
          dayTotals,
          costPerMeal: costPerMeal.toFixed(2),
          budgetPredicted: budgetPredicted.toFixed(2)
        });
      }
    }
    
    console.log('🛒 Generating shopping list with budget:', budgetPredicted.toFixed(2));
    await generateShoppingList(menu.id, menu.clientName, budgetPredicted, menu.mealsPerDay || 50);
  }, [generateShoppingList]);

  return {
    isGenerating,
    generatedMenu,
    error,
    generateMenuWithFormData,
    clearGeneratedMenu,
    approveMenu,
    rejectMenu,
    deleteGeneratedMenu,
    updateGeneratedMenu,
    generateShoppingListFromMenu,
    violations,
    validateMenu,
    validateMenuAndSetViolations,
    savedMenus,
    loadSavedMenus
  };
}