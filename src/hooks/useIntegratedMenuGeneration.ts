import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useClientContractsContext } from '@/contexts/ClientContractsContext';
import { MarketProduct } from './useMarketProducts';

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

  // Função para mapear categorias da API para tipos de refeição
  const mapCategoryToMealType = (category: string): string => {
    const normalizedCategory = category.toLowerCase().trim();
    
    // Proteínas (PP1)
    if (normalizedCategory.includes('proteín') || 
        normalizedCategory.includes('carne') || 
        normalizedCategory.includes('frango') || 
        normalizedCategory.includes('peixe') || 
        normalizedCategory.includes('boi') || 
        normalizedCategory.includes('porco') || 
        normalizedCategory.includes('ave') ||
        normalizedCategory.includes('protein') ||
        normalizedCategory === 'pp1') {
      return 'PP1';
    }
    
    // Saladas
    if (normalizedCategory.includes('salada') || 
        normalizedCategory.includes('verdura') || 
        normalizedCategory.includes('folha') || 
        normalizedCategory.includes('vegetal') ||
        normalizedCategory.includes('hortaliça') ||
        normalizedCategory.includes('vegetable')) {
      return 'SALADA 1';
    }
    
    // Sobremesas
    if (normalizedCategory.includes('sobremesa') || 
        normalizedCategory.includes('doce') || 
        normalizedCategory.includes('fruta') ||
        normalizedCategory.includes('dessert') ||
        normalizedCategory.includes('fruit')) {
      return 'SOBREMESA';
    }
    
    // Acompanhamentos (default para carboidratos, cereais, etc.)
    return 'ACOMPANHAMENTO';
  };

  // Função para distribuir receitas pelos dias da semana com balanceamento
  const distributeRecipesByDay = (recipes: any[]): MenuRecipe[] => {
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    const requiredCategories = ['PP1', 'SALADA 1', 'ACOMPANHAMENTO', 'SOBREMESA'];
    
    // Primeiro, categorizar as receitas
    const categorizedRecipes: { [key: string]: any[] } = {};
    recipes.forEach(recipe => {
      const category = mapCategoryToMealType(recipe.category || 'other');
      if (!categorizedRecipes[category]) {
        categorizedRecipes[category] = [];
      }
      categorizedRecipes[category].push(recipe);
    });
    
    console.log('Receitas categorizadas:', categorizedRecipes);
    
    // Distribuir receitas garantindo diversidade por dia
    const menuRecipes: MenuRecipe[] = [];
    let recipeIndex = 0;
    
    // Para cada dia, tentar ter pelo menos uma de cada categoria
    days.forEach((day, dayIndex) => {
      requiredCategories.forEach(category => {
        const categoryRecipes = categorizedRecipes[category] || [];
        if (categoryRecipes.length > 0) {
          const recipeForDay = categoryRecipes[dayIndex % categoryRecipes.length];
          if (recipeForDay) {
            const cost = typeof recipeForDay.costPerServing === 'number' 
              ? recipeForDay.costPerServing 
              : (typeof recipeForDay.cost === 'number' ? recipeForDay.cost : 5.0);
            
            menuRecipes.push({
              id: recipeForDay.id || `recipe-${recipeIndex++}`,
              name: recipeForDay.name || `Receita ${category}`,
              category,
              day,
              cost: Math.max(cost, 1.0), // Mínimo de R$ 1,00 por receita
              servings: recipeForDay.servings || 50,
              ingredients: recipeForDay.ingredients || [],
              nutritionalInfo: recipeForDay.nutritionalInfo || {}
            });
          }
        }
      });
    });
    
    // Se não temos receitas suficientes, distribuir o que temos
    if (menuRecipes.length === 0) {
      return recipes.map((recipe: any, index: number) => {
        const dayIndex = index % days.length;
        const cost = typeof recipe.costPerServing === 'number' 
          ? recipe.costPerServing 
          : (typeof recipe.cost === 'number' ? recipe.cost : 5.0);
        
        return {
          id: recipe.id || `recipe-${index}`,
          name: recipe.name || 'Receita sem nome',
          category: mapCategoryToMealType(recipe.category || 'other'),
          day: days[dayIndex],
          cost: Math.max(cost, 1.0),
          servings: recipe.servings || 50,
          ingredients: recipe.ingredients || [],
          nutritionalInfo: recipe.nutritionalInfo || {}
        };
      });
    }
    
    return menuRecipes;
  };

  // Carregar cardápios salvos
  const loadSavedMenus = async () => {
    try {
      const { data: menus, error: menusError } = await supabase
        .from('generated_menus')
        .select(`
          *,
          menu_recipes (*)
        `)
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
        recipes: menu.menu_recipes.map((recipe: any) => ({
          id: recipe.recipe_id,
          name: recipe.name,
          category: recipe.category,
          day: recipe.day,
          cost: recipe.cost,
          servings: recipe.servings,
          ingredients: recipe.ingredients || [],
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
      // Salvar cardápio principal
      const { data: savedMenu, error: menuError } = await supabase
        .from('generated_menus')
        .insert({
          client_id: menu.clientId,
          client_name: menu.clientName,
          week_period: menu.weekPeriod,
          total_cost: menu.totalCost,
          cost_per_meal: menu.costPerMeal,
          total_recipes: menu.totalRecipes,
          status: menu.status
        })
        .select('id')
        .single();

      if (menuError) throw menuError;

      // Salvar receitas
      const recipesToSave = menu.recipes.map(recipe => ({
        menu_id: savedMenu.id,
        recipe_id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        day: recipe.day,
        cost: recipe.cost,
        servings: recipe.servings,
        ingredients: recipe.ingredients || [],
        nutritional_info: recipe.nutritionalInfo || {}
      }));

      const { error: recipesError } = await supabase
        .from('menu_recipes')
        .insert(recipesToSave);

      if (recipesError) throw recipesError;

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
        .eq('em_promocao_sim_nao', false)
        .limit(100);

      if (marketError) {
        throw new Error(`Erro ao buscar produtos do mercado: ${marketError.message}`);
      }

      // Get client costs and cost details
      const clientWithCosts = getClientWithCosts(selectedClient.id);
      
      let enhancedCostData = null;
      if (clientWithCosts) {
        enhancedCostData = {
          daily_costs: clientWithCosts.dailyCosts,
          validation_rules: clientWithCosts.validationRules,
          cost_details: clientWithCosts.costDetails,
          total_branches: clientWithCosts.totalBranches
        };
      }

      console.log('Generating menu with request for client:', selectedClient.nome_fantasia);

      // Call GPT Assistant for menu generation
      const { data: gptResponse, error: gptError } = await supabase.functions.invoke('gpt-assistant', {
        body: {
          action: 'generate_menu',
          client_data: {
            id: selectedClient.id,
            name: selectedClient.nome_fantasia,
            max_cost_per_meal: selectedClient.custo_medio_diario || 7.30,
            total_employees: 50,
            meals_per_month: 100,
            dietary_restrictions: [],
            preferences: preferences || []
          },
          week_period: weekPeriod,
          market_products: (marketProducts || []).slice(0, 50),
          enhanced_cost_data: enhancedCostData
        }
      });

      if (gptError) {
        throw new Error(`Erro na geração do cardápio: ${gptError.message}`);
      }

      console.log('GPT Response received:', gptResponse);

      if (!gptResponse?.success) {
        throw new Error(gptResponse?.error || 'Erro desconhecido na geração do cardápio');
      }

      // Processar resposta da API
      const apiRecipes = gptResponse.menu?.recipes || [];
      const processedRecipes = distributeRecipesByDay(apiRecipes);
      
      const totalCost = processedRecipes.reduce((sum, recipe) => sum + recipe.cost, 0);
      const costPerMeal = processedRecipes.length > 0 ? totalCost / processedRecipes.length : 0;

      const menu: GeneratedMenu = {
        id: `menu_${Date.now()}`,
        clientId: selectedClient.id,
        clientName: selectedClient.nome_fantasia,
        weekPeriod,
        status: 'pending_approval',
        totalCost,
        costPerMeal,
        totalRecipes: processedRecipes.length,
        recipes: processedRecipes,
        createdAt: new Date().toISOString()
      };

      console.log('Processed menu:', menu);

      // Salvar no banco automaticamente
      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        menu.id = savedId;
        // Recarregar lista de cardápios salvos
        await loadSavedMenus();
      }

      setGeneratedMenu(menu);

      toast({
        title: "Cardápio Gerado e Salvo",
        description: `Cardápio para ${selectedClient.nome_fantasia} criado com sucesso`,
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
      // Atualizar no banco
      const { error } = await supabase
        .from('generated_menus')
        .update({
          status: 'approved',
          approved_by: approvedBy
        })
        .eq('id', menuId);

      if (error) throw error;

      // Atualizar estado local
      if (generatedMenu && generatedMenu.id === menuId) {
        setGeneratedMenu({
          ...generatedMenu,
          status: 'approved',
          approvedBy
        });
      }

      // Recarregar lista
      await loadSavedMenus();

      toast({
        title: "Cardápio Aprovado",
        description: "O cardápio foi aprovado e pode ser usado para gerar lista de compras",
        variant: "default"
      });

      return true;
    } catch (err) {
      console.error('Erro ao aprovar cardápio:', err);
      return false;
    }
  };

  const rejectMenu = async (menuId: string, reason: string): Promise<boolean> => {
    try {
      // Atualizar no banco
      const { error } = await supabase
        .from('generated_menus')
        .update({
          status: 'rejected',
          rejected_reason: reason
        })
        .eq('id', menuId);

      if (error) throw error;

      // Atualizar estado local
      if (generatedMenu && generatedMenu.id === menuId) {
        setGeneratedMenu({
          ...generatedMenu,
          status: 'rejected',
          rejectedReason: reason
        });
      }

      // Recarregar lista
      await loadSavedMenus();

      toast({
        title: "Cardápio Rejeitado",
        description: "O cardápio foi rejeitado. Você pode gerar um novo.",
        variant: "default"
      });

      return true;
    } catch (err) {
      console.error('Erro ao rejeitar cardápio:', err);
      return false;
    }
  };

  const generateShoppingListFromMenu = async (menu: GeneratedMenu): Promise<boolean> => {
    if (!selectedClient) return false;

    try {
      setIsGenerating(true);

      // Preparar receitas com ingredientes mapeados para produtos do mercado
      const recipesWithMappedIngredients = await mapRecipesToMarketProducts(menu.recipes);

      const { data: shoppingResponse, error: shoppingError } = await supabase.functions.invoke('generate-shopping-list', {
        body: {
          menuId: menu.id,
          clientName: selectedClient.nome_fantasia,
          budgetPredicted: menu.totalCost,
          menuItems: recipesWithMappedIngredients,
          optimizationConfig: {
            prioridade_promocao: 'alta',
            tolerancia_sobra_percentual: 10,
            preferir_produtos_integrais: false,
            maximo_tipos_embalagem_por_produto: 3,
            considerar_custo_compra: false
          }
        }
      });

      if (shoppingError) {
        throw new Error(`Erro ao gerar lista de compras: ${shoppingError.message}`);
      }

      toast({
        title: "Lista de Compras Gerada",
        description: "Lista de compras criada com base no cardápio aprovado usando produtos do mercado",
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

  // Função para mapear receitas para produtos do mercado
  const mapRecipesToMarketProducts = async (recipes: MenuRecipe[]) => {
    try {
      // Buscar produtos do mercado
      const { data: marketProducts, error } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('*')
        .eq('em_promocao_sim_nao', false);

      if (error) throw error;

      // Criar mapeamento de produtos por descrição/categoria
      const productMap = new Map();
      marketProducts?.forEach(product => {
        const key = product.descricao?.toLowerCase().trim();
        if (key && !productMap.has(key)) {
          productMap.set(key, product);
        }
      });

      // Mapear receitas com ingredientes do mercado
      return recipes.map(recipe => {
        const mappedIngredients = [];
        
        // Criar ingredientes baseados na categoria da receita
        if (recipe.category === 'PP1') {
          // Proteínas
          const proteinProducts = marketProducts?.filter(p => 
            p.categoria_descricao?.toLowerCase().includes('proteín') ||
            p.categoria_descricao?.toLowerCase().includes('carne') ||
            p.descricao?.toLowerCase().includes('frango') ||
            p.descricao?.toLowerCase().includes('boi')
          ).slice(0, 3) || [];

          proteinProducts.forEach(product => {
            mappedIngredients.push({
              produto_id: product.produto_id || product.solicitacao_produto_listagem_id,
              produto_base_id: product.produto_base_id,
              nome: product.descricao,
              quantidade: product.per_capita * 50 || 2.5, // Para 50 porções
              unidade: product.unidade || 'kg'
            });
          });
        } else if (recipe.category === 'SALADA 1') {
          // Vegetais e verduras
          const vegetableProducts = marketProducts?.filter(p => 
            p.categoria_descricao?.toLowerCase().includes('vegetal') ||
            p.categoria_descricao?.toLowerCase().includes('verdura') ||
            p.categoria_descricao?.toLowerCase().includes('hortaliça') ||
            p.descricao?.toLowerCase().includes('alface') ||
            p.descricao?.toLowerCase().includes('tomate')
          ).slice(0, 4) || [];

          vegetableProducts.forEach(product => {
            mappedIngredients.push({
              produto_id: product.produto_id || product.solicitacao_produto_listagem_id,
              produto_base_id: product.produto_base_id,
              nome: product.descricao,
              quantidade: product.per_capita * 50 || 1.5,
              unidade: product.unidade || 'kg'
            });
          });
        } else if (recipe.category === 'ACOMPANHAMENTO') {
          // Carboidratos e cereais
          const carbProducts = marketProducts?.filter(p => 
            p.descricao?.toLowerCase().includes('arroz') ||
            p.descricao?.toLowerCase().includes('feijão') ||
            p.descricao?.toLowerCase().includes('macarrão') ||
            p.descricao?.toLowerCase().includes('batata')
          ).slice(0, 3) || [];

          carbProducts.forEach(product => {
            mappedIngredients.push({
              produto_id: product.produto_id || product.solicitacao_produto_listagem_id,
              produto_base_id: product.produto_base_id,
              nome: product.descricao,
              quantidade: product.per_capita * 50 || 3.0,
              unidade: product.unidade || 'kg'
            });
          });
        } else if (recipe.category === 'SOBREMESA') {
          // Frutas e doces
          const dessertProducts = marketProducts?.filter(p => 
            p.categoria_descricao?.toLowerCase().includes('fruta') ||
            p.descricao?.toLowerCase().includes('banana') ||
            p.descricao?.toLowerCase().includes('maçã') ||
            p.descricao?.toLowerCase().includes('açúcar')
          ).slice(0, 2) || [];

          dessertProducts.forEach(product => {
            mappedIngredients.push({
              produto_id: product.produto_id || product.solicitacao_produto_listagem_id,
              produto_base_id: product.produto_base_id,
              nome: product.descricao,
              quantidade: product.per_capita * 50 || 1.0,
              unidade: product.unidade || 'kg'
            });
          });
        }

        return {
          ...recipe,
          ingredients: mappedIngredients
        };
      });

    } catch (error) {
      console.error('Erro ao mapear receitas para produtos do mercado:', error);
      return recipes; // Retorna receitas originais se houver erro
    }
  };

  const clearGeneratedMenu = () => {
    setGeneratedMenu(null);
    setError(null);
  };

  return {
    isGenerating,
    generatedMenu,
    savedMenus,
    error,
    generateMenu,
    approveMenu,
    rejectMenu,
    generateShoppingListFromMenu,
    clearGeneratedMenu,
    loadSavedMenus,
    selectedClient
  };
};