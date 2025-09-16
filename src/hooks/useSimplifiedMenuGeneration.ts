/**
 * Simplified hook for menu generation with local calculations
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
// Removed useMenuCalculation - using optimized Edge Function instead
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useMenuBusinessRules } from './useMenuBusinessRules';
import { format, addDays } from 'date-fns';

export interface GeneratedMenu {
  id: string;
  clientId: string;
  clientName: string;
  weekPeriod: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  totalCost: number;
  costPerMeal: number;
  totalRecipes: number;
  mealsPerDay?: number;
  recipes: any[];
  createdAt: string;
  menu?: any;
  warnings?: string[];
  juiceMenu?: any;
}

export function useSimplifiedMenuGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState<GeneratedMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selectedClient } = useSelectedClient();
  // Using optimized Edge Function instead of local calculations
  const { validateMenu, violations } = useMenuBusinessRules();
  const { toast } = useToast();

  const generateSimpleRecipes = async (clientData: any, mealQuantity: number) => {
    console.log('🔍 Frontend DEBUG - Client data:', {
      selectedClient,
      clientData,
      clientId: clientData?.id || clientData?.cliente_id_legado,
      filialId: clientData?.filial_id
    });

    // Validate client data before sending
    if (!clientData?.id && !clientData?.cliente_id_legado) {
      throw new Error('Cliente inválido: ID não encontrado');
    }

    const payload = {
      action: 'generate_recipes_only',
      client_id: clientData.id || null,
      clientId: clientData.cliente_id_legado || null,
      filial_id: clientData.filial_id || null,
      filialIdLegado: clientData.filial_id || null,
      client_data: clientData,
      meal_quantity: mealQuantity,
      simple_mode: true
    };

    console.log('📤 Payload being sent:', payload);

    const { data, error } = await supabase.functions.invoke('gpt-assistant', {
      body: payload
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw new Error(`Erro na geração: ${error.message || 'Falha na comunicação com o servidor'}`);
    }

    if (!data?.recipes || data.recipes.length === 0) {
      console.error('No recipes returned from Edge Function:', data);
      throw new Error('IA não conseguiu gerar receitas para este cliente');
    }

    return data.recipes;
  };

  const saveMenuToDatabase = async (menu: GeneratedMenu): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('generated_menus')
        .insert({
          client_id: menu.clientId,
          client_name: menu.clientName,
          week_period: menu.weekPeriod,
          status: menu.status,
          total_cost: menu.totalCost,
          cost_per_meal: menu.costPerMeal,
          total_recipes: menu.totalRecipes,
          meals_per_day: menu.mealsPerDay || 50,
          recipes: menu.recipes,
          menu_data: menu.menu,
          warnings: menu.warnings
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Error saving menu:', error);
      return null;
    }
  };

  const generateMenu = async (
    clientData: any,
    period: string,
    mealQuantity: number,
    restrictions: string[],
    preferences: string[],
    juiceConfig?: any,
    proteinGrams?: string,
    periodDays: number = 5,
    budgetPerMeal?: number,
    selectedRecipes?: number[]
  ): Promise<GeneratedMenu | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const clientToUse = clientData || selectedClient;
      if (!clientToUse) {
        throw new Error('Nenhum cliente selecionado');
      }

      console.log('🎯 Iniciando geração com CostCalculator...', {
        selectedClient: clientToUse?.id,
        mealQuantity,
        periodDays,
        budgetPerMeal
      });

      const weekPeriod = period || `${format(new Date(), 'dd/MM/yyyy')} - ${format(addDays(new Date(), periodDays - 1), 'dd/MM/yyyy')}`;

      // Use CostCalculator for complete menu generation
      const { data: response, error: menuError } = await supabase.functions.invoke('gpt-assistant', {
        body: {
          action: 'generate_menu_with_costs',
          client_id: clientToUse.id,
          clientId: clientToUse.cliente_id_legado,
          filial_id: clientToUse.filial_id,
          filialIdLegado: clientToUse.filial_id,
          mealQuantity: mealQuantity,
          periodDays: periodDays,
          budgetPerMeal: budgetPerMeal || clientToUse.custo_maximo_refeicao,
          selectedRecipes: selectedRecipes,
          client_data: clientToUse
        }
      });

      if (menuError) {
        throw new Error(`Erro na geração: ${menuError.message}`);
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Falha na geração do cardápio');
      }

      const menuResult = response.menuResult;
      console.log('✅ MenuResult recebido:', menuResult);
      console.log('🔍 Estrutura de receitas:', menuResult.receitas);

      // Extract and flatten recipes from MenuResult (fixas + principais + acompanhamentos)
      const allRecipes = [
        ...(menuResult?.receitas?.fixas || []),
        ...(menuResult?.receitas?.principais || []),
        ...(menuResult?.receitas?.acompanhamentos || []),
      ];

      console.log('📊 Receitas encontradas:', {
        fixas: menuResult?.receitas?.fixas?.length || 0,
        principais: menuResult?.receitas?.principais?.length || 0,
        acompanhamentos: menuResult?.receitas?.acompanhamentos?.length || 0,
        total: allRecipes.length
      });
      
      if (!allRecipes.length) {
        throw new Error("Nenhuma receita foi incluída no cardápio");
      }

      // Validate recipes against business rules
      const businessRules = validateMenu(allRecipes);
      console.log('Business rules validation:', businessRules);

      // Build the GeneratedMenu object from MenuResult
      const menu: GeneratedMenu = {
        id: crypto.randomUUID(),
        clientId: clientToUse.id || clientToUse.cliente_id_legado,
        clientName: clientToUse.nome_fantasia || clientToUse.nome_empresa,
        weekPeriod,
        status: 'pending_approval',
        totalCost: menuResult.resumo_custos?.custo_total_calculado || 0,
        costPerMeal: menuResult.resumo_custos?.custo_por_refeicao || 0,
        totalRecipes: allRecipes.length,
        mealsPerDay: mealQuantity,
        recipes: allRecipes,
        createdAt: new Date().toISOString(),
        menu: {
          calculated_with_cost_calculator: true,
          business_rules: businessRules,
          shopping_list: menuResult.lista_compras?.itens || [],
          budget_adherence: menuResult.resumo_custos?.dentro_orcamento,
          calculation_precision: menuResult.metadata?.precision_percentage,
          savings_summary: {
            economia_total: menuResult.resumo_custos?.economia_total,
            economia_percentual: menuResult.resumo_custos?.economia_percentual,
          }
        },
        warnings: menuResult.avisos || [],
        juiceMenu: menuResult.cardapio_sucos || null
      };

      // Save to database
      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        menu.id = savedId;
        setGeneratedMenu(menu);

        toast({
          title: "Cardápio Gerado com CostCalculator!",
          description: `${allRecipes.length} receitas. Custo: R$ ${(menuResult.resumo_custos?.custo_total_calculado || 0).toFixed(2)} total`,
        });

        return menu;
      } else {
        throw new Error('Erro ao salvar cardápio');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      
      toast({
        title: "Erro ao gerar cardápio",
        description: errorMessage,
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    generatedMenu,
    error,
    progress: null, // Edge Function handles progress internally
    generateMenu,
    clearGeneratedMenu: () => setGeneratedMenu(null),
    clearError: () => setError(null)
  };
}