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
    const { data, error } = await supabase.functions.invoke('gpt-assistant', {
      body: {
        action: 'generate_recipes_only',
        client_data: clientData,
        meal_quantity: mealQuantity,
        simple_mode: true
      }
    });

    if (error) throw error;
    return data?.recipes || [];
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
          recipes: menu.recipes,
          menu_data: menu.menu,
          warnings: menu.warnings
        })
        .select('id')
        .single();

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
    juiceConfig?: any
  ): Promise<GeneratedMenu | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const clientToUse = clientData || selectedClient;
      if (!clientToUse) {
        throw new Error('Nenhum cliente selecionado');
      }

      const weekPeriod = period || `${format(new Date(), 'dd/MM/yyyy')} - ${format(addDays(new Date(), 6), 'dd/MM/yyyy')}`;

      // Step 1: Generate simple recipes with AI
      const recipes = await generateSimpleRecipes({
        id: clientToUse.id || clientToUse.cliente_id_legado,
        nome: clientToUse.nome_fantasia || clientToUse.nome_empresa,
        custo_maximo_refeicao: clientToUse.custo_maximo_refeicao || 15,
        restricoes_alimentares: restrictions,
        preferencias_alimentares: preferences
      }, mealQuantity);

      if (!recipes || !recipes.length) {
        throw new Error('IA não conseguiu gerar receitas');
      }

      // Step 2: Calculate costs using Edge Function with juice config
      const { data: costData, error: costError } = await supabase.functions.invoke('gpt-assistant', {
        body: {
          action: 'calculate_recipes_cost',
          recipes: recipes,
          mealQuantity: mealQuantity,
          juice_config: juiceConfig
        }
      });

      if (costError) throw costError;
      
      const calculatedMenu = {
        recipes: recipes,
        totalCost: costData?.total_cost || 0,
        costPerMeal: costData?.cost_per_meal || 0,
        violatedIngredients: costData?.violated_ingredients || []
      };

      // Step 3: Validate business rules
      const businessRules = validateMenu(calculatedMenu.recipes);
      console.log('Business rules validation:', businessRules);

      // Step 4: Check budget
      const budgetLimit = clientToUse.custo_maximo_refeicao || 15;
      if (calculatedMenu.costPerMeal > budgetLimit) {
        toast({
          title: "Atenção: Orçamento Excedido",
          description: `Custo: R$ ${calculatedMenu.costPerMeal.toFixed(2)} | Limite: R$ ${budgetLimit.toFixed(2)}`,
          variant: "destructive"
        });
      }

      // Step 5: Create menu object
      const menu: GeneratedMenu = {
        id: crypto.randomUUID(),
        clientId: clientToUse.id || clientToUse.cliente_id_legado,
        clientName: clientToUse.nome_fantasia || clientToUse.nome_empresa,
        weekPeriod,
        status: 'pending_approval',
        totalCost: calculatedMenu.totalCost,
        costPerMeal: calculatedMenu.costPerMeal,
        totalRecipes: calculatedMenu.recipes.length,
        recipes: calculatedMenu.recipes,
        createdAt: new Date().toISOString(),
        menu: { 
          calculated_locally: true,
          business_rules: businessRules,
          violations: calculatedMenu.violatedIngredients
        },
        warnings: calculatedMenu.violatedIngredients.map(ing => 
          `Ingrediente não encontrado: ${ing.nome}`),
        juiceMenu: costData?.juice_menu || null
      };

      // Step 6: Save to database
      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        menu.id = savedId;
        setGeneratedMenu(menu);

        toast({
          title: "Cardápio Gerado!",
          description: `${calculatedMenu.recipes.length} receitas. Custo: R$ ${calculatedMenu.costPerMeal.toFixed(2)}/refeição`,
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