/**
 * Unified hook for integrated menu generation with local calculations and AI support
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useMenuBusinessRules } from './useMenuBusinessRules';
import { useMarketAvailability } from './useMarketAvailability';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface SimpleMenuFormData {
  clientId: string;
  period: {
    start: string;
    end: string;
  };
  mealsPerDay: number;
  estimatedMeals?: number;
  restrictions?: string[];
  preferences?: string[];
  diasUteis?: boolean;
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
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  menu?: any;
  warnings?: string[];
  juiceMenu?: any;
}

export interface MenuRecipe {
  id: string;
  name: string;
  category: string;
  cost: number;
  servings: number;
  day?: string;
  ingredients?: any[];
}

// Retry utility
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
  }
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === options.maxRetries) {
        break;
      }

      const delay = Math.min(
        options.initialDelay * Math.pow(options.backoffFactor, attempt),
        options.maxDelay
      );

      console.log(`Tentativa ${attempt + 1} falhou, tentando novamente em ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Erro desconhecido na operação com retry');
}

export function useIntegratedMenuGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState<GeneratedMenu | null>(null);
  const [savedMenus, setSavedMenus] = useState<GeneratedMenu[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { selectedClient } = useSelectedClient();
  const { toast } = useToast();
  const { validateMenu, filterRecipesForDay, violations, viableRecipes } = useMenuBusinessRules();
  const { marketIngredients } = useMarketAvailability();

  // Persistência local do menu
  useEffect(() => {
    const stored = localStorage.getItem('current-generated-menu');
    if (stored) {
      try {
        const menu = JSON.parse(stored);
        if (menu.clientId === selectedClient?.id) {
          setGeneratedMenu(menu);
        } else {
          localStorage.removeItem('current-generated-menu');
        }
      } catch {
        localStorage.removeItem('current-generated-menu');
      }
    }
  }, [selectedClient?.id]);

  useEffect(() => {
    if (generatedMenu) {
      localStorage.setItem('current-generated-menu', JSON.stringify(generatedMenu));
    } else {
      localStorage.removeItem('current-generated-menu');
    }
  }, [generatedMenu]);

  // Limpar menu se cliente mudar
  useEffect(() => {
    setGeneratedMenu(null);
    localStorage.removeItem('current-generated-menu');
  }, [selectedClient?.id]);

  // Funções auxiliares

  const gerarSemanas = (inicio: Date, fim: Date, incluirFDS = false) => {
    const semanas: { [key: string]: any[] } = {};
    let currentDate = new Date(inicio);

    while (currentDate <= fim) {
      const weekKey = `semana-${format(currentDate, 'yyyy-MM-dd')}`;
      if (!semanas[weekKey]) semanas[weekKey] = [];

      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (!isWeekend || incluirFDS) {
        semanas[weekKey].push({
          dia: format(currentDate, 'EEEE', { locale: ptBR }),
          data: format(currentDate, 'dd/MM/yyyy')
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return semanas;
  };

  const toDayKey = (day: unknown): string => {
    if (typeof day !== 'string') return '';
    const dayMap: Record<string, string> = {
      'segunda': 'Segunda-feira',
      'segunda-feira': 'Segunda-feira',
      'monday': 'Segunda-feira',
      'seg': 'Segunda-feira',
      'terça': 'Terça-feira',
      'terca': 'Terça-feira',
      'terça-feira': 'Terça-feira',
      'terca-feira': 'Terça-feira',
      'tuesday': 'Terça-feira',
      'ter': 'Terça-feira',
      'quarta': 'Quarta-feira',
      'quarta-feira': 'Quarta-feira',
      'wednesday': 'Quarta-feira',
      'qua': 'Quarta-feira',
      'quinta': 'Quinta-feira',
      'quinta-feira': 'Quinta-feira',
      'thursday': 'Quinta-feira',
      'qui': 'Quinta-feira',
      'sexta': 'Sexta-feira',
      'sexta-feira': 'Sexta-feira',
      'friday': 'Sexta-feira',
      'sex': 'Sexta-feira'
    };
    return dayMap[day.toLowerCase().trim()] || day;
  };

  const mapCategoryToMenuStructure = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'prato_principal': 'PP1',
      'proteina': 'PP1',
      'principal': 'PP1',
      'prato principal': 'PP1',
      'pp1': 'PP1',
      'salada': 'Salada',
      'verdura': 'Salada',
      'verduras': 'Salada',
      'folha': 'Salada',
      'folhas': 'Salada',
      'guarnicao': 'Guarnição',
      'guarnição': 'Guarnição',
      'acompanhamento': 'Guarnição',
      'suco': 'Suco',
      'bebida': 'Suco',
      'refresco': 'Suco',
      'arroz': 'Arroz',
      'rice': 'Arroz',
      'feijao': 'Feijão',
      'feijão': 'Feijão',
      'beans': 'Feijão',
      'sobremesa': 'Sobremesa',
      'doce': 'Sobremesa',
      'dessert': 'Sobremesa'
    };

    const normalizedCategory = category?.toLowerCase().trim();
    if (normalizedCategory && categoryMap[normalizedCategory]) return categoryMap[normalizedCategory];

    if (normalizedCategory?.includes('prato') || normalizedCategory?.includes('principal') || normalizedCategory?.includes('proteina')) return 'PP1';
    if (normalizedCategory?.includes('salada') || normalizedCategory?.includes('verdura') || normalizedCategory?.includes('folha')) return 'Salada';
    if (normalizedCategory?.includes('guarnicao') || normalizedCategory?.includes('guarnição') || normalizedCategory?.includes('acompanhamento')) return 'Guarnição';
    if (normalizedCategory?.includes('suco') || normalizedCategory?.includes('bebida')) return 'Suco';
    if (normalizedCategory?.includes('arroz')) return 'Arroz';
    if (normalizedCategory?.includes('feijao') || normalizedCategory?.includes('feijão')) return 'Feijão';
    if (normalizedCategory?.includes('sobremesa') || normalizedCategory?.includes('doce')) return 'Sobremesa';

    return category || 'PP1';
  };

  const categorizeSalad = (recipeName: string, index: number): string => {
    const name = recipeName.toLowerCase();
    if (name.includes('alface') || name.includes('rúcula') || name.includes('agrião') || name.includes('espinafre') || name.includes('folhas') || index % 2 === 0) {
      return 'Salada 1';
    }
    return 'Salada 2';
  };

  const categorizeJuice = (recipeName: string, index: number): string => {
    const name = recipeName.toLowerCase();
    if (name.includes('laranja') || name.includes('limão') || name.includes('maracujá') || name.includes('caju') || name.includes('acerola') || name.includes('abacaxi')) {
      return 'Suco 1';
    }
    return 'Suco 2';
  };

  // Carregar cardápios salvos
  const loadSavedMenus = async () => {
    try {
      const { data: menus, error } = await supabase
        .from('generated_menus')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedMenus: GeneratedMenu[] = (menus as any[]).map(menu => ({
        id: menu.id,
        clientId: menu.client_id,
        clientName: menu.client_name,
        weekPeriod: menu.week_period,
        status: menu.status || 'pending_approval',
        totalCost: Number(menu.total_cost) || 0,
        costPerMeal: Number(menu.cost_per_meal) || 0,
        totalRecipes: Number(menu.total_recipes) || 0,
        recipes: menu.receitas_adaptadas || [],
        createdAt: menu.created_at,
        approvedBy: menu.approved_by,
        rejectedReason: menu.rejected_reason
      }));

      setSavedMenus(formattedMenus);
    } catch (error) {
      console.error('Erro ao carregar cardápios salvos:', error);
    }
  };

  // Salvar cardápio no banco
  const saveMenuToDatabase = async (menu: GeneratedMenu): Promise<string | null> => {
    try {
      const { data: savedMenu, error: menuError } = await supabase
        .from('generated_menus')
        .insert({
          client_id: menu.clientId,
          client_name: menu.clientName,
          week_period: menu.weekPeriod,
          status: menu.status,
          total_cost: menu.totalCost,
          cost_per_meal: menu.costPerMeal,
          total_recipes: menu.totalRecipes
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

      setSavedMenus(prev => prev.filter(menu => menu.id !== menuId));

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

  // Função para aprovação do cardápio
  const approveMenu = async (menuId: string, approverName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('generated_menus')
        .update({ status: 'approved', approved_by: approverName })
        .eq('id', menuId);

      if (error) throw error;

      if (generatedMenu?.id === menuId) {
        setGeneratedMenu({ ...generatedMenu, status: 'approved', approvedBy: approverName, approvedAt: new Date().toISOString() });
      }

      await loadSavedMenus();

      toast({ title: "Cardápio aprovado!", description: `Cardápio aprovado por ${approverName}`, variant: "default" });
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao aprovar cardápio", description: error.message || 'Erro desconhecido', variant: "destructive" });
      return false;
    }
  };

  // Função para rejeição do cardápio
  const rejectMenu = async (menuId: string, reason: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('generated_menus')
        .update({ status: 'rejected', rejected_reason: reason })
        .eq('id', menuId);

      if (error) throw error;

      if (generatedMenu?.id === menuId) {
        setGeneratedMenu({ ...generatedMenu, status: 'rejected', rejectedReason: reason });
      }

      await loadSavedMenus();

      toast({ title: "Cardápio rejeitado", description: `Motivo: ${reason}`, variant: "destructive" });
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao rejeitar cardápio", description: error.message || 'Erro desconhecido', variant: "destructive" });
      return false;
    }
  };

  // Função para gerar lista de compras a partir do cardápio
  const generateShoppingListFromMenu = async (menu: GeneratedMenu) => {
    try {
      setIsGenerating(true);
      const { data, error } = await supabase.functions.invoke('generate-shopping-list', {
        body: {
          menuId: menu.id,
          clientName: menu.clientName,
          budgetPredicted: menu.totalCost,
          servingsPerDay: menu.recipes?.[0]?.servings || 50,
          totalServingsWeek: (menu.recipes?.[0]?.servings || 50) * 5,
          servingsByRecipe: Object.fromEntries(menu.recipes.map(r => [r.id, r.servings])),
          menuItems: menu.recipes.map(recipe => ({
            receita_id: recipe.id,
            name: recipe.name,
            category: recipe.category,
            cost: recipe.cost,
            servings: recipe.servings,
            ingredients: recipe.ingredients || []
          }))
        }
      });
      if (error) throw error;

      toast({ title: "Lista de compras gerada!", description: "A lista de compras foi criada com base no cardápio aprovado", variant: "default" });
    } catch (error: any) {
      toast({ title: "Erro ao gerar lista de compras", description: error.message || 'Erro desconhecido', variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Função para limpar o cardápio gerado localmente
  const clearGeneratedMenu = () => {
    setGeneratedMenu(null);
    localStorage.removeItem('current-generated-menu');
  };

  // Função para limpar o cardápio e erros explicitamente
  const clearMenuExplicitly = () => {
    clearGeneratedMenu();
    setError(null);
  };

  // Função para mapear receitas para produtos do mercado
  const mapRecipesToMarketProducts = (recipes: MenuRecipe[]) => {
    try {
      const marketProducts: any[] = [];
      for (const recipe of recipes) {
        if (recipe.ingredients?.length > 0) {
          for (const ingredient of recipe.ingredients) {
            if (ingredient.produto_base_id) {
              const marketProduct = marketIngredients.find(mp => mp.produto_base_id === ingredient.produto_base_id);
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

  // Geração do cardápio com dados do formulário
  const generateMenuWithFormData = async (
    formData: SimpleMenuFormData
  ): Promise<GeneratedMenu | null> => {
    if (isProcessing) {
      console.log('⚠️ Geração já em andamento, ignorando nova solicitação');
      return null;
    }

    setIsProcessing(true);
    setIsGenerating(true);
    setError(null);

    try {
      const clientToUse = selectedClient;
      if (!clientToUse) throw new Error('Nenhum cliente selecionado');

      // Resolver clientId robustamente
      const clientIdResolved =
        clientToUse?.id ||
        (clientToUse as any)?.filial_id ||
        (clientToUse as any)?.cliente_id_legado ||
        (clientToUse as any)?.client_id ||
        null;

      if (!clientIdResolved) throw new Error("Cliente não possui identificador válido");

      // Formatar período
      const startDate = parse(formData.period.start, 'yyyy-MM-dd', new Date());
      const endDate = parse(formData.period.end, 'yyyy-MM-dd', new Date());
      const weekPeriod = `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;

      // Montar payload para função Edge
      const payload = {
        action: 'generate_menu',
        client_id: clientIdResolved,
        filialIdLegado: (clientToUse as any).filial_id || clientIdResolved,
        client_data: {
          id: clientIdResolved,
          nome: (clientToUse as any).nome_empresa || (clientToUse as any).nome_fantasia || (clientToUse as any).nome,
          filial_id: (clientToUse as any).filial_id || clientIdResolved,
          custo_maximo_refeicao: (clientToUse as any).custo_maximo_refeicao || 15,
          restricoes_alimentares: formData.restrictions,
          preferencias_alimentares: formData.preferences
        },
        meal_quantity: formData.mealsPerDay,
        estimated_meals: formData.estimatedMeals,
        week_period: weekPeriod,
        dias_uteis: formData.diasUteis ?? true
      };

      // Invocar função Edge com retry
      const { data, error: functionError } = await withRetry(
        () => supabase.functions.invoke('gpt-assistant', { body: payload }),
        { maxRetries: 3, initialDelay: 1500, maxDelay: 10000, backoffFactor: 2 }
      );

      if (functionError) throw new Error(functionError.message || 'Erro ao gerar receitas');
      if (!data || !data.success) throw new Error(data?.error || 'Erro na geração das receitas');

      // Normalizar receitas
      let recipes = data.recipes || [];
      if (!recipes.length && data.cardapio) recipes = data.cardapio;
      if (!recipes.length && data.receitas_adaptadas) recipes = data.receitas_adaptadas;

      if (!recipes.length) throw new Error('IA não conseguiu gerar receitas');

      // Gerar semanas e organizar receitas por dia, aplicando regras de negócio
      const incluirFDS = !(formData.diasUteis ?? true);
      const semanas = gerarSemanas(startDate, endDate, incluirFDS);

      let receitasUsadasAnterior: any[] = [];

      for (const semanaKey in semanas) {
        semanas[semanaKey] = semanas[semanaKey].map((dia: any, dayIndex: number) => {
          const slotKey = toDayKey(dia.dia);

          const receitasDisponiveis = recipes.filter((r: any) => {
            const recipeDay = r.day || r.dia;
            return toDayKey(recipeDay) === slotKey;
          });

          const receitasFiltradas = filterRecipesForDay(
            receitasDisponiveis,
            dia.dia,
            dayIndex,
            receitasUsadasAnterior
          );

          const receitasDoDia = receitasFiltradas.map((r: any, idx: number) => {
            const nome = r.nome_receita || r.name || r.nome || 'Receita sem nome';
            const categoria = r.categoria_descricao || r.category || r.categoria || 'Outros';
            const custo = r.custo_adaptado || r.cost || r.custo_total || r.custo_por_refeicao || 0;

            let cat = mapCategoryToMenuStructure(categoria);
            if (cat === 'Salada') cat = categorizeSalad(nome, idx);
            if (cat === 'Suco') cat = categorizeJuice(nome, idx);

            return {
              id: r.receita_id_legado || r.id || `recipe-${idx}`,
              nome,
              categoria: cat,
              custo_total: custo,
              custo_por_refeicao: custo,
              dia: dia.dia,
              ingredients: r.ingredientes || r.ingredients || []
            };
          });

          receitasUsadasAnterior = receitasDoDia;

          const totalDia = receitasDoDia.reduce(
            (s, rr) => s + (rr.custo_por_refeicao || 0) * (formData.estimatedMeals || 50),
            0
          );

          return {
            ...dia,
            receitas: receitasDoDia,
            custo_total: totalDia
          };
        });
      }

      // Calcular custos totais e totais de receitas
      let custoTotal = 0;
      let totalReceitas = 0;

      for (const semanaKey in semanas) {
        for (const dia of semanas[semanaKey]) {
          custoTotal += dia.custo_total || 0;
          totalReceitas += dia.receitas?.length || 0;
        }
      }

      const totalDias = Object.values(semanas).reduce((total, diasSemana) => total + diasSemana.length, 0);

      const custoPorRefeicao =
        formData.estimatedMeals && formData.estimatedMeals > 0 && totalDias > 0
          ? custoTotal / (formData.estimatedMeals * totalDias)
          : 0;

      const allRecipes = Object.values(semanas).flat().flatMap((dia: any) => dia.receitas || []);
      const businessRules = validateMenu(allRecipes);

      const menu: GeneratedMenu = {
        id: crypto.randomUUID(),
        clientId: clientToUse.id,
        clientName: clientToUse.nome_fantasia,
        weekPeriod,
        status: 'pending_approval',
        totalCost: custoTotal,
        costPerMeal: custoPorRefeicao,
        totalRecipes: totalReceitas,
        recipes: allRecipes.map(r => ({
          id: r.id,
          name: r.nome,
          category: r.categoria,
          cost: r.custo_por_refeicao,
          servings: formData.estimatedMeals || 50,
          day: r.dia,
          ingredients: r.ingredients || []
        })),
        createdAt: new Date().toISOString(),
        menu: {
          calculated_locally: true,
          business_rules: businessRules,
          weeks: semanas
        },
        warnings: []
      };

      setGeneratedMenu(menu);

      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        menu.id = savedId;
        setGeneratedMenu(menu);

        toast({
          title: "Cardápio gerado!",
          description: `${menu.totalRecipes} receitas. Custo: R$ ${menu.costPerMeal.toFixed(2)}/refeição`,
        });

        await loadSavedMenus();
      }

      return menu;
    } catch (error: any) {
      console.error('❌ Erro na geração:', error);
      setError(error.message);
      toast({
        title: "❌ Erro na geração do cardápio",
        description: error.message || 'Erro desconhecido ao gerar cardápio',
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGenerating(false);
      setIsProcessing(false);
    }
  };

  // Wrapper para compatibilidade
  const generateMenu = async (
    weekPeriod: string,
    preferences?: string[],
    clientOverride?: any,
    mealsPerDay?: number,
    totalMeals?: number
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

    const [startDate, endDate] = weekPeriod.includes(' a ')
      ? weekPeriod.split(' a ')
      : [weekPeriod, weekPeriod];

    const formData: SimpleMenuFormData = {
      clientId: clientToUse.id || clientToUse.cliente_id_legado,
      period: {
        start: startDate.trim(),
        end: endDate.trim()
      },
      mealsPerDay: mealsPerDay || clientToUse.total_funcionarios || 100,
      estimatedMeals: totalMeals || ((mealsPerDay || clientToUse.total_funcionarios || 100) * 5),
      restrictions: clientToUse.restricoes_alimentares || [],
      preferences: preferences || [],
      diasUteis: clientToUse.dias_uteis ?? true
    };

    return generateMenuWithFormData(formData);
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
    clearMenuExplicitly,
    loadSavedMenus,
    deleteGeneratedMenu,
    mapRecipesToMarketProducts,
    violations,
    validateMenu,
    validateMenuAndSetViolations: (recipes: any[]) => validateMenu(recipes),
    viableRecipes,
    marketIngredients
  };
}

export type { GeneratedMenu, MenuRecipe, SimpleMenuFormData };