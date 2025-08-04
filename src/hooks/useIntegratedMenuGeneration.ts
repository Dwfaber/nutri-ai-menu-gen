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
  const { viableRecipes, marketIngredients, fetchMarketIngredients, checkRecipeViability } = useMarketAvailability();
  const { validateMenu, filterRecipesForDay, violations } = useMenuBusinessRules();

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
    
    // Saladas by ingredient type
    if (normalizedCategory.includes('salada')) {
      // TODO: Categorize by ingredients (verduras/folhas vs legumes)
      return 'Salada 1'; // Default, will be improved with ingredient analysis
    }
    
    if (normalizedCategory.includes('suco') || normalizedCategory.includes('bebida')) {
      return 'Suco 1'; // Default, will be improved to have Suco 1 and Suco 2
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

      console.log('Generating menu with market availability and business rules for client:', clientToUse.nome_fantasia);

      // Step 1: Check market availability
      await fetchMarketIngredients();
      const viable = await checkRecipeViability();
      
      if (viable.length === 0) {
        throw new Error('Nenhuma receita viável encontrada com os ingredientes disponíveis no mercado');
      }

      console.log(`Found ${viable.length} viable recipes based on market availability`);

      // Step 2: Organize viable recipes by new structure categories
      const newMenuStructure = {
        'PP1': viable.filter(r => r.categoria_descricao === 'Prato Principal 1') || [],
        'PP2': [], // To be identified from other categories or created
        'Arroz Branco': [], // Fixed items
        'Feijão': [], // Fixed items  
        'Salada 1': viable.filter(r => r.categoria_descricao === 'Salada') || [],
        'Salada 2': [], // To be separated by ingredient type
        'Suco 1': [], // To be identified from beverages
        'Suco 2': [], // To be identified from beverages
        'Guarnição': viable.filter(r => r.categoria_descricao === 'Guarnição') || [],
        'Sobremesa': viable.filter(r => r.categoria_descricao === 'Sobremesa') || []
      };

      // Step 3: Generate weekly menu with business rules
      const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
      const receitasCardapio: MenuRecipe[] = [];
      const receitasUsadas = new Set<string>();
      const custoMaximoPorRefeicao = clientToUse.custo_medio_diario || 7.30;

      // Fixed items (always present)
      days.forEach(day => {
        // Add fixed Arroz Branco
        receitasCardapio.push({
          id: `arroz-${day}`,
          name: 'Arroz Branco',
          category: 'Arroz Branco',
          day,
          cost: 0.8,
          servings: 50,
          ingredients: [],
          nutritionalInfo: {}
        });

        // Add fixed Feijão
        receitasCardapio.push({
          id: `feijao-${day}`,
          name: 'Feijão Carioca',
          category: 'Feijão',
          day,
          cost: 1.2,
          servings: 50,
          ingredients: [],
          nutritionalInfo: {}
        });
      });

      // Step 4: Generate recipes for each day with business rules
      days.forEach((day, dayIndex) => {
        const previousDayRecipes = dayIndex > 0 
          ? receitasCardapio.filter(r => r.day === days[dayIndex - 1])
          : [];

        // PP1 - Main protein following business rules
        const pp1Recipes = filterRecipesForDay(newMenuStructure.PP1, day, dayIndex, previousDayRecipes);
        if (pp1Recipes.length > 0) {
          const selectedPP1 = pp1Recipes[dayIndex % pp1Recipes.length];
          const cost = Math.min(selectedPP1.custo_total || 3.5, custoMaximoPorRefeicao * 0.4);
          
          receitasCardapio.push({
            id: selectedPP1.receita_id_legado,
            name: selectedPP1.nome_receita,
            category: 'PP1',
            day,
            cost,
            servings: selectedPP1.porcoes || 50,
            ingredients: [],
            nutritionalInfo: {}
          });
          
          receitasUsadas.add(selectedPP1.receita_id_legado);
        }

        // Add other categories (Salada, Guarnição, Sobremesa)
        ['Salada 1', 'Guarnição', 'Sobremesa'].forEach(categoria => {
          const categoryRecipes = newMenuStructure[categoria] || [];
          if (categoryRecipes.length > 0) {
            const available = categoryRecipes.filter(r => !receitasUsadas.has(r.receita_id_legado));
            if (available.length > 0) {
              const selected = available[dayIndex % available.length];
              const maxCost = categoria === 'Sobremesa' ? custoMaximoPorRefeicao * 0.15 : custoMaximoPorRefeicao * 0.25;
              const cost = Math.min(selected.custo_total || 1.5, maxCost);
              
              receitasCardapio.push({
                id: selected.receita_id_legado,
                name: selected.nome_receita,
                category: categoria,
                day,
                cost,
                servings: selected.porcoes || 50,
                ingredients: [],
                nutritionalInfo: {}
              });
              
              receitasUsadas.add(selected.receita_id_legado);
            }
          }
        });
      });

      // Step 5: Validate business rules
      const businessRules = validateMenu(receitasCardapio);
      console.log('Business rules validation:', businessRules);
      console.log('Violations found:', violations);

      // Calculate totals
      const totalCost = receitasCardapio.reduce((sum, recipe) => sum + recipe.cost, 0);
      const costPerMeal = totalCost / days.length;

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
          title: "Cardápio gerado com sucesso!",
          description: `Criado cardápio para ${weekPeriod} com ${receitasCardapio.length} receitas`,
          variant: "default"
        });

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
    generateMenu,
    generateMenuWithFormData,
    approveMenu,
    rejectMenu,
    generateShoppingListFromMenu,
    clearGeneratedMenu,
    loadSavedMenus,
    mapRecipesToMarketProducts,
    // New exports for business rules and market availability
    viableRecipes,
    marketIngredients,
    violations,
    validateMenu
  };
};