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

  // Fallback function to create a basic menu from available products
  const createFallbackMenu = (
    marketProducts: any[],
    clientInfo: any,
    weekPeriod: string
  ): any[] => {
    console.log('Creating fallback menu with', marketProducts.length, 'products');
    
    // Organize products by category
    const carnes = marketProducts.filter(p => p.categoria_descricao === 'Carnes');
    const hortifruti = marketProducts.filter(p => p.categoria_descricao === 'Hortifruti');
    const generos = marketProducts.filter(p => p.categoria_descricao === 'Gêneros');
    const frios = marketProducts.filter(p => p.categoria_descricao === 'Frios');
    
    const recipes: any[] = [];
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    const targetCostPerMeal = clientInfo?.custo_maximo_refeicao || 3.5;
    
    days.forEach((day, dayIndex) => {
      // Create 4 recipes per day: PP1 (protein), SALADA 1 (vegetable), GUARNICAO 1 (carb), SOBREMESA 1 (fruit)
      
      // PP1 - Proteína Principal usando Carnes
      if (carnes.length > 0) {
        const protein = carnes[dayIndex % carnes.length];
        recipes.push({
          id: `fallback_pp1_${dayIndex}`,
          name: `${protein.descricao} grelhada`,
          category: 'PP1',
          day: day,
          servings: 1,
          cost: Math.min(protein.preco || 1.5, targetCostPerMeal * 0.4),
          ingredients: [
            {
              name: protein.descricao,
              quantity: protein.per_capita || 150,
              unit: protein.unidade || 'g',
              cost: protein.preco || 1.5
            }
          ],
          nutritional_info: {
            calories: 200,
            protein: 25,
            carbs: 2,
            fat: 8
          }
        });
      }
      
      // SALADA 1 - Salada usando Hortifruti
      if (hortifruti.length > 0) {
        const vegetable = hortifruti[dayIndex % hortifruti.length];
        recipes.push({
          id: `fallback_salada_${dayIndex}`,
          name: `Salada de ${vegetable.descricao}`,
          category: 'SALADA 1',
          day: day,
          servings: 1,
          cost: Math.min(vegetable.preco || 0.8, targetCostPerMeal * 0.2),
          ingredients: [
            {
              name: vegetable.descricao,
              quantity: vegetable.per_capita || 80,
              unit: vegetable.unidade || 'g',
              cost: vegetable.preco || 0.8
            }
          ],
          nutritional_info: {
            calories: 50,
            protein: 2,
            carbs: 10,
            fat: 1
          }
        });
      }
      
      // GUARNICAO 1 - Acompanhamento usando Gêneros
      if (generos.length > 0) {
        const carb = generos[dayIndex % generos.length];
        recipes.push({
          id: `fallback_guarnicao_${dayIndex}`,
          name: `${carb.descricao} refogado`,
          category: 'GUARNICAO 1',
          day: day,
          servings: 1,
          cost: Math.min(carb.preco || 0.6, targetCostPerMeal * 0.25),
          ingredients: [
            {
              name: carb.descricao,
              quantity: carb.per_capita || 100,
              unit: carb.unidade || 'g',
              cost: carb.preco || 0.6
            }
          ],
          nutritional_info: {
            calories: 150,
            protein: 4,
            carbs: 30,
            fat: 2
          }
        });
      }
      
      // SOBREMESA 1 - Sobremesa usando Frios ou Hortifruti
      const dessertProducts = frios.length > 0 ? frios : hortifruti;
      if (dessertProducts.length > 0) {
        const dessert = dessertProducts[dayIndex % dessertProducts.length];
        recipes.push({
          id: `fallback_sobremesa_${dayIndex}`,
          name: `${dessert.descricao} natural`,
          category: 'SOBREMESA 1',
          day: day,
          servings: 1,
          cost: Math.min(dessert.preco || 0.5, targetCostPerMeal * 0.15),
          ingredients: [
            {
              name: dessert.descricao,
              quantity: dessert.per_capita || 60,
              unit: dessert.unidade || 'g',
              cost: dessert.preco || 0.5
            }
          ],
          nutritional_info: {
            calories: 80,
            protein: 1,
            carbs: 18,
            fat: 1
          }
        });
      }
    });
    
    console.log(`Fallback menu created with ${recipes.length} recipes`);
    return recipes;
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

      console.log('Generating menu using direct recipe selection for client:', clientToUse.nome_fantasia);

      // Buscar receitas disponíveis por categoria
      const { data: receitasData, error: receitasError } = await supabase
        .from('receitas_legado')
        .select(`
          receita_id_legado,
          nome_receita,
          categoria_descricao,
          custo_total,
          porcoes,
          tempo_preparo,
          inativa
        `)
        .eq('inativa', false)
        .in('categoria_descricao', [
          'Prato Principal 1',
          'Guarnição', 
          'Salada',
          'Sobremesa'
        ]);

      if (receitasError) {
        throw new Error(`Erro ao buscar receitas: ${receitasError.message}`);
      }

      // Organizar receitas por categoria
      const receitasPorCategoria = {
        'Prato Principal 1': receitasData?.filter(r => r.categoria_descricao === 'Prato Principal 1') || [],
        'Guarnição': receitasData?.filter(r => r.categoria_descricao === 'Guarnição') || [],
        'Salada': receitasData?.filter(r => r.categoria_descricao === 'Salada') || [],
        'Sobremesa': receitasData?.filter(r => r.categoria_descricao === 'Sobremesa') || []
      };

      console.log('Receitas disponíveis por categoria:', Object.keys(receitasPorCategoria).map(cat => 
        `${cat}: ${receitasPorCategoria[cat].length} receitas`
      ));

      // Gerar cardápio da semana
      const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
      const receitasCardapio: MenuRecipe[] = [];
      const receitasUsadas = new Set<string>();

      // Custo máximo por refeição do cliente
      const custoMaximoPorRefeicao = clientToUse.custo_medio_diario || 7.30;

      days.forEach((day, dayIndex) => {
        // Selecionar uma receita de cada categoria para o dia
        Object.entries(receitasPorCategoria).forEach(([categoria, receitas]) => {
          if (receitas.length === 0) return;

          // Filtrar receitas não usadas ou permitir repetição se necessário
          const receitasDisponiveis = receitas.filter(r => 
            !receitasUsadas.has(r.receita_id_legado) || receitasUsadas.size >= receitas.length
          );

          if (receitasDisponiveis.length === 0) return;

          // Selecionar receita baseada no índice do dia para variedade
          const receitaIndex = dayIndex % receitasDisponiveis.length;
          const receitaSelecionada = receitasDisponiveis[receitaIndex];

          // Calcular custo estimado (usar custo_total ou valor padrão)
          let custoEstimado = receitaSelecionada.custo_total || 0;
          if (custoEstimado === 0) {
            // Estimar custo baseado na categoria
            const custosDefault = {
              'Prato Principal 1': custoMaximoPorRefeicao * 0.45,
              'Guarnição': custoMaximoPorRefeicao * 0.25,
              'Salada': custoMaximoPorRefeicao * 0.15,
              'Sobremesa': custoMaximoPorRefeicao * 0.15
            };
            custoEstimado = custosDefault[categoria] || 2.0;
          }

          receitasCardapio.push({
            id: receitaSelecionada.receita_id_legado,
            name: receitaSelecionada.nome_receita,
            category: categoria,
            day: day,
            cost: custoEstimado,
            servings: receitaSelecionada.porcoes || 50,
            ingredients: [],
            nutritionalInfo: {}
          });

          // Marcar como usada
          receitasUsadas.add(receitaSelecionada.receita_id_legado);
        });
      });

      console.log(`Cardápio gerado com ${receitasCardapio.length} receitas`);

      const totalCost = receitasCardapio.reduce((sum, recipe) => sum + recipe.cost, 0);
      const costPerMeal = receitasCardapio.length > 0 ? totalCost / days.length : 0; // Custo por dia

      const menu: GeneratedMenu = {
        id: `menu_${Date.now()}`,
        clientId: clientToUse.id,
        clientName: clientToUse.nome_fantasia,
        weekPeriod,
        status: 'pending_approval',
        totalCost,
        costPerMeal,
        totalRecipes: receitasCardapio.length,
        recipes: receitasCardapio,
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

      console.log('Buscando ingredientes das receitas do cardápio...');

      // Buscar ingredientes das receitas selecionadas
      const receitaIds = menu.recipes.map(r => r.id);
      const { data: ingredientesData, error: ingredientesError } = await supabase
        .from('receita_ingredientes')
        .select(`
          receita_id_legado,
          nome,
          quantidade,
          unidade,
          produto_base_id,
          notas
        `)
        .in('receita_id_legado', receitaIds);

      if (ingredientesError) {
        throw new Error(`Erro ao buscar ingredientes: ${ingredientesError.message}`);
      }

      console.log(`Encontrados ${ingredientesData?.length || 0} ingredientes`);

      // Processar ingredientes para criar itens do cardápio  
      const menuItems = menu.recipes.map(recipe => {
        const ingredientesReceita = ingredientesData?.filter(ing => 
          ing.receita_id_legado === recipe.id
        ) || [];

        return {
          receita_id: recipe.id,
          name: recipe.name,
          category: recipe.category,
          cost: recipe.cost,
          servings: recipe.servings,
          ingredients: ingredientesReceita.map(ing => ({
            name: ing.nome || 'Ingrediente sem nome',
            quantity: ing.quantidade || 0,
            unit: ing.unidade || 'un',
            produto_base_id: ing.produto_base_id,
            notes: ing.notas
          }))
        };
      });

      console.log('Chamando função de geração de lista de compras...');

      const { data: shoppingResponse, error: shoppingError } = await supabase.functions.invoke('generate-shopping-list', {
        body: {
          menuId: menu.id,
          clientName: selectedClient.nome_fantasia,
          budgetPredicted: menu.totalCost,
          menuItems: menuItems,
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

      console.log('Lista de compras gerada com sucesso:', shoppingResponse);

      toast({
        title: "Lista de Compras Gerada",
        description: `Lista criada com ${shoppingResponse.shoppingList?.items?.length || 0} itens`,
        variant: "default"
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar lista de compras';
      console.error('Erro na geração de lista de compras:', err);
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
    generateMenuWithFormData,
    approveMenu,
    rejectMenu,
    generateShoppingListFromMenu,
    clearGeneratedMenu,
    loadSavedMenus,
    selectedClient
  };
};