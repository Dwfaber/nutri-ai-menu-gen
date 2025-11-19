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

// Helper function to convert checkbox juice config to API format
function mapJuiceConfigToTypes(juiceConfig: any): { 
  tipo_primario: string; 
  tipo_secundario: string | null 
} {
  // Priority: PRO_MIX > VITA_SUCO > DIET > NATURAL
  const prioridade = [
    { key: 'use_pro_mix', value: 'PRO_MIX' },
    { key: 'use_pro_vita', value: 'VITA_SUCO' },
    { key: 'use_suco_diet', value: 'DIET' },
    { key: 'use_suco_natural', value: 'NATURAL' }
  ];
  
  const tiposSelecionados = prioridade
    .filter(p => juiceConfig?.[p.key] === true)
    .map(p => p.value);
  
  // If none selected, use NATURAL as default
  if (tiposSelecionados.length === 0) {
    return { tipo_primario: 'NATURAL', tipo_secundario: null };
  }
  
  // If only one selected, use the same for both
  if (tiposSelecionados.length === 1) {
    return { 
      tipo_primario: tiposSelecionados[0], 
      tipo_secundario: tiposSelecionados[0] 
    };
  }
  
  // If two or more, use the first two
  return { 
    tipo_primario: tiposSelecionados[0], 
    tipo_secundario: tiposSelecionados[1] 
  };
}

export function useIntegratedMenuGeneration(): UseIntegratedMenuGenerationReturn {
  const { isGenerating, generatedMenu, error, generateMenu, clearGeneratedMenu } = useSimplifiedMenuGeneration();
  const { violations, validateMenu, validateMenuAndSetViolations } = useMenuBusinessRules();
  const { selectedClient } = useSelectedClient();
  const { generateShoppingList, loadShoppingLists } = useShoppingList();

  const [savedMenus, setSavedMenus] = useState<GeneratedMenu[]>([]);

  const mapRowToMenu = (row: any): GeneratedMenu => {
    // If recipes is empty but we have receitas_adaptadas, convert them
    let recipes = row.recipes || [];
    if ((!recipes || recipes.length === 0) && row.receitas_adaptadas) {
      recipes = Array.isArray(row.receitas_adaptadas) ? row.receitas_adaptadas.map((r: any, idx: number) => ({
        id: r.receita_id || r.receita_id_legado || idx,
        name: r.nome || r.name || 'Item',
        category: r.categoria || r.category || r.categoria_descricao || 'Outros',
        day: r.day || r.dia || 'Segunda-feira',
        cost: Number(r.custo_por_porcao || r.custo_por_refeicao || r.cost || 0),
        servings: Number(r.porcoes_calculadas || r.servings || 1)
      })) : [];
    }

    // Try to parse from menu_data.dias if still no recipes
    if (!recipes || recipes.length === 0) {
      if (row.menu_data?.dias && Array.isArray(row.menu_data.dias)) {
        recipes = row.menu_data.dias.flatMap((dia: any, dayIdx: number) => {
          const dayName = dia.dia_semana || dia.dia || `Dia ${dayIdx + 1}`;
          return (dia.receitas || []).map((r: any, recipeIdx: number) => ({
            id: r.receita_id || `${dayIdx}-${recipeIdx}`,
            name: r.nome || r.name || 'Item',
            category: r.categoria || r.category || 'Outros',
            day: dayName,
            cost: Number(r.custo_por_refeicao || r.custo_por_porcao || r.cost || 0),
            servings: Number(r.porcoes || r.servings || row.meals_per_day || 50)
          }));
        });
      }
    }

    // Calculate costs from recipes or menu_data.dias if total_cost is 0 or missing
    let totalCost = Number(row.total_cost || 0);
    let costPerMeal = Number(row.cost_per_meal || 0);
    
    if (totalCost === 0) {
      // First try from menu_data.dias (most reliable source)
      if (row.menu_data?.dias && Array.isArray(row.menu_data.dias)) {
        const dayTotals = row.menu_data.dias.map((day: any) => {
          if (day.receitas && Array.isArray(day.receitas)) {
            return day.receitas.reduce((daySum: number, receita: any) => {
              // custo_por_refeicao JÁ É O CUSTO TOTAL DO DIA (per capita * meals_per_day)
              const cost = Number(receita.custo_por_refeicao || receita.cost || receita.custo || 0);
              return daySum + cost;
            }, 0);
          }
          return 0;
        });
        
        // Soma dos custos de todos os dias para obter o custo total da semana
        totalCost = dayTotals.length > 0 ? dayTotals.reduce((sum: number, day: number) => sum + day, 0) : 0;
        costPerMeal = totalCost / dayTotals.length;
        
        console.log('💰 Cost calculated from dias for menu:', row.id, {
          dayTotals: dayTotals.map(t => t.toFixed(2)),
          totalWeeklyCost: totalCost.toFixed(2),
          costPerMeal: costPerMeal.toFixed(2),
          totalDays: dayTotals.length
        });
      }
      // Fallback to recipes array
      else if (recipes && recipes.length > 0) {
        totalCost = recipes.reduce((sum: number, recipe: any) => {
          return sum + (Number(recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0));
        }, 0);
        costPerMeal = totalCost / (Number(row.meals_per_day || 1));
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
    
    // Convert checkbox juice config to proper API format
    const tiposSuco = mapJuiceConfigToTypes(formData.juiceConfig);
    
    console.log('🧃 Configuração de Sucos:', {
      checkbox_config: formData.juiceConfig,
      primario: tiposSuco.tipo_primario,
      secundario: tiposSuco.tipo_secundario,
      raw_checkboxes: {
        pro_mix: formData.juiceConfig?.use_pro_mix,
        pro_vita: formData.juiceConfig?.use_pro_vita,
        diet: formData.juiceConfig?.use_suco_diet,
        natural: formData.juiceConfig?.use_suco_natural
      }
    });
    
    const menu = await generateMenu(
      selectedClient,
      periodLabel,
      formData.mealsPerDay,
      [],
      formData.preferences || [],
      tiposSuco,
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
    try {
      console.log('🛒 Gerando lista de compras do menu:', menu.id);
      
      // Extrair receitas do menu (adaptar à estrutura real)
      let receitasIds: string[] = [];
      
      // Tentar estrutura nova primeiro (menu_data.cardapio)
      if (menu.menu?.cardapio && Array.isArray(menu.menu.cardapio)) {
        console.log('📋 Usando estrutura nova (menu_data.cardapio)');
        receitasIds = menu.menu.cardapio.flatMap((dia: any) => 
          (dia.receitas || []).map((r: any) => r.receita_id || r.receita_id_legado)
        ).filter(Boolean);
      } 
      // Fallback: estrutura antiga (recipes array)
      else if (menu.recipes && Array.isArray(menu.recipes)) {
        console.log('📋 Usando estrutura antiga (recipes)');
        receitasIds = menu.recipes.map((r: any) => r.receita_id_legado || r.id).filter(Boolean);
      }
      
      if (receitasIds.length === 0) {
        throw new Error('Nenhuma receita encontrada no cardápio para gerar lista de compras');
      }
      
      console.log('📋 Receitas para lista:', receitasIds.length, 'receitas');
      
      // Calculate budget from menu data
      let budgetPredicted = menu.totalCost || 0;
      
      if (budgetPredicted === 0 && menu.menu?.cardapio && Array.isArray(menu.menu.cardapio)) {
        budgetPredicted = menu.menu.cardapio.reduce((total: number, day: any) => {
          if (day.receitas && Array.isArray(day.receitas)) {
            const dayCost = day.receitas.reduce((daySum: number, receita: any) => {
              return daySum + Number(receita.custo_por_refeicao || receita.cost || receita.custo || 0);
            }, 0);
            return total + dayCost * (menu.mealsPerDay || 50);
          }
          return total;
        }, 0);
      }
      
      await generateShoppingList(menu.id, menu.clientName, budgetPredicted, menu.mealsPerDay || 50);
      await loadShoppingLists();
    } catch (error) {
      console.error('❌ Erro ao gerar lista:', error);
    }
  }, [generateShoppingList, loadShoppingLists]);

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