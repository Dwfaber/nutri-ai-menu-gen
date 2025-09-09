import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { withRetry } from '@/utils/connectionUtils';
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
  menu?: {
    days: Array<{
      dia: string;
      budget_per_meal: number;
      custo_por_refeicao: number;
      custo_total_dia: number;
      dentro_orcamento: boolean;
      itens: Array<{
        slot: string;
        nome: string;
        custo_total: number;
        custo_por_refeicao: number;
        placeholder?: boolean;
      }>;
    }>;
    total_cost: number;
    average_cost_per_meal: number;
    portions_total: number;
  };
  warnings?: string[];
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
    
    console.log('🔄 Mapeando categoria:', category, '→', normalizedCategory);
    
    // PP1 - aceita tanto "proteína principal" quanto "prato principal"
    if (normalizedCategory.includes('proteína principal 1') || 
        normalizedCategory.includes('prato principal 1') || 
        normalizedCategory === 'pp1') {
      console.log('✅ Categoria mapeada para PP1');
      return 'PP1';
    }
    
    // PP2 - aceita tanto "proteína principal" quanto "prato principal"
    if (normalizedCategory.includes('proteína principal 2') || 
        normalizedCategory.includes('prato principal 2') || 
        normalizedCategory === 'pp2') {
      console.log('✅ Categoria mapeada para PP2');
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
    
    // Log para categorias não reconhecidas
    console.log('⚠️ Categoria não reconhecida:', category, '→ usando "Outros"');
    return 'Outros';
  };

  // Carregar cardápios salvos
  const loadSavedMenus = async () => {
    try {
      // Get the current client ID from selected client
      const currentClientId = selectedClient?.id || selectedClient?.filial_id;
      
      let query = supabase
        .from('generated_menus')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Filter by client if we have one selected
      if (currentClientId) {
        query = query.eq('client_id', String(currentClientId));
        console.log('🔍 Filtro aplicado client_id:', currentClientId);
      } else {
        console.log('⚠️ Nenhum cliente selecionado - mostrando todos os cardápios');
      }

      const { data: menus, error: menusError } = await query;

      if (menusError) {
        console.error('❌ Erro Supabase:', menusError);
      } else {
        console.log('📊 Cardápios encontrados:', menus?.length || 0);
        if (menus?.length) {
          console.log('📑 IDs dos cardápios:', menus.map(m => m.id));
          console.log('💰 Primeiro cardápio - receitas:', menus[0]?.total_recipes, 'custo:', menus[0]?.cost_per_meal);
        }
      }

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
        recipes: (Array.isArray(menu.receitas_adaptadas) ? menu.receitas_adaptadas : []).map((recipe: any, idx: number) => {
          const mapped = mapCategoryToMenuStructure(recipe.categoria_descricao || '');
          let finalCategory = mapped;
          if (mapped === 'Salada') finalCategory = categorizeSalad(recipe.nome_receita || '', idx);
          if (mapped === 'Suco') finalCategory = categorizeJuice(recipe.nome_receita || '', idx);
          const s = String(recipe.day || recipe.dia || '').toLowerCase();
          const normalizedDay = s.includes('seg') ? 'Segunda-feira'
            : (s.includes('terç') || s.includes('terc') || s === 'terca') ? 'Terça-feira'
            : s.includes('qua') ? 'Quarta-feira'
            : s.includes('qui') ? 'Quinta-feira'
            : s.includes('sex') ? 'Sexta-feira'
            : s.includes('sab') ? 'Sábado'
            : s.includes('dom') ? 'Domingo'
            : 'Segunda-feira';
          return {
            id: recipe.receita_id_legado,
            name: recipe.nome_receita,
            category: finalCategory,
            day: normalizedDay,
            cost: recipe.custo_adaptado,
            servings: recipe.porcoes,
            ingredients: recipe.ingredientes || [],
            nutritionalInfo: recipe.nutritional_info || {}
          };
        }),
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
          total_recipes: receitasAdaptadas.length,   // Usa fonte da verdade real
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

  // Carregar cardápios ao montar o componente e quando cliente mudar
  useEffect(() => {
    loadSavedMenus();
  }, [selectedClient?.id]); // Recarrega quando o cliente muda

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

    try {
      setIsGenerating(true);
      setError(null);

      const weekPeriod = `${formData.period.start} a ${formData.period.end}`;
      
      // Use the selected client from context or override with form data
      const clientToUse = selectedClient?.id === formData.clientId ? selectedClient : formData.contractData;
      
      if (!clientToUse) {
        throw new Error("Cliente não encontrado");
      }

      // Criar payload para Edge Function
      const payload = {
        action: 'generate_menu',
        client_id: formData.clientId,
        filial_id: clientToUse.filial_id || clientToUse.filial_id_legado,
        period: weekPeriod,
        numDays: 7,
        refeicoesPorDia: formData.mealsPerDay || clientToUse.total_funcionarios || 100,
        preferences: formData.preferences ? [formData.preferences] : [],
        proteinGrams: formData.proteinGrams || '100',
        juiceConfig: formData.juiceConfig || {},
        baseRecipes: {
          arroz: 580,
          feijao: 1600
        }
      };

      // Chamar Edge Function
      const { data, error: functionError } = await supabase.functions.invoke('gpt-assistant', {
        body: payload
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro ao gerar cardápio');
      }

      if (!data || !data.success) {
        throw new Error(data?.erro || 'Resposta inválida da IA');
      }

      // ⚡ IMEDIATAMENTE criar e definir o generatedMenu
      const menu: GeneratedMenu = {
        id: `temp-${Date.now()}`, // ID temporário até salvar no banco
        clientId: formData.clientId,
        clientName: clientToUse.nome_fantasia || clientToUse.nome_empresa || 'Cliente',
        weekPeriod: weekPeriod,
        status: 'pending_approval',
        totalCost: Number(data.resumo_financeiro?.custo_total_periodo || 0),
        costPerMeal: Number(data.resumo_financeiro?.custo_medio_por_refeicao || 0),
        totalRecipes: data.cardapio?.reduce((total: number, dia: any) => 
          total + (dia.receitas?.length || 0), 0) || 0,
        recipes: data.cardapio?.flatMap((dia: any) =>
          dia.receitas?.map((r: any, index: number) => ({
            id: r.id || `recipe-${index}`,
            name: r.nome || 'Receita sem nome',
            category: r.categoria || 'Outros',
            day: dia.dia || 'Segunda-feira',
            cost: Number(r.custo_por_refeicao || 0),
            servings: Number(r.porcoes || formData.mealsPerDay || 100),
            ingredients: r.ingredientes || [],
            nutritionalInfo: r.nutritional_info || {}
          }))
        ) || [],
        createdAt: new Date().toISOString(),
        warnings: data.avisos || []
      };

      // ⚡ PRIMEIRO atualizar estado local para exibição imediata
      setGeneratedMenu(menu);

      // 🎉 Feedback imediato ao usuário
      toast({
        title: "🎉 Cardápio gerado com sucesso!",
        description: "Cardápio criado e disponível para análise.",
      });

      // DEPOIS salvar no banco de dados
      const savedMenuId = await saveMenuToDatabase(menu);
      
      if (savedMenuId) {
        // Atualizar o menu com o ID real do banco
        setGeneratedMenu(prev => prev ? { ...prev, id: savedMenuId } : null);
        
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
    }
  };

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

    try {
      setIsGenerating(true);
      setError(null);
      
      console.log('Gerando cardápio com IA integrada...');
      console.log('Cliente selecionado:', {
        id: clientToUse.cliente_id_legado || clientToUse.empresa_id_legado || clientToUse.filial_id_legado || clientToUse.id,
        nome: clientToUse.nome_fantasia || clientToUse.nome_empresa || clientToUse.razao_social,
        funcionarios: clientToUse.total_funcionarios,
        custo_maximo: clientToUse.custo_maximo_refeicao,
        restricoes: clientToUse.restricoes_alimentares
      });
      
      const legacyId = clientToUse.filial_id;
      const mpd = mealsPerDay || clientToUse.total_funcionarios || 100;
      const tMeals = totalMeals || (mpd * 5);
      
      // Validação de entrada
      if (!legacyId || legacyId <= 0) {
        throw new Error('ID da filial deve ser um número válido maior que zero');
      }
      
      if (!mpd || mpd <= 0) {
        throw new Error('Número de refeições por dia deve ser maior que zero');
      }

      // Calculate requested number of days
      const requestedNumDays =
        (typeof tMeals === 'number' && tMeals > 0 && mpd > 0)
          ? Math.max(1, Math.ceil(tMeals / mpd))
          : 7;

      // Garantir período correto no formato brasileiro
      console.log('📅 Período enviado:', weekPeriod);
      console.log('🔢 Refeições por dia:', mpd);
      console.log('🏢 Filial ID:', legacyId);

      // Payload padronizado - incluindo receitas base obrigatórias
      const payload = {
        action: 'generate_menu',
        client_id: clientToUse.id, // UUID único do cliente
        filialIdLegado: legacyId,
        period: weekPeriod, // Período no formato brasileiro DD/MM/YYYY a DD/MM/YYYY
        numDays: 7, // Sempre 7 dias para cardápio semanal
        refeicoesPorDia: mpd, // Padronizar nome do parâmetro
        useDiaEspecial: false,
        baseRecipes: {
          arroz: 580,    // ARROZ BRANCO
          feijao: 1600   // FEIJÃO MIX - CARIOCA + BANDINHA 50%
        }
      };

      console.log('[Frontend] Enviando payload padronizado:', payload);

      // Use GPT Assistant com retry logic para maior robustez
      console.log('[Conectividade] Invocando Edge Function com retry...');
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

      console.log('Resposta da função GPT Assistant:', { data, functionError });

      if (functionError) {
        console.error('[Frontend] Erro na função GPT:', functionError);
        
        // Tratamento detalhado de erros da Edge Function
        let errorDetails = functionError.message || 'Erro ao gerar cardápio com IA';
        let errorStatus = 'Erro da função';
        let shouldFallbackToLocal = false;
        
        // Extrair contexto detalhado quando possível
        try {
          // Verificar se é erro HTTP (mais comum) e extrair contexto
          if (functionError.name === 'FunctionsHttpError' && functionError.context) {
            errorStatus = `HTTP ${(functionError as any).status || 'N/A'}`;
            try {
              const contextResponse = functionError.context;
              if (typeof contextResponse.json === 'function') {
                const contextData = await contextResponse.json();
                if (contextData?.error) {
                  errorDetails = contextData.error;
                }
                if (contextData?.details) {
                  errorDetails += ` | Detalhes: ${contextData.details}`;
                }
                if (contextData?.produtoIds) {
                  errorDetails += ` | IDs: ${JSON.stringify(contextData.produtoIds)}`;
                }
              }
            } catch (parseError) {
              console.warn('[Frontend] Erro ao processar contexto HTTP:', parseError);
              errorDetails = `${errorStatus}: ${functionError.message}`;
            }
          } else if (functionError.name === 'FunctionsRelayError') {
            errorStatus = 'Erro de comunicação';
            errorDetails = 'Falha na comunicação com o servidor. Tente novamente.';
            shouldFallbackToLocal = true;
        } else if (functionError.name === 'FunctionsFetchError') {
            errorStatus = 'Erro de conectividade';
            errorDetails = 'Falha na comunicação com o servidor. O sistema tentou reconectar automaticamente mas não conseguiu estabelecer conexão estável.';
            shouldFallbackToLocal = true;
          }
        } catch (processingError) {
          console.warn('[Frontend] Erro ao processar detalhes do erro:', processingError);
          errorDetails = functionError.message || String(functionError);
          shouldFallbackToLocal = true;
        }
        
        console.error(`[Frontend] ${errorStatus}: ${errorDetails}`);
        
        // Se é erro de conectividade, mostrar erro detalhado
        if (shouldFallbackToLocal) {
          console.log('[Frontend] Problema de conectividade detectado.');
        }
        
        toast({
          title: `Erro na geração (${errorStatus})`,
          description: errorDetails,
          variant: "destructive"
        });
        
        throw new Error(errorDetails);
      }

      if (!data || !data.success) {
        console.error('Dados inválidos da função GPT:', data);
        throw new Error(data?.error || 'Erro na geração do cardápio');
      }

      console.log("DEBUG :: Resposta Edge Function bruta (data):", JSON.stringify(data, null, 2));
      
      // Verificar diferentes estruturas de resposta
      const aiMenu = data.menu || data.cardapio || {};
      console.log("DEBUG :: data.cardapio:", data.cardapio);
      console.log("DEBUG :: data.cardapio?.receitas:", data.cardapio?.receitas);
      console.log("DEBUG :: aiMenu.cardapio:", aiMenu.cardapio);
      console.log("DEBUG :: aiMenu.days:", aiMenu.days);
      
      // Mapear receitas do formato real da Edge Function
      let receitasExtraidas: any[] = [];

      if (Array.isArray(data.cardapio) && data.cardapio.length > 0) {
        const first = data.cardapio[0];
        
        // 🔎 Caso 1: formato simples (array de receitas)
        if (first && (first.nome || first.categoria || first.custo_por_refeicao)) {
          console.log('✅ Detectado formato simples de receitas:', data.cardapio.length);
          receitasExtraidas = data.cardapio;
        }
        // 🔎 Caso 2: formato de dias (array de objetos com "receitas")
        else if (first && Array.isArray(first.receitas)) {
          console.log('✅ Detectado formato por dias:', data.cardapio.length);
          receitasExtraidas = data.cardapio.flatMap((diaObj: any) =>
            (diaObj.receitas || []).map((receita: any) => ({
              ...receita,
              dia: diaObj.dia || receita.dia || 'Segunda-feira'
            }))
          );
        }
        else {
          console.warn('⚠️ Estrutura de cardápio não reconhecida, tentando fallbacks');
        }
      }
      // 🔎 Caso 3: formato legado - objeto com cardapio.receitas
      else if (data.cardapio?.receitas && Array.isArray(data.cardapio.receitas)) {
        console.log('✅ Detectado formato legado cardapio.receitas:', data.cardapio.receitas.length);
        receitasExtraidas = data.cardapio.receitas;
      }
      // 🔎 Caso 4: aiMenu.cardapio
      else if (Array.isArray(aiMenu.cardapio)) {
        console.log('✅ Detectado aiMenu.cardapio:', aiMenu.cardapio.length);
        receitasExtraidas = aiMenu.cardapio;
      }
      // 🔎 Caso 5: aiMenu.days
      else if (Array.isArray(aiMenu.days)) {
        console.log('✅ Detectado aiMenu.days:', aiMenu.days.length);
        receitasExtraidas = aiMenu.days.flatMap((day: any) =>
          (day.receitas || []).map((receita: any) => ({
            ...receita,
            dia: day.dia || 'Segunda'
          }))
        );
      }

      // 🔎 Fallback final
      if (!receitasExtraidas.length && Array.isArray(data.receitas_adaptadas)) {
        console.log('⚠️ Usando fallback receitas_adaptadas:', data.receitas_adaptadas.length);
        receitasExtraidas = data.receitas_adaptadas;
      }

      console.log(`📦 Total de receitas extraídas: ${receitasExtraidas.length}`);

      // Validar se temos receitas
      if (!receitasExtraidas.length) {
        console.error('❌ Nenhuma receita encontrada em qualquer formato');
        console.error('📦 Estrutura data.cardapio:', data.cardapio);
        console.error('📦 Estrutura aiMenu:', aiMenu);
        console.error('📦 Estrutura data.receitas_adaptadas:', data.receitas_adaptadas);
        throw new Error('IA não retornou um cardápio válido - nenhuma receita encontrada');
      }
      
      // Criar estruturas compatíveis para o código legado
      const cardapioV1 = receitasExtraidas;
      const daysV2 = Array.isArray(aiMenu.days) ? aiMenu.days : [];

      const dayLabelToTitle = (lbl: string) => {
        const s = String(lbl || '').toUpperCase();
        if (s.includes('SEG')) return 'Segunda';
        if (s.includes('TER')) return 'Terça';
        if (s.includes('QUA')) return 'Quarta';
        if (s.includes('QUI')) return 'Quinta';
        if (s.includes('SEX')) return 'Sexta';
        if (s.includes('SÁB') || s.includes('SAB')) return 'Sábado';
        if (s.includes('DOM')) return 'Domingo';
        return 'Segunda';
      };

      const mpdFromSummary = Number(
        aiMenu.summary?.refeicoes_por_dia ??
        (aiMenu.portions_total && daysV2.length ? aiMenu.portions_total / daysV2.length : undefined) ??
        mpd ?? 50
      );

      // Funções auxiliares para validação
      const isProteinRecipe = (recipeName: string): boolean => {
        const name = recipeName.toUpperCase();
        return name.includes('FRANGO') || name.includes('CARNE') || name.includes('BIFE') || 
               name.includes('PEIXE') || name.includes('OVO') || name.includes('LINGUIÇA') ||
               name.includes('ALMÔNDEGA') || name.includes('ALMONDEGA') || name.includes('PERNIL') ||
               name.includes('ACÉM') || name.includes('SUÍNO') || name.includes('BOVINO') ||
               name.includes('FILÉ') || name.includes('COXA') || name.includes('PEITO');
      };

      const isGuarnitionRecipe = (recipeName: string): boolean => {
        const name = recipeName.toUpperCase();
        return name.includes('BATATA') || name.includes('LEGUMES') || name.includes('MANDIOCA') ||
               name.includes('PURÊ') || name.includes('REFOGADO') || name.includes('COZIDO') ||
               name.includes('MACARRÃO') || name.includes('POLENTA') || name.includes('FAROFA');
      };

      const isFreshSalad = (recipeName: string): boolean => {
        const name = recipeName.toUpperCase();
        return name.includes('SALADA') && (name.includes('VERDE') || name.includes('ALFACE') ||
               name.includes('RÚCULA') || name.includes('FOLHA') || name.includes('MISTA')) &&
               !name.includes('COZIDA') && !name.includes('COZIDO');
      };

      const isVegetableSalad = (recipeName: string): boolean => {
        const name = recipeName.toUpperCase();
        return name.includes('SALADA') && (name.includes('TOMATE') || name.includes('CENOURA') ||
               name.includes('PEPINO') || name.includes('RUSSA') || name.includes('MAIONESE'));
      };

      const mapCategory = (c: string, recipeName: string = '') => {
        const s = String(c || '').toUpperCase();
        const recipeUpper = recipeName.toUpperCase();
        
        console.log(`🔄 Mapeando categoria: "${c}" para receita: "${recipeName}"`);
        
        // Validação prévia - verificar se categoria faz sentido
        if ((s.includes('PROTEÍNA') || s.includes('PRATO PRINCIPAL')) && 
            !isProteinRecipe(recipeName)) {
          console.log(`⚠️ CORREÇÃO: ${recipeName} marcada como proteína mas não parece proteína`);
          if (isGuarnitionRecipe(recipeName)) {
            console.log(`✅ Reclassificando para Guarnição`);
            return 'Guarnição';
          }
        }
        
        if (s.includes('PROTEÍNA PRINCIPAL 1') || s.includes('PROTEINA PRINCIPAL 1')) return 'PP1';
        if (s.includes('PROTEÍNA PRINCIPAL 2') || s.includes('PROTEINA PRINCIPAL 2')) return 'PP2';
        if (s.includes('PRATO PRINCIPAL 1')) return 'PP1';
        if (s.includes('PRATO PRINCIPAL 2')) return 'PP2';
        if (s.includes('ARROZ BRANCO') || s.includes('ARROZ')) return 'Arroz Branco';
        if (s.includes('FEIJ')) return 'Feijão';
        if (s.includes('GUARNIÇÃO') || s.includes('ACOMPANHAMENTO')) return 'Guarnição';
        
        // Saladas com validação
        if (s.includes('SALADA 1') || s.includes('VERDURAS')) {
          if (isFreshSalad(recipeName)) {
            return 'Salada 1';
          } else {
            console.log(`⚠️ ${recipeName} marcada como Salada 1 mas não é salada fresca - movendo para Guarnição`);
            return 'Guarnição';
          }
        }
        
        if (s.includes('SALADA 2') || s.includes('LEGUMES')) {
          if (isFreshSalad(recipeName) || isVegetableSalad(recipeName)) {
            return 'Salada 2';
          } else {
            console.log(`⚠️ ${recipeName} marcada como Salada 2 mas não é salada - movendo para Guarnição`);
            return 'Guarnição';
          }
        }
        
        if (s.includes('SUCO 1')) return 'Suco 1';
        if (s.includes('SUCO 2')) return 'Suco 2';
        if (s.includes('SOBREMESA') || s.includes('CREME') || s.includes('DOCE')) return 'Sobremesa';
        
        const mapped = mapCategoryToMenuStructure(c);
        console.log(`✅ Resultado: ${c} → ${mapped} para ${recipeName}`);
        return mapped;
      };

      const receitasCardapio: MenuRecipe[] = [];
      if (cardapioV1.length) {
        // Verificar se cardapioV1 é um array de receitas simples (novo formato) ou dias (formato legado)
        const isSimpleRecipeFormat = cardapioV1.some(item => 
          item && typeof item === 'object' && 
          ('nome' in item || 'categoria' in item || 'custo_por_refeicao' in item) &&
          !('dia' in item || 'itens' in item)
        );

        if (isSimpleRecipeFormat) {
          // Novo formato: array direto de receitas
          for (const receita of cardapioV1) {
            if (!receita || typeof receita !== 'object') continue;
            const rid = receita.id || receita.receita_id_legado || receita.receita_id;
            if (!rid) continue;
            
            receitasCardapio.push({
              id: String(rid),
              name: String(receita.nome || ''),
              day: 'Segunda-feira', // Dia padrão para estrutura fixa
              category: mapCategory(receita.categoria || receita.tipo || ''),
              cost: Number(receita.custo_por_refeicao || 0),
              servings: mpdFromSummary,
              ingredients: [],
              nutritionalInfo: {}
            });
          }
        } else {
          // Formato legado: dias com itens
          for (const dia of cardapioV1) {
            const dayName = dayLabelToTitle(dia.dia_label || dia.dia);
            const itens = Array.isArray(dia.itens) ? dia.itens : [];
            for (const it of itens) {
              const rid = it.receita_id_legado || it.receita_id;
              if (!rid) continue;
              receitasCardapio.push({
                id: String(rid),
                name: String(it.nome || ''),
                day: dayName,
                category: mapCategory(it.categoria || it.slot || ''),
                cost: Number(it.custo_por_refeicao || 0),
                servings: mpdFromSummary,
                ingredients: [],
                nutritionalInfo: {}
              });
            }
          }
        }
      } else if (daysV2.length) {
        for (const dia of daysV2) {
          const dayName = dayLabelToTitle(dia.label_orcamento || dia.dia);
          const itens = Array.isArray(dia.itens) ? dia.itens : [];
          for (const it of itens) {
            if (!it || !it.receita_id) continue;
            if (it.placeholder) continue; // pular placeholders (ex.: FEIJÃO ausente)
            receitasCardapio.push({
              id: String(it.receita_id),
              name: String(it.nome || ''),
              day: dayName,
              category: mapCategory(it.slot || ''),
              cost: Number(it.custo_por_refeicao || 0),
              servings: mpdFromSummary,
              ingredients: [],
              nutritionalInfo: {}
            });
          }
        }
      }

      // Enriquecer com ingredientes (até 3 por receita)
      const recipeIds = Array.from(new Set(receitasCardapio.map(r => r.id).filter(Boolean)));
      if (recipeIds.length) {
        const { data: ingredientsData, error: ingError } = await supabase
          .from('receita_ingredientes')
          .select('receita_id_legado,produto_base_id,produto_base_descricao,quantidade,unidade')
          .in('receita_id_legado', recipeIds);

        if (!ingError && ingredientsData) {
          const byRecipe: Record<string, { produto_base_id:number; name: string; quantity: number; unit: string }[]> = {};
          for (const ing of ingredientsData as any[]) {
            const recId = String(ing.receita_id_legado);
            if (!byRecipe[recId]) byRecipe[recId] = [];
            if (byRecipe[recId].length < 3) {
              byRecipe[recId].push({
                produto_base_id: Number(ing.produto_base_id),
                name: ing.produto_base_descricao || '',
                quantity: Number(ing.quantidade ?? 0),
                unit: ing.unidade || ''
              });
            }
          }
          for (const r of receitasCardapio) r.ingredients = byRecipe[r.id] || [];
        }

        // Ensure juices are present for each day
        const daySlots = new Map<string, Set<string>>();
        for (const r of receitasCardapio) {
          const key = r.day;
          if (!daySlots.has(key)) daySlots.set(key, new Set());
          daySlots.get(key)!.add(r.category.toUpperCase());
        }

        const dias = Array.from(new Set(receitasCardapio.map(r => r.day)));
        
        for (const d of dias) {
          const have = daySlots.get(d) || new Set();
          const need1 = !have.has('SUCO 1');
          const need2 = !have.has('SUCO 2');
          if (need1) receitasCardapio.push({ 
            id: '599', 
            name: 'SUCO EM PÓ DE LARANJA', 
            day: d, 
            category: 'Suco 1', 
            cost: 0, 
            servings: mpdFromSummary,
            ingredients: []
          });
          if (need2) receitasCardapio.push({ 
            id: '656', 
            name: 'SUCO TETRA PAK', 
            day: d, 
            category: 'Suco 2', 
            cost: 0, 
            servings: mpdFromSummary,
            ingredients: []
          });
        }
      }

      // Processar warnings informativos da Edge Function
      if (Array.isArray(data.warnings) && data.warnings.length) {
        console.log('[Frontend] Warnings recebidos da Edge Function:', data.warnings);
        
        // Exibir warnings como informação (não erro)
        data.warnings.forEach((warning: string, index: number) => {
          if (index < 3) { // Limitar a 3 toasts para não sobrecarregar
            toast({
              title: `Aviso ${index + 1}/${data.warnings.length}`,
              description: String(warning).slice(0, 150) + (String(warning).length > 150 ? '...' : ''),
              variant: "default" // Info, não destructive
            });
          }
        });
        
        if (data.warnings.length > 3) {
          console.log(`[Frontend] ${data.warnings.length - 3} warnings adicionais não exibidos:`, 
            data.warnings.slice(3));
        }
      }

      console.log(`IA gerou ${receitasCardapio.length} itens precificados`);

      // Validar regras de negócio no cardápio da IA
      const businessRules = validateMenu(receitasCardapio);
      console.log('Validação de regras:', businessRules);
      console.log('Violações encontradas:', violations);
      
      // Custos a partir do resumo da função (compatível com v1 e v2)
      const totalCost =
        Number(aiMenu.summary?.total_custo) ||
        Number(aiMenu.total_cost) ||
        Number(data.total_custo) ||
        Number(data.total_cost) ||
        (daysV2.length ? daysV2.reduce((s: number, d: any) => s + Number(d.custo_total_dia || 0), 0) : 0);

      const costPerMeal =
        Number(aiMenu.summary?.custo_medio_por_refeicao) ||
        Number(aiMenu.average_cost_per_meal) ||
        Number(data.custo_medio_por_refeicao) ||
        Number(data.average_cost_per_meal) ||
        (totalCost && mpdFromSummary ? totalCost / (mpdFromSummary * 7) : 0);
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
        id: `temp-${Date.now()}`, // ID temporário até salvar no banco
        clientId: clientToUse.id || clientToUse.cliente_id_legado,
        clientName: clientToUse.nome_fantasia || clientToUse.nome_empresa,
        weekPeriod,
        status: 'pending_approval',
        totalCost,
        costPerMeal,
        totalRecipes: receitasCardapio.length,
        recipes: receitasCardapio,
        createdAt: new Date().toISOString(),
        menu: aiMenu, // Incluir dados detalhados do menu da Edge Function
        warnings: data.warnings || []
      };

      // ⚡ PRIMEIRO atualizar estado local para exibição imediata
      setGeneratedMenu(menu);

      // 🎉 Feedback imediato ao usuário
      toast({
        title: "🎉 Cardápio gerado com sucesso!",
        description: `${receitasCardapio.length} receitas otimizadas. Custo: R$ ${costPerMeal.toFixed(2)}/refeição`,
      });

      // DEPOIS salvar no banco de dados
      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        // Atualizar o menu com o ID real do banco
        setGeneratedMenu(prev => prev ? { ...prev, id: savedId } : null);
        
        // Recarregar lista de cardápios salvos
        await loadSavedMenus();
        
        console.log('Menu generation with AI completed successfully');
        console.log('Final cost per meal:', costPerMeal);
        console.log('Budget compliance:', costPerMeal <= budgetLimit ? 'OK' : 'EXCEEDED');

        return menu;
      } else {
        // Mesmo se não conseguir salvar, mantém o menu gerado na interface
        console.warn('Não foi possível salvar no banco, mas menu permanece na interface');
        return menu;
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

  // ⚡ Função que preserva o estado durante navegação
  const clearGeneratedMenu = (force: boolean = false) => {
    // Só limpa se for forçado (botão limpar, rejeição, exclusão)
    if (force) {
      setGeneratedMenu(null);
      setError(null);
    }
  };

  // Função específica para limpar explicitamente
  const clearMenuExplicitly = () => {
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
    clearMenuExplicitly, // Nova função para limpeza explícita
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