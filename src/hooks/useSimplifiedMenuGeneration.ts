/**
 * Simplified hook for menu generation with local calculations
 */

import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { useSelectedClient } from '../contexts/SelectedClientContext';
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
  const { validateMenu, violations } = useMenuBusinessRules();
  const { toast } = useToast();

  const generateSimpleRecipes = async (clientData: any, mealQuantity: number) => {
    console.log('🔍 Frontend DEBUG - Client data:', {
      selectedClient,
      clientData,
      clientId: clientData?.id || clientData?.cliente_id_legado,
      filialId: clientData?.filial_id
    });

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
      // Prepare receitas_adaptadas format for shopping list compatibility
      const receitasAdaptadas = menu.recipes?.map(recipe => ({
        receita_id_legado: recipe.id,
        nome: recipe.name,
        categoria: recipe.category,
        custo_por_porcao: recipe.cost || 0,
        porcoes_calculadas: menu.mealsPerDay || 50
      })) || [];

      // Prepare receitas_ids as backup fallback
      const receitasIds = menu.recipes?.map(recipe => recipe.id).filter(Boolean) || [];

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
          receitas_adaptadas: receitasAdaptadas,
          receitas_ids: receitasIds,
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

      // CORREÇÃO: Usar quick-worker - Nova Edge Function otimizada
      const { data: response, error: menuError } = await supabase.functions.invoke('quick-worker', {
        body: {
          action: 'generate_validated_menu',
          dias: periodDays,
          meal_quantity: mealQuantity,
          proteina_gramas: proteinGrams || '100',
          incluir_fim_semana: periodDays === 7,
          incluir_arroz_integral: false,
          max_tentativas: 10,
          tipo_suco_primario: 'PRO_MIX',
          tipo_suco_secundario: null,
          variar_sucos_por_dia: true,
          // Dados de contexto para auditoria
          client_id: clientToUse.id,
          clientId: clientToUse.cliente_id_legado,
          filial_id: clientToUse.filial_id,
          budgetPerMeal: budgetPerMeal || clientToUse.custo_maximo_refeicao,
          client_data: clientToUse
        }
      });

      if (menuError) {
        throw new Error(`Erro na geração: ${menuError.message}`);
      }

      console.log('🔍 DEBUG: Response completo da Edge Function:', response);
      console.log('🔍 DEBUG: response.success:', response?.success);
      console.log('🔍 DEBUG: response.cardapio:', response?.cardapio);
      console.log('🔍 DEBUG: response.data:', response?.data);
      console.log('🔍 DEBUG: Todas as propriedades da response:', Object.keys(response || {}));

      if (!response?.success) {
        throw new Error(response?.error || 'Falha na geração do cardápio');
      }

      // CORREÇÃO: Ajustar para nova estrutura do quick-worker
      const cardapioValidado = response?.cardapio_semanal || response?.data?.cardapio_semanal || response?.result || response;
      console.log('✅ Cardápio Validado recebido (quick-worker):', {
        responseKeys: Object.keys(response || {}),
        cardapioValidado,
        diasArray: cardapioValidado?.dias?.length || 0,
        estruturaCompleta: cardapioValidado ? Object.keys(cardapioValidado) : [],
        primeiroItem: cardapioValidado?.dias?.[0] || null,
        responseComplete: response
      });

      // === Nova estrutura do quick-worker: cardapio_dias com receitas_validadas
      const allRecipesRaw: any[] = [];
      
      // Verificar se tem cardapio_dias (nova estrutura)
      if (response?.cardapio_dias?.length) {
        response.cardapio_dias.forEach((dia: any) => {
          if (dia?.receitas_validadas?.length) {
            dia.receitas_validadas.forEach((receita: any) => {
              allRecipesRaw.push({
                ...receita,
                dia: dia.data || dia.dia_semana || 'Dia Único'
              });
            });
          }
        });
      }
      // Fallback: estrutura anterior com dias.receitas
      else if (cardapioValidado?.dias?.length) {
        cardapioValidado.dias.forEach((dia: any) => {
          dia?.receitas?.forEach((receita: any) => {
            allRecipesRaw.push({
              ...receita,
              dia: dia.dia
            });
          });
        });
      }
      // Fallback: receitas diretas
      else if (Array.isArray(response?.recipes) && response.recipes.length > 0) {
        response.recipes.forEach((r: any) => {
          allRecipesRaw.push({
            ...r,
            dia: r.dia || r.day || 'Dia Único'
          });
        });
      }

      console.log('📊 Receitas encontradas (quick-worker):', {
        total: allRecipesRaw.length,
        porDia: cardapioValidado?.dias?.map((d: any) => `${d.dia}: ${d.receitas?.length || 0}`).join(', '),
        estruturaDias: cardapioValidado?.dias?.length ? 'OK' : 'FALHOU'
      });

      // === Categorias para UI
      const WEEK_DAYS = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];

      const mapCategory = (nome: string = '', categoria: string = ''): string => {
        const lowerNome = nome.toLowerCase();
        const lowerCat = categoria.toLowerCase();

        if (lowerNome.includes('arroz')) return 'Arroz Branco';
        if (lowerNome.includes('feij')) return 'Feijão';
        if (lowerNome.includes('guarni') || lowerCat.includes('guarni')) return 'Guarnição';
        if (lowerNome.includes('salada 2') || lowerCat.includes('salada 2')) return 'Salada 2';
        if (lowerNome.includes('salada')) return 'Salada 1';
        if (lowerNome.includes('suco 2') || lowerCat.includes('suco 2')) return 'Suco 2';
        if (lowerNome.includes('suco')) return 'Suco 1';
        if (lowerNome.includes('sobremesa') || lowerCat.includes('sobremesa')) return 'Sobremesa';
        if (lowerCat.includes('principal 1') || lowerCat.includes('pp1')) return 'PP1';
        if (lowerCat.includes('principal 2') || lowerCat.includes('pp2')) return 'PP2';

        return categoria || 'Outros';
      };

      // === Normalização de receitas
      const allRecipes = allRecipesRaw.map((r: any, idx: number) => {
        const custo = Number(r.cost ?? 0);
        const warnings: string[] = [];

        // Verificar se é receita de fallback (sem ingredientes)
        if (r.warning) {
          warnings.push(r.warning);
        }

        if (custo > (budgetPerMeal || clientToUse.custo_maximo_refeicao) * 5) {
          warnings.push(`⚠️ Custo fora da realidade: R$ ${custo.toFixed(2)}/porção`);
        }

        const categoriaUI = r.category || 'Outros';
        const codigo = (() => {
          const key = (categoriaUI || '').toUpperCase();
          if (key.includes('PRINCIPAL 1')) return 'PP1';
          if (key.includes('PRINCIPAL 2')) return 'PP2';
          if (key.includes('ARROZ')) return 'ARROZ';
          if (key.includes('FEIJ')) return 'FEIJAO';
          if (key.includes('SALADA 1')) return 'SALADA1';
          if (key.includes('SALADA 2')) return 'SALADA2';
          if (key.includes('SUCO 1')) return 'SUCO1';
          if (key.includes('SUCO 2')) return 'SUCO2';
          return undefined;
        })();

        return {
          id: r.id || idx,
          name: r.name || 'Item',
          category: categoriaUI,
          codigo,
          cost: custo,
          warnings,
          day: r.dia || r.day || 'Dia Único',
        };
      });

      if (!allRecipes.length) {
        throw new Error("Nenhuma receita foi incluída no cardápio");
      }

      // === Validação contra regras de negócio
      const businessRules = validateMenu(allRecipes);

      // === Calcular custos totais das receitas geradas
      const totalRecipeCost = allRecipes.reduce((sum, recipe) => sum + (recipe.cost || 0), 0);
      const actualPeriodDays = Array.from(new Set(allRecipes.map(r => r.day))).length || periodDays;
      const calculatedCostPerMeal = totalRecipeCost / actualPeriodDays;
      const calculatedTotalCost = calculatedCostPerMeal * (mealQuantity || 1) * actualPeriodDays;

      // === Resultado final
      const menu: GeneratedMenu = {
        id: crypto.randomUUID(),
        clientId: clientToUse.id || clientToUse.cliente_id_legado,
        clientName: clientToUse.nome_fantasia || clientToUse.nome_empresa,
        weekPeriod,
        status: 'pending_approval',
        totalCost: calculatedTotalCost,
        costPerMeal: calculatedCostPerMeal,
        totalRecipes: allRecipes.length,
        mealsPerDay: mealQuantity,
        recipes: allRecipes,
        createdAt: new Date().toISOString(),
        menu: cardapioValidado,
        warnings: [
          ...allRecipes.flatMap(r => r.warnings || [])
        ],
        juiceMenu: undefined
      };

      // === Salvar no banco
      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        menu.id = savedId;
        setGeneratedMenu(menu);

        toast({
          title: "Cardápio Gerado com Receitas Validadas!",
          description: `${allRecipes.length} receitas com ingredientes. Custo: R$ ${(menu.totalCost || 0).toFixed(2)} total`,
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
    progress: null,
    generateMenu,
    clearGeneratedMenu: () => setGeneratedMenu(null),
    clearError: () => setError(null)
  };
}