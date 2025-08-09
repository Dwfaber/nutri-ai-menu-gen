import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useClientContractsContext } from '@/contexts/ClientContractsContext';
import { MarketProduct } from './useMarketProducts';
import { useMarketAvailability } from './useMarketAvailability';
import { useMenuBusinessRules } from './useMenuBusinessRules';

export interface MenuGenerationRequest {
  clientId: string;
  clientName: string;
  weekPeriod: string;
  maxCostPerMeal: number;
  totalEmployees: number;
  mealsPerMonth: number;
  mealsPerDay: number;
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
  costPerMeal: number;
  totalRecipes: number;
  recipes: MenuRecipe[];
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
}

export interface MenuRecipe {
  id: string;
  name: string;
  day: string;
  category: string;
  cost: number;
  servings: number;
  ingredients?: any[];
  nutritionalInfo?: any;
}

export const useIntegratedMenuGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState<GeneratedMenu | null>(null);
  const [savedMenus, setSavedMenus] = useState<GeneratedMenu[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { selectedClient } = useSelectedClient();
  const { getClientWithCosts } = useClientContractsContext();
  const { viableRecipes, marketIngredients, fetchMarketIngredients, checkRecipeViability, calculateRecipeRealCost } = useMarketAvailability();
  const { validateMenu, validateMenuAndSetViolations, filterRecipesForDay, violations } = useMenuBusinessRules();

  // Helper function to categorize salads by ingredient type
  const categorizeSalad = (recipeName: string, index: number): string => {
    const name = recipeName.toLowerCase();
    
    // Saladas com folhas verdes (Salada 1)
    if (name.includes('alface') || name.includes('rúcula') || name.includes('agrião') || 
        name.includes('espinafre') || name.includes('folhas') || index % 2 === 0) {
      return 'Salada 1';
    }
    
    // Saladas com legumes (Salada 2)
    return 'Salada 2';
  };

  // Helper function to categorize juices by flavor profile
  const categorizeJuice = (recipeName: string, index: number): string => {
    const name = recipeName.toLowerCase();
    
    // Sucos cítricos/ácidos (Suco 1)
    if (name.includes('laranja') || name.includes('limão') || name.includes('maracujá') || 
        name.includes('caju') || name.includes('acerola') || name.includes('abacaxi')) {
      return 'Suco 1';
    }
    
    // Sucos doces (Suco 2)  
    if (name.includes('manga') || name.includes('morango') || name.includes('pêssego') || 
        name.includes('uva') || name.includes('goiaba') || name.includes('coco') ||
        name.includes('banana') || name.includes('maçã')) {
      return 'Suco 2';
    }
    
    // Frutas vermelhas como coringa - alternar
    if (name.includes('frutas vermelhas') || name.includes('tropical')) {
      return index % 2 === 0 ? 'Suco 1' : 'Suco 2';
    }
    
    // Fallback: alternar entre categorias
    return index % 2 === 0 ? 'Suco 1' : 'Suco 2';
  };

  // New menu structure mapping based on business requirements
  const mapCategoryToMenuStructure = (category: string): string => {
    const normalizedCategory = category.toLowerCase().trim();
    
    if (normalizedCategory.includes('prato principal 1') || normalizedCategory === 'pp1') {
      return 'PP1';
    }
    
    if (normalizedCategory.includes('prato principal 2') || normalizedCategory === 'pp2') {
      return 'PP2';
    }
    
    if (normalizedCategory.includes('arroz branco') || normalizedCategory === 'arroz') {
      return 'Arroz Branco';
    }
    
    if (normalizedCategory.includes('feijão') || normalizedCategory === 'feijao') {
      return 'Feijão';
    }
    
    if (normalizedCategory.includes('salada')) {
      return 'Salada'; // Will be categorized later
    }
    
    if (normalizedCategory.includes('suco') || normalizedCategory.includes('bebida')) {
      return 'Suco'; // Will be categorized later
    }
    
    if (normalizedCategory.includes('sobremesa') || normalizedCategory.includes('fruta')) {
      return 'Sobremesa';
    }
    
    if (normalizedCategory.includes('guarnição') || normalizedCategory.includes('acompanhamento')) {
      return 'Guarnição';
    }
    
    return 'Outros';
  };

  // Carregar cardápios salvos
  const loadSavedMenus = async () => {
    try {
      const { data: menus, error: menusError } = await supabase
        .from('generated_menus')
        .select('*')
        .order('created_at', { ascending: false });

      if (menusError) throw menusError;

      const formattedMenus = menus?.map(menu => ({
        id: menu.id,
        clientId: menu.client_id,
        clientName: menu.client_name,
        weekPeriod: menu.week_period,
        totalCost: menu.total_cost,
        costPerMeal: menu.cost_per_meal,
        totalRecipes: menu.total_recipes,
        status: menu.status as 'pending_approval' | 'approved' | 'rejected',
        approvedBy: menu.approved_by,
        rejectedReason: menu.rejected_reason,
        recipes: (Array.isArray(menu.receitas_adaptadas) ? menu.receitas_adaptadas : []).map((recipe: any) => ({
          id: recipe.receita_id_legado,
          name: recipe.nome_receita,
          category: recipe.categoria_descricao,
          day: recipe.day,
          cost: recipe.custo_adaptado,
          servings: recipe.porcoes,
          ingredients: recipe.ingredientes || [],
          nutritionalInfo: recipe.nutritional_info || {}
        })),
        createdAt: menu.created_at
      })) || [];

      setSavedMenus(formattedMenus);
    } catch (error) {
      console.error('Erro ao carregar cardápios salvos:', error);
    }
  };

  // Salvar cardápio no banco
  const saveMenuToDatabase = async (menu: GeneratedMenu): Promise<string | null> => {
    try {
      // Preparar receitas adaptadas para salvar
      const receitasAdaptadas = menu.recipes.map(recipe => ({
        receita_id_legado: recipe.id,
        nome_receita: recipe.name,
        categoria_descricao: recipe.category,
        day: recipe.day,
        custo_adaptado: recipe.cost,
        porcoes: recipe.servings,
        ingredientes: recipe.ingredients || [],
        nutritional_info: recipe.nutritionalInfo || {}
      }));

      // Salvar cardápio principal com receitas adaptadas
      const { data: savedMenu, error: menuError } = await supabase
        .from('generated_menus')
        .insert({
          client_id: menu.clientId,
          client_name: menu.clientName,
          week_period: menu.weekPeriod,
          total_cost: menu.totalCost,
          cost_per_meal: menu.costPerMeal,
          total_recipes: menu.totalRecipes,
          status: menu.status,
          receitas_ids: menu.recipes.map(r => r.id),
          receitas_adaptadas: receitasAdaptadas
        })
        .select('id')
        .single();

      if (menuError) throw menuError;

      return savedMenu.id;
    } catch (error) {
      console.error('Erro ao salvar cardápio:', error);
      return null;
    }
  };

  // Excluir cardápio do banco
  const deleteGeneratedMenu = async (menuId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('generated_menus')
        .delete()
        .eq('id', menuId);

      if (error) throw error;

      // Remove from local state
      setSavedMenus(prev => prev.filter(menu => menu.id !== menuId));
      
      // Clear generated menu if it's the one being deleted
      if (generatedMenu?.id === menuId) {
        setGeneratedMenu(null);
      }

      toast({
        title: "Cardápio excluído",
        description: "Cardápio removido com sucesso",
      });

      return true;
    } catch (error) {
      console.error('Erro ao excluir cardápio:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o cardápio",
        variant: "destructive"
      });
      return false;
    }
  };

  // Carregar cardápios ao montar o componente
  useEffect(() => {
    loadSavedMenus();
  }, []);

  const generateMenuWithFormData = async (
    formData: any
  ): Promise<GeneratedMenu | null> => {
    if (!formData.clientId || !formData.period.start || !formData.period.end) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return null;
    }

    const weekPeriod = `${formData.period.start} a ${formData.period.end}`;
    const preferences = formData.preferences ? [formData.preferences] : [];
    
    // Use the selected client from context or override with form data
    const clientToUse = selectedClient?.id === formData.clientId ? selectedClient : formData.contractData;
    
    return generateMenu(weekPeriod, preferences, clientToUse);
  };

  const generateMenu = async (
    weekPeriod: string,
    preferences?: string[],
    clientOverride?: any
  ): Promise<GeneratedMenu | null> => {
    const clientToUse = clientOverride || selectedClient;
    
    if (!clientToUse) {
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
      
      console.log('Gerando cardápio com IA integrada...');
      console.log('Cliente selecionado:', {
        id: clientToUse.cliente_id_legado || clientToUse.id,
        nome: clientToUse.nome_empresa,
        funcionarios: clientToUse.total_funcionarios,
        custo_maximo: clientToUse.custo_maximo_refeicao,
        restricoes: clientToUse.restricoes_alimentares
      });
      
      // Use GPT Assistant para gerar cardápio com custos reais e proporções corretas
      const { data, error: functionError } = await supabase.functions.invoke('gpt-assistant', {
        body: {
          action: 'generateMenu',
          clientId: clientToUse.cliente_id_legado || clientToUse.id,
          budget: clientToUse.custo_maximo_refeicao || 15,
          restrictions: clientToUse.restricoes_alimentares || [],
          preferences: preferences?.join(', ') || '',
          weekPeriod,
          totalEmployees: clientToUse.total_funcionarios || 100,
          totalMealsPerMonth: clientToUse.total_refeicoes_mes || 2000,
          // Instruir IA a usar quantidade_refeicoes para cálculos proporcionais
          useProportionalCalculation: true,
          targetServings: clientToUse.total_funcionarios || 100
        }
      });

      console.log('Resposta da função GPT Assistant:', { data, functionError });

      if (functionError) {
        console.error('Erro na função GPT:', functionError);
        throw new Error(functionError.message || 'Erro ao gerar cardápio com IA');
      }

      if (!data || !data.success) {
        console.error('Dados inválidos da função GPT:', data);
        throw new Error(data?.error || 'Erro na geração do cardápio');
      }

      const aiGeneratedMenu = data.menu;
      console.log('Cardápio gerado pela IA:', aiGeneratedMenu);

      // Validar se o cardápio tem custo válido
      if (!aiGeneratedMenu || aiGeneratedMenu.total_cost === 0) {
        console.warn('Cardápio gerado com custo zero - verificando fallback...');
        if (aiGeneratedMenu?.summary?.fallback_used) {
          console.log('Sistema de fallback foi usado, mas retornou custo zero');
        }
      }

      // Processar o cardápio retornado pela IA
      if (!aiGeneratedMenu || !aiGeneratedMenu.recipes) {
        throw new Error('IA não retornou um cardápio válido');
      }

      // Converter receitas da IA para formato interno
      const receitasCardapio: MenuRecipe[] = aiGeneratedMenu.recipes.map((recipe: any) => ({
        id: recipe.id || recipe.receita_id_legado,
        name: recipe.name || recipe.nome_receita,
        category: recipe.category || recipe.categoria,
        day: recipe.day || recipe.dia,
        cost: recipe.cost || recipe.custo_real || recipe.costPerServing || recipe.custo_por_porcao || recipe.custo_adaptado || 0,
        servings: recipe.servings || recipe.porcoes || 50,
        ingredients: recipe.ingredients || [],
        nutritionalInfo: recipe.nutritionalInfo || {}
      }));

      console.log(`IA gerou ${receitasCardapio.length} receitas com custos calculados`);

      // Validar regras de negócio no cardápio da IA
      const businessRules = validateMenu(receitasCardapio);
      console.log('Validação de regras:', businessRules);
      console.log('Violações encontradas:', violations);
      
      // Verificar se os custos estão dentro do orçamento
      const totalCost = receitasCardapio.reduce((sum, recipe) => sum + recipe.cost, 0);
      const costPerMeal = totalCost / 5; // 5 dias da semana
      const budgetLimit = clientToUse.custo_maximo_refeicao || 15;
      
      if (costPerMeal > budgetLimit) {
        console.warn(`Custo por refeição (R$ ${costPerMeal.toFixed(2)}) excede o orçamento (R$ ${budgetLimit.toFixed(2)})`);
        
        toast({
          title: "Atenção: Orçamento Excedido",
          description: `Custo estimado: R$ ${costPerMeal.toFixed(2)} | Limite: R$ ${budgetLimit.toFixed(2)}`,
          variant: "destructive"
        });
      }

      // Usar os custos e informações calculados pela IA

      // Create generated menu
      const menu: GeneratedMenu = {
        id: crypto.randomUUID(),
        clientId: clientToUse.id || clientToUse.cliente_id_legado,
        clientName: clientToUse.nome_fantasia || clientToUse.nome_empresa,
        weekPeriod,
        status: 'pending_approval',
        totalCost,
        costPerMeal,
        totalRecipes: receitasCardapio.length,
        recipes: receitasCardapio,
        createdAt: new Date().toISOString()
      };

      // Save to database
      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        menu.id = savedId;
        setGeneratedMenu(menu);
        await loadSavedMenus();

        toast({
          title: "Cardápio Gerado com IA!",
          description: `${receitasCardapio.length} receitas otimizadas. Custo: R$ ${costPerMeal.toFixed(2)}/refeição`,
        });
        
        console.log('Menu generation with AI completed successfully');
        console.log('Final cost per meal:', costPerMeal);
        console.log('Budget compliance:', costPerMeal <= budgetLimit ? 'OK' : 'EXCEEDED');

        return menu;
      } else {
        throw new Error('Erro ao salvar cardápio no banco de dados');
      }

    } catch (error) {
      console.error('Error generating menu:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao gerar cardápio';
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

  const approveMenu = async (menuId: string, approverName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('generated_menus')
        .update({
          status: 'approved',
          approved_by: approverName
        })
        .eq('id', menuId);

      if (error) throw error;

      // Update local state
      if (generatedMenu && generatedMenu.id === menuId) {
        setGeneratedMenu({
          ...generatedMenu,
          status: 'approved',
          approvedBy: approverName,
          approvedAt: new Date().toISOString()
        });
      }

      // Reload saved menus
      await loadSavedMenus();

      toast({
        title: "Cardápio aprovado!",
        description: `Cardápio aprovado por ${approverName}`,
        variant: "default"
      });

      return true;
    } catch (error) {
      console.error('Error approving menu:', error);
      toast({
        title: "Erro ao aprovar cardápio",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
      return false;
    }
  };

  const rejectMenu = async (menuId: string, reason: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('generated_menus')
        .update({
          status: 'rejected',
          rejected_reason: reason
        })
        .eq('id', menuId);

      if (error) throw error;

      // Update local state
      if (generatedMenu && generatedMenu.id === menuId) {
        setGeneratedMenu({
          ...generatedMenu,
          status: 'rejected',
          rejectedReason: reason
        });
      }

      // Reload saved menus
      await loadSavedMenus();

      toast({
        title: "Cardápio rejeitado",
        description: `Motivo: ${reason}`,
        variant: "destructive"
      });

      return true;
    } catch (error) {
      console.error('Error rejecting menu:', error);
      toast({
        title: "Erro ao rejeitar cardápio",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
      return false;
    }
  };

  const generateShoppingListFromMenu = async (menu: GeneratedMenu) => {
    try {
      setIsGenerating(true);

      const { data, error } = await supabase.functions.invoke('generate-shopping-list', {
        body: {
          menuId: menu.id,
          clientName: menu.clientName,
          budgetPredicted: menu.totalCost,
          menuItems: menu.recipes.map(recipe => ({
            receita_id: recipe.id,
            name: recipe.name,
            category: recipe.category,
            cost: recipe.cost,
            servings: recipe.servings,
            ingredients: recipe.ingredients || []
          })),
          optimizationConfig: {
            prioridade_promocao: 'media',
            tolerancia_sobra_percentual: 10,
            preferir_produtos_integrais: true,
            maximo_tipos_embalagem_por_produto: 3,
            considerar_custo_compra: false
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Lista de compras gerada!",
        description: "A lista de compras foi criada com base no cardápio aprovado",
        variant: "default"
      });

    } catch (error) {
      console.error('Error generating shopping list:', error);
      toast({
        title: "Erro ao gerar lista de compras",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearGeneratedMenu = () => {
    setGeneratedMenu(null);
    setError(null);
  };

  const mapRecipesToMarketProducts = async (recipes: MenuRecipe[]): Promise<any[]> => {
    try {
      const marketProducts: any[] = [];
      
      for (const recipe of recipes) {
        if (recipe.ingredients && recipe.ingredients.length > 0) {
          for (const ingredient of recipe.ingredients) {
            if (ingredient.produto_base_id) {
              const marketProduct = marketIngredients.find(
                mp => mp.produto_base_id === ingredient.produto_base_id
              );
              
              if (marketProduct) {
                marketProducts.push({
                  ...marketProduct,
                  quantity_needed: ingredient.quantity,
                  recipe_name: recipe.name,
                  recipe_id: recipe.id
                });
              }
            }
          }
        }
      }
      
      return marketProducts;
    } catch (error) {
      console.error('Error mapping recipes to market products:', error);
      return [];
    }
  };

  return {
    isGenerating,
    generatedMenu,
    savedMenus,
    error,
    generateMenuWithFormData,
    generateMenu,
    approveMenu,
    rejectMenu,
    generateShoppingListFromMenu,
    clearGeneratedMenu,
    loadSavedMenus,
    deleteGeneratedMenu,
    mapRecipesToMarketProducts,
    // Export related hooks for business rules
    violations,
    validateMenu,
    validateMenuAndSetViolations,
    // Export market availability hooks
    viableRecipes,
    marketIngredients
  };
};