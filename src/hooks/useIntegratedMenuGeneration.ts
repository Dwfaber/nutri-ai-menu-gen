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

      console.log('Generating menu with market availability and business rules for client:', clientToUse.nome_fantasia);

      // Step 1: Check market availability
      await fetchMarketIngredients();
      const viable = await checkRecipeViability();
      
      if (viable.length === 0) {
        throw new Error('Nenhuma receita viável encontrada com os ingredientes disponíveis no mercado');
      }

      console.log(`Found ${viable.length} viable recipes based on market availability`);

      // Step 2: Fetch juice varieties from database and organize viable recipes
      const { data: juiceRecipes, error: juiceError } = await supabase
        .from('receitas_legado')
        .select('*')
        .ilike('nome_receita', '%SUCO EM PÓ%')
        .eq('inativa', false);

      if (juiceError) {
        console.warn('Error fetching juice recipes:', juiceError);
      }

      // Combine database juices with viable recipes
      const allJuices = [
        ...(juiceRecipes || []),
        ...viable.filter(r => 
          r.categoria_descricao?.toLowerCase().includes('suco') || 
          r.categoria_descricao?.toLowerCase().includes('bebida') ||
          r.nome_receita?.toLowerCase().includes('suco')
        )
      ];

      // Remove duplicates by receita_id_legado
      const uniqueJuices = allJuices.filter((juice, index, self) => 
        index === self.findIndex(j => j.receita_id_legado === juice.receita_id_legado)
      );

      const saladas = viable.filter(r => r.categoria_descricao?.toLowerCase().includes('salada')) || [];
      
      // Create PP2 from available proteins or garnições
      const pp2Candidates = viable.filter(r => 
        r.categoria_descricao === 'Prato Principal 2' ||
        r.categoria_descricao === 'Guarnição' ||
        (r.categoria_descricao?.includes('Proteína') && r.categoria_descricao !== 'Prato Principal 1')
      ) || [];

      // Distribute salads between Salada 1 and Salada 2
      const salada1 = [];
      const salada2 = [];
      saladas.forEach((salada, index) => {
        const category = categorizeSalad(salada.nome_receita, index);
        if (category === 'Salada 1') {
          salada1.push(salada);
        } else {
          salada2.push(salada);
        }
      });

      // Distribute juices between Suco 1 and Suco 2 with intelligent selection
      const suco1 = [];
      const suco2 = [];
      const usedJuiceFlavors = new Set<string>(); // Track used flavors to avoid repetition
      
      uniqueJuices.forEach((suco, index) => {
        const category = categorizeJuice(suco.nome_receita, index);
        if (category === 'Suco 1') {
          suco1.push(suco);
        } else {
          suco2.push(suco);
        }
      });

      console.log(`Found ${suco1.length} Suco 1 varieties and ${suco2.length} Suco 2 varieties from database`);

      const newMenuStructure = {
        'PP1': viable.filter(r => r.categoria_descricao === 'Prato Principal 1') || [],
        'PP2': pp2Candidates,
        'Arroz Branco': [], // Fixed items
        'Feijão': [], // Fixed items  
        'Salada 1': salada1,
        'Salada 2': salada2,
        'Suco 1': suco1,
        'Suco 2': suco2,
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

      // Step 4: Generate recipes for each day with intelligent juice selection
      const weeklyJuiceTracker = { 'Suco 1': new Set(), 'Suco 2': new Set() };
      
      for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
        const day = days[dayIndex];
        const previousDayRecipes = dayIndex > 0 
          ? receitasCardapio.filter(r => r.day === days[dayIndex - 1])
          : [];

        // PP1 - Main protein following business rules
        const pp1Recipes = filterRecipesForDay(newMenuStructure.PP1, day, dayIndex, previousDayRecipes);
        if (pp1Recipes.length > 0) {
          const selectedPP1 = pp1Recipes[dayIndex % pp1Recipes.length];
          // Calculate real cost based on market prices
          const realCost = await calculateRecipeRealCost(selectedPP1.receita_id_legado);
          const cost = realCost > 0 ? realCost : (selectedPP1.custo_total || 3.5);
          
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

        // Generate all required categories with intelligent juice selection
        const requiredCategories = ['PP2', 'Salada 1', 'Salada 2', 'Suco 1', 'Suco 2', 'Guarnição', 'Sobremesa'];
        
        for (const categoria of requiredCategories) {
          const categoryRecipes = newMenuStructure[categoria] || [];
          
          if (categoryRecipes.length > 0) {
            let selected;
            
            // Special logic for juices to avoid repetition
            if (categoria.includes('Suco')) {
              const availableJuices = categoryRecipes.filter(r => 
                !receitasUsadas.has(r.receita_id_legado) && 
                !weeklyJuiceTracker[categoria].has(r.receita_id_legado)
              );
              
              if (availableJuices.length > 0) {
                // Select unique juice for this day and category
                selected = availableJuices[dayIndex % availableJuices.length];
                weeklyJuiceTracker[categoria].add(selected.receita_id_legado);
              } else {
                // If all juices used, reset and pick from available
                const resetAvailable = categoryRecipes.filter(r => !receitasUsadas.has(r.receita_id_legado));
                if (resetAvailable.length > 0) {
                  selected = resetAvailable[dayIndex % resetAvailable.length];
                  weeklyJuiceTracker[categoria].clear();
                  weeklyJuiceTracker[categoria].add(selected.receita_id_legado);
                }
              }
            } else {
              // Normal logic for other categories
              const available = categoryRecipes.filter(r => !receitasUsadas.has(r.receita_id_legado));
              if (available.length > 0) {
                selected = available[dayIndex % available.length];
              }
            }
            
            if (selected) {
              // Calculate real cost based on market prices
              const realCost = await calculateRecipeRealCost(selected.receita_id_legado);
              const maxCost = categoria === 'Sobremesa' ? custoMaximoPorRefeicao * 0.15 : 
                            categoria.includes('Suco') ? custoMaximoPorRefeicao * 0.20 :
                            custoMaximoPorRefeicao * 0.25;
              const cost = realCost > 0 ? realCost : Math.min(selected.custo_total || 1.5, maxCost);
              
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
          } else if (categoria === 'PP2' && newMenuStructure.PP1.length > 0) {
            // Fallback: use a different PP1 recipe as PP2 if available
            const pp1Available = newMenuStructure.PP1.filter(r => !receitasUsadas.has(r.receita_id_legado));
            if (pp1Available.length > 0) {
              const selectedPP2 = pp1Available[(dayIndex + 1) % pp1Available.length];
              const realCost = await calculateRecipeRealCost(selectedPP2.receita_id_legado);
              const cost = realCost > 0 ? realCost : (selectedPP2.custo_total || 3.5);
              
              receitasCardapio.push({
                id: `${selectedPP2.receita_id_legado}-pp2`,
                name: `${selectedPP2.nome_receita} (Variação)`,
                category: 'PP2',
                day,
                cost,
                servings: selectedPP2.porcoes || 50,
                ingredients: [],
                nutritionalInfo: {}
              });
            }
          }
        }
      }

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