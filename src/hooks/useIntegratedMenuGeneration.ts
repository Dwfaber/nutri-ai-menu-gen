import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSimplifiedMenuGeneration, GeneratedMenu } from './useSimplifiedMenuGeneration';
import { useMenuBusinessRules } from './useMenuBusinessRules';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useShoppingList } from './useShoppingList';

// Re-export type for consumers
export type { GeneratedMenu } from './useSimplifiedMenuGeneration';

export interface SimpleMenuFormData {
  clientId: string;
  period: { start: string; end: string };
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

    // Calculate costs from recipes if total_cost is 0 or missing
    let totalCost = Number(row.total_cost || 0);
    let costPerMeal = Number(row.cost_per_meal || 0);
    
    if (totalCost === 0 && recipes && recipes.length > 0) {
      totalCost = recipes.reduce((sum: number, recipe: any) => {
        return sum + (Number(recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0));
      }, 0);
      costPerMeal = totalCost / (Number(row.meals_per_day || 1));
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
    const periodLabel = `${formData.period.start} - ${formData.period.end}`;
    // Determine number of days requested. If start === end, it's a single-day request.
    const sameDay = formData?.period?.start && formData?.period?.end && (formData.period.start === formData.period.end);
    const periodDays = sameDay ? 1 : (formData.diasUteis ? 5 : 7);
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
    await generateShoppingList(menu.id, menu.clientName, menu.totalCost, menu.mealsPerDay || 50);
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