/**
 * Simplified hook for menu generation with local calculations
 */

import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { useSelectedClient } from '../contexts/SelectedClientContext';
import { useMenuBusinessRules } from './useMenuBusinessRules';
import { format, addDays } from 'date-fns';
import { mapCategory, MENU_CATEGORIES } from '../constants/menuCategories';

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

  const saveMenuToDatabase = async (menu: GeneratedMenu): Promise<string | null> => {
    try {
      const receitasAdaptadas = menu.recipes?.map(recipe => ({
        receita_id_legado: recipe.id,
        nome: recipe.name,
        categoria: recipe.category,
        custo_por_porcao: recipe.cost || 0,
        porcoes_calculadas: menu.mealsPerDay || 100
      })) || [];

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
          meals_per_day: menu.mealsPerDay || 100,
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

      console.log('Iniciando geração COM ORÇAMENTO...', {
        selectedClient: clientToUse?.id,
        mealQuantity,
        periodDays,
        budgetPerMeal,
        filial_id: clientToUse.filial_id,
        nome_fantasia: clientToUse.nome_fantasia
      });

      const weekPeriod = period || `${format(new Date(), 'dd/MM/yyyy')} - ${format(addDays(new Date(), periodDays - 1), 'dd/MM/yyyy')}`;

      const { data: response, error: menuError } = await supabase.functions.invoke('quick-worker', {
        body: {
          action: 'generate_validated_menu',
          dias: periodDays,
          meal_quantity: mealQuantity,
          incluir_fim_semana: periodDays === 7,
          incluir_arroz_integral: false,
          tipo_suco_primario: juiceConfig?.tipo_primario || 'NATURAL',
          tipo_suco_secundario: juiceConfig?.tipo_secundario || null,
          variar_sucos_por_dia: true,
          proteina_gramas: proteinGrams,
          filial_id: clientToUse.filial_id,
          nome_fantasia: clientToUse.nome_fantasia,
          orcamento_por_refeicao: budgetPerMeal || clientToUse.custo_maximo_refeicao,
          client_id: clientToUse.id,
          clientId: clientToUse.cliente_id_legado
        }
      });

      if (menuError) {
        throw new Error(`Erro na geração: ${menuError.message}`);
      }

      console.log('DEBUG: Response completo da Edge Function:', response);
      console.log('DEBUG: response.success:', response?.success);
      console.log('DEBUG: response.cardapio:', response?.cardapio);
      console.log('DEBUG: response.resumo:', response?.resumo);
      console.log('DEBUG: response.filial:', response?.filial);

      if (!response?.success) {
        throw new Error(response?.error || 'Falha na geração do cardápio');
      }

      // CORREÇÃO: Processar estrutura corrigida da Edge Function
      let cardapioValidado = null;
      let receitasValidas: any[] = [];
      
      // 1. ESTRUTURA CORRIGIDA: response.cardapio (array de dias)
      if (response?.cardapio && Array.isArray(response.cardapio)) {
        console.log('Processando estrutura cardapio da Edge Function corrigida');
        
        cardapioValidado = { 
          dias: response.cardapio.map(dia => ({
            dia: dia.dia,
            receitas: dia.receitas || [],
            custo_total: dia.custo_total,
            orcamento: dia.orcamento,
            dentro_orcamento: dia.dentro_orcamento,
            percentual_uso: dia.percentual_uso,
            economia: dia.economia
          })),
          resumo: response.resumo,
          filial: response.filial
        };
        
        response.cardapio.forEach(dia => {
          if (dia.receitas && Array.isArray(dia.receitas)) {
            dia.receitas.forEach(receita => {
              receitasValidas.push({
                ...receita,
                dia: dia.dia,
                custo: receita.custo || receita.cost
              });
            });
          }
        });
      }
      // 2. Fallback: estrutura anterior com cardapio_dias
      else if (response?.cardapio_dias && Array.isArray(response.cardapio_dias)) {
        cardapioValidado = { dias: response.cardapio_dias };
        response.cardapio_dias.forEach(dia => {
          if (dia.receitas_validadas) {
            receitasValidas.push(...dia.receitas_validadas);
          }
        });
      }
      // 3. Fallback: estrutura anterior com cardapio_semanal
      else if (response?.cardapio_semanal) {
        cardapioValidado = response.cardapio_semanal;
      }
      // 4. Fallback: dados diretos
      else if (response?.data) {
        cardapioValidado = response.data;
      }
      // 5. Último recurso: usar response inteiro
      else {
        cardapioValidado = response;
      }

      console.log('Estrutura Final Processada:', {
        cardapioValidado: cardapioValidado ? Object.keys(cardapioValidado) : [],
        receitasValidas: receitasValidas.length,
        dias: cardapioValidado?.dias?.length || 0,
        filial: cardapioValidado?.filial || response?.filial
      });

      // Extrair todas as receitas
      const allRecipesRaw: any[] = [];
      
      // Processar dias do cardápio validado
      if (cardapioValidado?.dias?.length) {
        cardapioValidado.dias.forEach((dia: any) => {
          const receitas = dia?.receitas || dia?.receitas_validadas || [];
          receitas.forEach((receita: any) => {
            allRecipesRaw.push({
              ...receita,
              dia: dia.dia || dia.dia_semana || dia.data || 'Dia Único',
              custo: receita.custo || receita.cost
            });
          });
        });
      }
      // Fallback: receitas diretas
      else if (Array.isArray(response?.recipes) && response.recipes.length > 0) {
        response.recipes.forEach((r: any) => {
          allRecipesRaw.push({
            ...r,
            dia: r.dia || r.day || 'Dia Único',
            custo: r.custo || r.cost
          });
        });
      }

      console.log('Receitas encontradas:', {
        total: allRecipesRaw.length,
        porDia: cardapioValidado?.dias?.map((d: any) => `${d.dia}: ${(d.receitas || d.receitas_validadas || []).length}`).join(', ')
      });

      // Normalização de receitas
      const allRecipes = allRecipesRaw.map((r: any, idx: number) => {
        const custo = Number(r.custo || r.cost || 0);
        const warnings: string[] = [];

        if (r.warning) {
          warnings.push(r.warning);
        }

        // Validar contra orçamento se fornecido
        const orcamentoMax = budgetPerMeal || clientToUse.custo_maximo_refeicao;
        if (orcamentoMax && custo > orcamentoMax * 5) {
          warnings.push(`Custo muito alto: R$ ${custo.toFixed(2)}/porção (orçamento: R$ ${orcamentoMax.toFixed(2)})`);
        }

        const categoriaOriginal = r.categoria || r.category || 'Outros';
        const categoriaUI = mapCategory(categoriaOriginal, r.codigo);
        
        const codigo = (() => {
          const key = categoriaUI.toUpperCase();
          if (key.includes('PRINCIPAL 1')) return 'PP1';
          if (key.includes('PRINCIPAL 2')) return 'PP2';
          if (key.includes('BASE')) return 'BASE';
          if (key.includes('GUARNIÇÃO')) return 'GUARNICAO';
          if (key.includes('SALADA 1')) return 'SALADA1';
          if (key.includes('SALADA 2')) return 'SALADA2';
          if (key.includes('SUCO 1')) return 'SUCO1';
          if (key.includes('SUCO 2')) return 'SUCO2';
          if (key.includes('SOBREMESA')) return 'SOBREMESA';
          return undefined;
        })();

        return {
          id: r.receita_id || r.id || idx,
          name: r.nome || r.name || 'Item',
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

      // Validação contra regras de negócio
      const businessRules = validateMenu(allRecipes);

      // Calcular custos totais
      const totalRecipeCost = allRecipes.reduce((sum, recipe) => sum + (recipe.cost || 0), 0);
      const actualPeriodDays = Array.from(new Set(allRecipes.map(r => r.day))).length || periodDays;
      const calculatedCostPerMeal = totalRecipeCost / actualPeriodDays;
      const calculatedTotalCost = calculatedCostPerMeal * (mealQuantity || 1) * actualPeriodDays;

      // Adicionar informações de orçamento aos warnings
      const budgetWarnings: string[] = [];
      if (response?.resumo) {
        const resumo = response.resumo;
        if (resumo.dias_ok < actualPeriodDays) {
          budgetWarnings.push(`${resumo.dias_ok}/${actualPeriodDays} dias dentro do orçamento`);
        }
        if (resumo.economia_total) {
          budgetWarnings.push(`Economia total: R$ ${resumo.economia_total.toFixed(2)}`);
        }
      }

      // Resultado final
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
          ...budgetWarnings,
          ...allRecipes.flatMap(r => r.warnings || [])
        ],
        juiceMenu: undefined
      };

      // Salvar no banco
      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        menu.id = savedId;
        setGeneratedMenu(menu);

        const orcamentoInfo = response?.filial 
          ? ` | Orçamento: ${response.resumo?.dias_ok || 0}/${actualPeriodDays} dias OK`
          : '';

        toast({
          title: "Cardápio Gerado com Orçamento Respeitado",
          description: `${allRecipes.length} receitas. Custo: R$ ${(menu.totalCost || 0).toFixed(2)} total${orcamentoInfo}`,
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