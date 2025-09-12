import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useMenuBusinessRules } from './useMenuBusinessRules';
import { useMarketAvailability } from './useMarketAvailability';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function useIntegratedMenuGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState(null);
  const [savedMenus, setSavedMenus] = useState([]);
  const [error, setError] = useState(null);
  const { selectedClient } = useSelectedClient();
  const { toast } = useToast();
  const { validateMenu, filterRecipesForDay, violations } = useMenuBusinessRules();
  const { viableRecipes, marketIngredients } = useMarketAvailability();

  // Função gerarSemanas
  const gerarSemanas = (inicio, fim, incluirFDS = false) => {
    const semanas = {};
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

  // Função toDayKey
  const toDayKey = (day) => {
    const dayMap = {
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

    const normalized = day?.toLowerCase().trim();
    return dayMap[normalized] || day;
  };

  // Função mapCategoryToMenuStructure
  const mapCategoryToMenuStructure = (category) => {
    const categoryMap = {
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
    if (categoryMap[normalizedCategory]) return categoryMap[normalizedCategory];

    if (normalizedCategory.includes('prato') || normalizedCategory.includes('principal') || normalizedCategory.includes('proteina')) return 'PP1';
    if (normalizedCategory.includes('salada') || normalizedCategory.includes('verdura') || normalizedCategory.includes('folha')) return 'Salada';
    if (normalizedCategory.includes('guarnicao') || normalizedCategory.includes('guarnição') || normalizedCategory.includes('acompanhamento')) return 'Guarnição';
    if (normalizedCategory.includes('suco') || normalizedCategory.includes('bebida')) return 'Suco';
    if (normalizedCategory.includes('arroz')) return 'Arroz';
    if (normalizedCategory.includes('feijao') || normalizedCategory.includes('feijão')) return 'Feijão';
    if (normalizedCategory.includes('sobremesa') || normalizedCategory.includes('doce')) return 'Sobremesa';

    return category || 'PP1';
  };

  // Função categorizeSalad
  const categorizeSalad = (recipeName, index) => {
    const name = recipeName.toLowerCase();
    if (name.includes('alface') || name.includes('rúcula') || name.includes('agrião') || name.includes('espinafre') || name.includes('folhas') || index % 2 === 0) {
      return 'Salada 1';
    }
    return 'Salada 2';
  };

  // Função categorizeJuice
  const categorizeJuice = (recipeName, index) => {
    const name = recipeName.toLowerCase();
    if (name.includes('laranja') || name.includes('limão') || name.includes('maracujá') || name.includes('caju') || name.includes('acerola') || name.includes('abacaxi')) {
      return 'Suco 1';
    }
    return 'Suco 2';
  };

  // Aqui você deve declarar todas as funções que são retornadas no final do hook:

  const approveMenu = async (menuId, approverName) => {
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
    } catch (error) {
      toast({ title: "Erro ao aprovar cardápio", description: error.message || 'Erro desconhecido', variant: "destructive" });
      return false;
    }
  };

  const rejectMenu = async (menuId, reason) => {
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
    } catch (error) {
      toast({ title: "Erro ao rejeitar cardápio", description: error.message || 'Erro desconhecido', variant: "destructive" });
      return false;
    }
  };

  const generateShoppingListFromMenu = async (menu) => {
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
    } catch (error) {
      toast({ title: "Erro ao gerar lista de compras", description: error.message || 'Erro desconhecido', variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearGeneratedMenu = () => {
    setGeneratedMenu(null);
    localStorage.removeItem('current-generated-menu');
  };

  const clearMenuExplicitly = () => {
    setGeneratedMenu(null);
    localStorage.removeItem('current-generated-menu');
    setError(null);
  };

  const mapRecipesToMarketProducts = (recipes) => {
    try {
      const marketProducts = [];
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

  // Outras funções como generateMenuWithFormData, generateMenu, loadSavedMenus, saveMenuToDatabase, deleteGeneratedMenu
  // devem estar declaradas aqui também (como no seu código original)

  // Retorno do hook
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
    validateMenuAndSetViolations: (recipes) => validateMenu(recipes),
    viableRecipes,
    marketIngredients
  };
}