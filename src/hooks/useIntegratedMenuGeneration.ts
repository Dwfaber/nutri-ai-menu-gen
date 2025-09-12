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
  period: { start: string; end: string };
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

// Retry helper
async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries: number; initialDelay: number; maxDelay: number; backoffFactor: number }
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt === options.maxRetries) break;
      const delay = Math.min(options.initialDelay * Math.pow(options.backoffFactor, attempt), options.maxDelay);
      await new Promise(res => setTimeout(res, delay));
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
  const { validateMenu, filterRecipesForDay, violations } = useMenuBusinessRules();
  const { marketIngredients } = useMarketAvailability();

  /** ---------- Persistência local ---------- **/
  useEffect(() => {
    const stored = localStorage.getItem('current-generated-menu');
    if (stored) {
      try {
        const menu = JSON.parse(stored);
        if (menu.clientId === selectedClient?.id) setGeneratedMenu(menu);
        else localStorage.removeItem('current-generated-menu');
      } catch {
        localStorage.removeItem('current-generated-menu');
      }
    }
  }, [selectedClient?.id]);

  useEffect(() => {
    if (generatedMenu) localStorage.setItem('current-generated-menu', JSON.stringify(generatedMenu));
    else localStorage.removeItem('current-generated-menu');
  }, [generatedMenu]);

  useEffect(() => {
    setGeneratedMenu(null);
    localStorage.removeItem('current-generated-menu');
  }, [selectedClient?.id]);

  /** ---------- Utils ---------- **/
  const gerarSemanas = (inicio: Date, fim: Date, incluirFDS = false) => {
    const semanas: Record<string, any[]> = {};
    let currentDate = new Date(inicio);
    while (currentDate <= fim) {
      const weekKey = `semana-${format(currentDate, 'yyyy-MM-dd')}`;
      if (!semanas[weekKey]) semanas[weekKey] = [];
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
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
    const normalized = day.toLowerCase().trim();
    const dayMap: Record<string, string> = {
      'segunda': 'Segunda-feira', 'segunda-feira': 'Segunda-feira', 'monday': 'Segunda-feira', 'seg': 'Segunda-feira',
      'terça': 'Terça-feira', 'terca': 'Terça-feira', 'terça-feira': 'Terça-feira', 'tuesday': 'Terça-feira', 'ter': 'Terça-feira',
      'quarta': 'Quarta-feira', 'quarta-feira': 'Quarta-feira', 'wednesday': 'Quarta-feira', 'qua': 'Quarta-feira',
      'quinta': 'Quinta-feira', 'quinta-feira': 'Quinta-feira', 'thursday': 'Quinta-feira', 'qui': 'Quinta-feira',
      'sexta': 'Sexta-feira', 'sexta-feira': 'Sexta-feira', 'friday': 'Sexta-feira', 'sex': 'Sexta-feira'
    };
    return dayMap[normalized] || normalized;
  };

  const mapCategoryToMenuStructure = (category: string): string => {
    const c = category?.toLowerCase().trim();
    if (['prato_principal','proteina','principal','prato principal','pp1'].includes(c)) return 'PP1';
    if (['salada','verdura','verduras','folha','folhas'].includes(c)) return 'Salada';
    if (['guarnicao','guarnição','acompanhamento'].includes(c)) return 'Guarnição';
    if (['suco','bebida','refresco'].includes(c)) return 'Suco';
    if (c?.includes('arroz')) return 'Arroz';
    if (c?.includes('feijao') || c?.includes('feijão')) return 'Feijão';
    if (['sobremesa','doce','dessert'].includes(c)) return 'Sobremesa';
    return 'PP1';
  };

  /** ---------- Banco ---------- **/
  const loadSavedMenus = async () => {
    try {
      const { data, error } = await supabase.from('generated_menus').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const formatted: GeneratedMenu[] = (data as any[]).map(menu => ({
        id: menu.id,
        clientId: menu.client_id,
        clientName: menu.client_name,
        weekPeriod: menu.week_period,
        status: menu.status,
        totalCost: Number(menu.total_cost),
        costPerMeal: Number(menu.cost_per_meal),
        totalRecipes: Number(menu.total_recipes),
        recipes: menu.receitas_adaptadas || [],
        createdAt: menu.created_at,
        approvedBy: menu.approved_by,
        rejectedReason: menu.rejected_reason
      }));
      setSavedMenus(formatted);
    } catch (err) {
      console.error('Erro ao carregar menus:', err);
    }
  };

  const saveMenuToDatabase = async (menu: GeneratedMenu): Promise<string | null> => {
    try {
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
          receitas_adaptadas: menu.recipes   // 🔥 agora salva receitas
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    } catch (err) {
      console.error('Erro ao salvar:', err);
      return null;
    }
  };

  const deleteGeneratedMenu = async (menuId: string) => {
    try {
      await supabase.from('generated_menus').delete().eq('id', menuId);
      setSavedMenus(prev => prev.filter(m => m.id !== menuId));
      if (generatedMenu?.id === menuId) setGeneratedMenu(null);
      toast({ title: "Cardápio excluído", description: "Removido com sucesso" });
      return true;
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível excluir", variant: "destructive" });
      return false;
    }
  };

  /** ---------- Aprovar / rejeitar ---------- **/
  const approveMenu = async (menuId: string, approver: string) => {
    await supabase.from('generated_menus').update({ status: 'approved', approved_by: approver }).eq('id', menuId);
    if (generatedMenu?.id === menuId) setGeneratedMenu({ ...generatedMenu, status: 'approved', approvedBy: approver });
    await loadSavedMenus();
  };

  const rejectMenu = async (menuId: string, reason: string) => {
    await supabase.from('generated_menus').update({ status: 'rejected', rejected_reason: reason }).eq('id', menuId);
    if (generatedMenu?.id === menuId) setGeneratedMenu({ ...generatedMenu, status: 'rejected', rejectedReason: reason });
    await loadSavedMenus();
  };

  /** ---------- Lista de compras ---------- **/
  const generateShoppingListFromMenu = async (menu: GeneratedMenu) => {
    try {
      setIsGenerating(true);
      await supabase.functions.invoke('generate-shopping-list', {
        body: {
          menuId: menu.id,
          recipes: menu.recipes
        }
      });
      toast({ title: "Lista de compras gerada", description: "Com base no cardápio" });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearGeneratedMenu = () => {
    setGeneratedMenu(null);
    localStorage.removeItem('current-generated-menu');
  };
  const clearMenuExplicitly = () => { clearGeneratedMenu(); setError(null); };

  /** ---------- Geração ---------- **/
  const generateMenuWithFormData = async (formData: SimpleMenuFormData) => {
    if (isProcessing) return null;
    setIsProcessing(true);
    setIsGenerating(true);
    try {
      if (!selectedClient) throw new Error("Nenhum cliente selecionado");
      const startDate = parse(formData.period.start, 'yyyy-MM-dd', new Date());
      const endDate = parse(formData.period.end, 'yyyy-MM-dd', new Date());
      const weekPeriod = `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;

      const payload = { action: 'generate_menu', client_id: formData.clientId, week_period: weekPeriod };
      const { data, error } = await withRetry(
        () => supabase.functions.invoke('gpt-assistant', { body: payload }),
        { maxRetries: 3, initialDelay: 1000, maxDelay: 10000, backoffFactor: 2 }
      );
      if (error) throw error;
      const recipes = data.recipes || [];
      if (!recipes.length) throw new Error("Nenhuma receita gerada");

      const menu: GeneratedMenu = {
        id: crypto.randomUUID(),
        clientId: selectedClient.id,
        clientName: selectedClient.nome_fantasia,
        weekPeriod,
        status: 'pending_approval',
        totalCost: 0,
        costPerMeal: 0,
        totalRecipes: recipes.length,
        recipes,
        createdAt: new Date().toISOString(),
      } as any;

      setGeneratedMenu(menu);
      const savedId = await saveMenuToDatabase(menu);
      if (savedId) {
        menu.id = savedId;
        setGeneratedMenu(menu);
        await loadSavedMenus();
        toast({ title: "Cardápio gerado", description: `${menu.totalRecipes} receitas salvas` });
      }
      return menu;

    } catch (err: any) {
      setError(err.message);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
      setIsProcessing(false);
    }
  };

  const generateMenu = async (weekPeriod: string) => {
    return generateMenuWithFormData({
      clientId: selectedClient?.id,
      period: { start: weekPeriod, end: weekPeriod },
      mealsPerDay: 50
    } as SimpleMenuFormData);
  };

  return {
    isGenerating, generatedMenu, savedMenus, error,
    generateMenuWithFormData, generateMenu,
    approveMenu, rejectMenu, generateShoppingListFromMenu,
    clearGeneratedMenu, clearMenuExplicitly,
    loadSavedMenus, deleteGeneratedMenu,
    violations, validateMenu,
    validateMenuAndSetViolations: (recipes: any[]) => validateMenu(recipes),
    marketIngredients
  };
}