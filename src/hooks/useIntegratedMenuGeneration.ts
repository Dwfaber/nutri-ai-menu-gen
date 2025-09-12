/**
 * Unified hook for integrated menu generation with local calculations and AI support
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useMenuBusinessRules } from './useMenuBusinessRules';
import { useMarketAvailability } from './useMarketAvailability';
import { format, addDays, parse } from 'date-fns';
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

export interface MenuGenerationPayload {
  client_id: string;
  period: string;
  numDays: number;
  mealsPerDay: number;
  preferences?: string[];
  restrictions?: string[];
  useDiaEspecial?: boolean;
}

export interface MenuGenerationRequest {
  clientId: string;
  weekPeriod: string;
  numDays?: number;
  totalMeals?: number;
  preferences?: string[];
  restrictions?: string[];
  specialDay?: boolean;
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
  let lastError: Error;
  
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
  
  throw lastError!;
}

export function useIntegratedMenuGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState<GeneratedMenu | null>(null);
  const [savedMenus, setSavedMenus] = useState<GeneratedMenu[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { selectedClient } = useSelectedClient();
  const { toast } = useToast();
  const { validateMenu, violations, filterRecipesForDay } = useMenuBusinessRules();
  const { viableRecipes, marketIngredients } = useMarketAvailability();
  
  // Load persisted menu from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('current-generated-menu');
    if (stored) {
      try {
        const menu = JSON.parse(stored);
        const currentClientId = selectedClient?.id;
        
        if (menu.clientId === currentClientId) {
          setGeneratedMenu(menu);
        } else {
          // Clear persisted menu if it's for a different client
          localStorage.removeItem('current-generated-menu');
        }
      } catch (error) {
        console.error('Error loading persisted menu:', error);
        localStorage.removeItem('current-generated-menu');
      }
    }
  }, [selectedClient?.id]);

  // Persist menu to localStorage whenever it changes
  useEffect(() => {
    if (generatedMenu) {
      localStorage.setItem('current-generated-menu', JSON.stringify(generatedMenu));
    } else {
      localStorage.removeItem('current-generated-menu');
    }
  }, [generatedMenu]);

  // Clear persisted menu when client changes (only if client actually changed)
  const [previousClientId, setPreviousClientId] = useState<string | null>(null);
  useEffect(() => {
    const currentClientId = selectedClient?.id;
    
    if (previousClientId !== null && previousClientId !== currentClientId) {
      // Only clear if client actually changed (not on first load)
      localStorage.removeItem('current-generated-menu');
      setGeneratedMenu(null);
    }
    
    setPreviousClientId(currentClientId);
  }, [selectedClient?.id, previousClientId]);



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
    
    // Sucos doces/neutros (Suco 2)
    return 'Suco 2';
  };

  // Helper function to map category names to menu structure
  const mapCategoryToMenuStructure = (category: string): string => {
    const categoryMap: { [key: string]: string } = {
      // Mapeamento de categorias conhecidas
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

    // Primeiro tentar mapeamento direto
    const normalizedCategory = category?.toLowerCase().trim();
    if (categoryMap[normalizedCategory]) {
      return categoryMap[normalizedCategory];
    }

    // Fallback para análise por substring
    if (normalizedCategory.includes('prato') || normalizedCategory.includes('principal') || normalizedCategory.includes('proteina')) {
      return 'PP1';
    }
    if (normalizedCategory.includes('salada') || normalizedCategory.includes('verdura') || normalizedCategory.includes('folha')) {
      return 'Salada';
    }
    if (normalizedCategory.includes('guarnicao') || normalizedCategory.includes('guarnição') || normalizedCategory.includes('acompanhamento')) {
      return 'Guarnição';
    }
    if (normalizedCategory.includes('suco') || normalizedCategory.includes('bebida')) {
      return 'Suco';
    }
    if (normalizedCategory.includes('arroz')) {
      return 'Arroz';
    }
    if (normalizedCategory.includes('feijao') || normalizedCategory.includes('feijão')) {
      return 'Feijão';
    }
    if (normalizedCategory.includes('sobremesa') || normalizedCategory.includes('doce')) {
      return 'Sobremesa';
    }

    // Fallback final
    return category || 'PP1';
  };

  // Helper function to convert day names to consistent keys
  const toDayKey = (day: string): string => {
    const dayMap: { [key: string]: string } = {
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

  // Carregar cardápios salvos
  const loadSavedMenus = async () => {
    try {
      const { data: menus, error } = await supabase
        .from('generated_menus')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedMenus: GeneratedMenu[] = (menus as any[])?.map((menu: any) => ({
        id: menu.id,
        clientId: menu.client_id,
        clientName: menu.client_name,
        weekPeriod: menu.week_period,
        status: (menu.status as 'pending_approval' | 'approved' | 'rejected' | 'draft') || 'pending_approval',
        totalCost: Number(menu.total_cost) || 0,
        costPerMeal: Number(menu.cost_per_meal) || 0,
        totalRecipes: Number(menu.total_recipes) || 0,
        recipes: menu.receitas_adaptadas || [],
        createdAt: menu.created_at,
        approvedBy: menu.approved_by,
        rejectedReason: menu.rejected_reason
      })) || [];

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

      // Remover da lista local
      setSavedMenus(prev => prev.filter(menu => menu.id !== menuId));

      // Se era o menu atual, limpar também
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

  // Carregar cardápios ao montar o componente e quando cliente mudar
  useEffect(() => {
    loadSavedMenus();
  }, [selectedClient?.id]); // Recarrega quando o cliente muda

  const generateMenuWithFormData = async (
    formData: SimpleMenuFormData
  ): Promise<GeneratedMenu | null> => {
    // Proteção contra chamadas simultâneas
    if (isProcessing) {
      console.log('⚠️ Geração já em andamento, ignorando nova solicitação');
      return null;
    }
    
    setIsProcessing(true);
    setIsGenerating(true);
    setError(null);

    try {
      const clientToUse = selectedClient;
      if (!clientToUse) {
        throw new Error('Nenhum cliente selecionado');
      }

      // Logging completo do cliente para diagnóstico
      console.log("🔍 FULL selectedClient:", JSON.stringify(clientToUse, null, 2));

      // Mapear identificador do cliente com fallback robusto
      const clientIdResolved = 
        clientToUse?.id ||
        (clientToUse as any)?.filial_id ||
        (clientToUse as any)?.cliente_id_legado ||
        (clientToUse as any)?.client_id ||
        null;

      console.log("🔍 CLIENT_ID RESOLVED:", {
        original_id: clientToUse?.id,
        filial_id: (clientToUse as any)?.filial_id,
        cliente_id_legado: (clientToUse as any)?.cliente_id_legado,
        client_id: (clientToUse as any)?.client_id,
        resolved: clientIdResolved
      });

      if (!clientIdResolved) {
        throw new Error("Cliente não possui identificador válido (id / filial_id / client_id)");
      }

      console.log('🔄 Iniciando geração com FormData:', formData);

      // Parse dates and create week period string
      const startDate = parse(formData.period.start, 'yyyy-MM-dd', new Date());
      const endDate = parse(formData.period.end, 'yyyy-MM-dd', new Date());
      const weekPeriod = `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;

      console.log('📅 Período formatado:', weekPeriod);

      // Estrutura corrigida do payload para a Edge Function
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

      console.log('📤 Enviando payload:', payload);

      // Use GPT Assistant para gerar receitas
      const { data, error: functionError } = await withRetry(
        () => supabase.functions.invoke('gpt-assistant', {
          body: payload
        }),
        {
          maxRetries: 3,
          initialDelay: 1500,
          maxDelay: 10000,
          backoffFactor: 2
        }
      );

      if (functionError) {
        console.error('Erro na função GPT:', functionError);
        throw new Error(functionError.message || 'Erro ao gerar receitas');
      }

      if (!data || !data.success) {
        console.error('Dados inválidos da função:', data);
        throw new Error(data?.error || 'Erro na geração das receitas');
      }

      console.log('📥 Resposta completa da Edge Function:', JSON.stringify(data, null, 2));

      // NORMALIZAR RESPOSTA: A Edge Function pode retornar `cardapio` ou `recipes`
      let recipes = data.recipes || [];
      
      // Se veio `cardapio` (estrutura do gpt-assistant), normalizar para `recipes`
      if (!recipes.length && data.cardapio) {
        console.log('🔄 Normalizando cardapio para recipes format');
        recipes = data.cardapio;
      }

      // Se ainda não tem recipes, tentar extrair de receitas_adaptadas
      if (!recipes.length && data.receitas_adaptadas) {
        console.log('🔄 Normalizando receitas_adaptadas para recipes format');
        recipes = data.receitas_adaptadas;
      }

      console.log('📥 Receitas finais:', recipes?.length || 0);

      if (!recipes.length) {
        console.error('❌ Nenhuma receita encontrada na resposta:', {
          hasRecipes: !!data.recipes,
          hasCardapio: !!data.cardapio,
          hasReceitasAdaptadas: !!data.receitas_adaptadas,
          dataKeys: Object.keys(data || {})
        });
        throw new Error('IA não conseguiu gerar receitas');
      }

      // Aplicar regras de negócio usando filterRecipesForDay
      console.log('🔍 Aplicando regras de variedade...');
      const gerarSemanas = (inicio: Date, fim: Date, incluirFDS: boolean = false) => {
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

      // Organizar receitas por semana aplicando regras de variedade
      const dataInicio = startDate;
      const dataFim = endDate;
      const incluirFDS = !(formData.diasUteis ?? true);
      let semanas = gerarSemanas(dataInicio, dataFim, incluirFDS);

      // Preencher as receitas de cada dia usando chave de dia normalizada E aplicando regras de variedade
      const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
      let receitasUsadasAnterior: any[] = [];
      
      for (const semanaKey in semanas) {
        semanas[semanaKey] = semanas[semanaKey].map((dia: any, dayIndex: number) => {
          const slotKey = toDayKey(dia.dia);
          
          // Filtrar receitas disponíveis para este dia (com regras de variedade)
          const receitasDisponiveis = recipes.filter((r: any) => toDayKey(r.day) === slotKey);
          
          // Aplicar regras de negócio para evitar repetições de proteína
          const receitasFiltradas = filterRecipesForDay(
            receitasDisponiveis, 
            dia.dia, 
            dayIndex, 
            receitasUsadasAnterior
          );
          
          const receitasDoDia = receitasFiltradas.map((r: any, idx: number) => {
            let cat = mapCategoryToMenuStructure(r.category || '');
            if (cat === 'Salada') cat = categorizeSalad(r.name || '', idx);
            if (cat === 'Suco') cat = categorizeJuice(r.name || '', idx);

            return {
              id: r.id,
              nome: r.name,
              categoria: cat,
              custo_total: r.cost,         // custo unitário
              custo_por_refeicao: r.cost   // custo unitário
            };
          });
          
          // Atualizar receitas usadas para próximo dia
          receitasUsadasAnterior = receitasDoDia;

          const totalDia = receitasDoDia.reduce(
            (s, rr) => s + rr.custo_por_refeicao * (formData.estimatedMeals || 50),
            0
          );

          return {
            ...dia,
            receitas: receitasDoDia,
            custo_total: totalDia
          };
        });
      }

      // Calcular custos totais
      let custoTotal = 0;
      let totalReceitas = 0;

      for (const semanaKey in semanas) {
        for (const dia of semanas[semanaKey]) {
          custoTotal += dia.custo_total || 0;
          totalReceitas += dia.receitas?.length || 0;
        }
      }

      // Calcular número total de dias do período
      const totalDias = Object.values(semanas).reduce((total, diasSemana) => total + diasSemana.length, 0);
      
      // Calcular custo por refeição individual (custo total / refeições por dia / número de dias)
      const custoPorRefeicao = (formData.estimatedMeals && formData.estimatedMeals > 0 && totalDias > 0) 
        ? custoTotal / (formData.estimatedMeals * totalDias) 
        : 0;

      // Validar regras de negócio
      const allRecipes = Object.values(semanas).flat().flatMap((dia: any) => dia.receitas || []);
      const businessRules = validateMenu(allRecipes);
      
      console.log('📋 Regras de negócio aplicadas:', businessRules);

      // Criar menu final
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

      console.log('✅ Menu gerado:', {
        totalReceitas: menu.totalRecipes,
        custoTotal: menu.totalCost,
        custoPorRefeicao: menu.costPerMeal
      });

      setGeneratedMenu(menu);

      // Tentar salvar no banco
      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        menu.id = savedId;
        setGeneratedMenu(menu);
        
        toast({
          title: "Cardápio gerado!",
          description: `${menu.totalRecipes} receitas. Custo: R$ ${menu.costPerMeal.toFixed(2)}/refeição`,
        });
        
        // Recarregar lista de cardápios salvos
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

  // Wrapper function for backward compatibility - calls generateMenuWithFormData
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

    // Map legacy parameters to new FormData structure
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

    // Call the new unified method
    return generateMenuWithFormData(formData);
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
          // Quantidades baseadas em refeições
          servingsPerDay: (menu.recipes?.[0]?.servings) || 50,
          totalServingsWeek: ((menu.recipes?.[0]?.servings) || 50) * 5,
          servingsByRecipe: Object.fromEntries(menu.recipes.map((r) => [r.id, r.servings])),
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
    localStorage.removeItem('current-generated-menu');
  };

  const clearMenuExplicitly = () => {
    setGeneratedMenu(null);
    localStorage.removeItem('current-generated-menu');
    setError(null);
  };

  const mapRecipesToMarketProducts = (recipes: MenuRecipe[]): any[] => {
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
    clearMenuExplicitly, // Nova função para limpeza explícita
    loadSavedMenus,
    deleteGeneratedMenu,
    mapRecipesToMarketProducts,
    // Export related hooks for business rules
    violations,
    validateMenu,
    validateMenuAndSetViolations: (recipes: any[]) => {
      const rules = validateMenu(recipes);
      return rules;
    },
    // Export market availability hooks
    viableRecipes,
    marketIngredients
  };
};
