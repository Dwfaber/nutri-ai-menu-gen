import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useClientContractsContext } from '@/contexts/ClientContractsContext';
import { MarketProduct } from './useMarketProducts';
import { getDayOfWeekCost } from '@/types/clientCosts';

export interface MenuGenerationRequest {
  clientId: string;
  clientName: string;
  weekPeriod: string;
  maxCostPerMeal: number;
  totalEmployees: number;
  mealsPerMonth: number;
  dietaryRestrictions: string[];
  preferences?: string[];
  marketProducts: MarketProduct[];
}

export interface GeneratedMenu {
  id: string;
  clientId: string;
  clientName: string;
  weekPeriod: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  totalCost: number;
  estimatedCostPerMeal: number;
  recipes: MenuRecipe[];
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
}

export interface MenuRecipe {
  id: string;
  name: string;
  day: string;
  mealType: 'lunch' | 'dinner' | 'snack';
  ingredients: MenuIngredient[];
  servings: number;
  costPerServing: number;
  totalCost: number;
  nutritionalInfo?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface MenuIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  productId?: number;
  isPromotional?: boolean;
}

export const useIntegratedMenuGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState<GeneratedMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { selectedClient } = useSelectedClient();
  const { getClientWithCosts } = useClientContractsContext();

  const generateMenu = async (
    weekPeriod: string,
    preferences?: string[]
  ): Promise<GeneratedMenu | null> => {
    if (!selectedClient) {
      toast({
        title: "Cliente não selecionado",
        description: "Selecione um cliente antes de gerar o cardápio",
        variant: "destructive"
      });
      return null;
    }

    try {
      setIsGenerating(true);
      setError(null);

      // Fetch market products to use in generation
      const { data: marketProducts, error: marketError } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('*')
        .eq('em_promocao_sim_nao', false); // Get all available products

      if (marketError) {
        throw new Error(`Erro ao buscar produtos do mercado: ${marketError.message}`);
      }

      // Get client costs and cost details
      const clientWithCosts = getClientWithCosts(selectedClient.id);
      
      // Enhance cost information with daily breakdown
      let enhancedCostData = null;
      if (clientWithCosts) {
        enhancedCostData = {
          daily_costs: clientWithCosts.dailyCosts,
          validation_rules: clientWithCosts.validationRules,
          cost_details: clientWithCosts.costDetails,
          total_branches: clientWithCosts.totalBranches
        };
      }

      // Prepare generation request
      const generationRequest: MenuGenerationRequest = {
        clientId: selectedClient.id,
        clientName: selectedClient.nome_fantasia,
        weekPeriod,
        maxCostPerMeal: selectedClient.custo_medio_diario,
        totalEmployees: 50, // Default value - should be collected from form
        mealsPerMonth: 100, // Default value - should be calculated
        dietaryRestrictions: [], // Should be collected from form
        preferences: preferences || [],
        marketProducts: marketProducts || []
      };

      console.log('Generating menu with request:', generationRequest);

      // Call GPT Assistant for menu generation
      const { data: gptResponse, error: gptError } = await supabase.functions.invoke('gpt-assistant', {
        body: {
          action: 'generate_menu',
          client_data: {
            id: selectedClient.id,
            name: selectedClient.nome_fantasia,
            max_cost_per_meal: selectedClient.custo_medio_diario,
            total_employees: 50, // Default value
            meals_per_month: 100, // Default value
            dietary_restrictions: [], // Default value
            preferences: preferences || []
          },
          week_period: weekPeriod,
          market_products: (marketProducts || []).slice(0, 100), // Limit for API
          enhanced_cost_data: enhancedCostData
        }
      });

      if (gptError) {
        throw new Error(`Erro na geração do cardápio: ${gptError.message}`);
      }

      if (!gptResponse?.success) {
        throw new Error(gptResponse?.error || 'Erro desconhecido na geração do cardápio');
      }

      const menu: GeneratedMenu = {
        id: `menu_${Date.now()}`,
        clientId: selectedClient.id,
        clientName: selectedClient.nome_fantasia,
        weekPeriod,
        status: 'pending_approval',
        totalCost: gptResponse.menu?.total_cost || 0,
        estimatedCostPerMeal: gptResponse.menu?.cost_per_meal || 0,
        recipes: gptResponse.menu?.recipes || [],
        createdAt: new Date().toISOString()
      };

      setGeneratedMenu(menu);

      toast({
        title: "Cardápio Gerado com Sucesso",
        description: `Cardápio para ${selectedClient.nome_fantasia} criado e aguarda aprovação`,
        variant: "default"
      });

      return menu;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar cardápio';
      setError(errorMessage);
      toast({
        title: "Erro na Geração do Cardápio",
        description: errorMessage,
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const approveMenu = async (menuId: string, approvedBy: string): Promise<boolean> => {
    try {
      if (generatedMenu && generatedMenu.id === menuId) {
        const updatedMenu = {
          ...generatedMenu,
          status: 'approved' as const,
          approvedAt: new Date().toISOString(),
          approvedBy
        };
        setGeneratedMenu(updatedMenu);

        toast({
          title: "Cardápio Aprovado",
          description: "O cardápio foi aprovado e pode ser usado para gerar lista de compras",
          variant: "default"
        });

        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao aprovar cardápio:', err);
      return false;
    }
  };

  const rejectMenu = async (menuId: string, reason: string): Promise<boolean> => {
    try {
      if (generatedMenu && generatedMenu.id === menuId) {
        const updatedMenu = {
          ...generatedMenu,
          status: 'rejected' as const,
          notes: reason
        };
        setGeneratedMenu(updatedMenu);

        toast({
          title: "Cardápio Rejeitado",
          description: "O cardápio foi rejeitado. Você pode gerar um novo.",
          variant: "default"
        });

        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao rejeitar cardápio:', err);
      return false;
    }
  };

  const generateShoppingListFromMenu = async (menu: GeneratedMenu): Promise<boolean> => {
    if (!selectedClient) return false;

    try {
      setIsGenerating(true);

      // Call shopping list generation
      const { data: shoppingResponse, error: shoppingError } = await supabase.functions.invoke('generate-shopping-list', {
        body: {
          client_id: selectedClient.id,
          client_name: selectedClient.nome_fantasia,
          menu_id: menu.id,
          recipes: menu.recipes,
          budget_predicted: menu.totalCost,
          optimization_settings: {
            prioritize_promotions: true,
            max_surplus_percentage: 10,
            prefer_whole_numbers: true,
            max_package_types: 3,
            use_purchase_price: false
          }
        }
      });

      if (shoppingError) {
        throw new Error(`Erro ao gerar lista de compras: ${shoppingError.message}`);
      }

      toast({
        title: "Lista de Compras Gerada",
        description: "Lista de compras criada com base no cardápio aprovado",
        variant: "default"
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar lista de compras';
      toast({
        title: "Erro na Lista de Compras",
        description: errorMessage,
        variant: "destructive"
      });
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    generatedMenu,
    error,
    generateMenu,
    approveMenu,
    rejectMenu,
    generateShoppingListFromMenu,
    selectedClient
  };
};