/**
 * Hook central para geração integrada de cardápios (menus)
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

// Função retry para chamadas instáveis
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
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError ?? new Error('Erro desconhecido no retry');
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

  /** ---------- Utilidades ---------- **/

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
    if (!day || typeof day !== 'string') return '';
    const normalized = day.toLowerCase().trim();

    const dayMap: Record<string, string> = {
      'segunda': 'Segunda-feira',
      'segunda-feira': 'Segunda-feira',
      'monday': 'Segunda-feira',
      'terça': 'Terça-feira',
      'tuesday': 'Terça-feira',
      'quarta': 'Quarta-feira',
      'wednesday': 'Quarta-feira',
      'quinta': 'Quinta-feira',
      'thursday': 'Quinta-feira',
      'sexta': 'Sexta-feira',
      'friday': 'Sexta-feira',
      'sábado': 'Sábado',
      'sabado': 'Sábado',
      'saturday': 'Sábado',
      'domingo': 'Domingo',
      'sunday': 'Domingo'
    };

    return dayMap[normalized] || normalized;
  };

  /** ---------- Persistência ---------- **/
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

  /** ---------- CRUD no Supabase ---------- **/

  const loadSavedMenus = async () => {
    try {
      const { data, error } = await supabase.from('generated_menus').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setSavedMenus(data as any);
    } catch (err) {
      console.error('Erro ao carregar menus:', err);
    }
  };

  const saveMenuToDatabase = async (menu: GeneratedMenu): Promise<string | null> => {
    try {
      const { data, error } = await supabase.from('generated_menus')
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

      if (error) throw error;
      return data.id;
    } catch (err) {
      console.error('Erro ao salvar menu:', err);
      return null;
    }
  };

  const deleteGeneratedMenu = async (menuId: string) => {
    try {
      await supabase.from('generated_menus').delete().eq('id', menuId);
      setSavedMenus(prev => prev.filter(m => m.id !== menuId));
      if (generatedMenu?.id === menuId) setGeneratedMenu(null);
      toast({ title: "Menu excluído", description: "Cardápio removido com sucesso" });
    } catch {
      toast({ title: "Erro ao excluir", description: "Não foi possível excluir", variant: "destructive" });
    }
  };

  const approveMenu = async (menuId: string, approver: string) => {
    await supabase.from('generated_menus').update({ status: 'approved', approved_by: approver }).eq('id', menuId);
    if (generatedMenu?.id === menuId) {
      setGeneratedMenu({ ...generatedMenu, status: 'approved', approvedBy: approver, approvedAt: new Date().toISOString() });
    }
    await loadSavedMenus();
  };

  const rejectMenu = async (menuId: string, reason: string) => {
    await supabase.from('generated_menus').update({ status: 'rejected', rejected_reason: reason }).eq('id', menuId);
    if (generatedMenu?.id === menuId) setGeneratedMenu({ ...generatedMenu, status: 'rejected', rejectedReason: reason });
    await loadSavedMenus();
  };

  const generateShoppingListFromMenu = async (menu: GeneratedMenu) => {
    setIsGenerating(true);
    try {
      await supabase.functions.invoke('generate-shopping-list', { body: { menuId: menu.id, recipes: menu.recipes } });
      toast({ title: "Lista de compras gerada", description: "Com base no cardápio aprovado" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível gerar lista", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearGeneratedMenu = () => {
    setGeneratedMenu(null);
    localStorage.removeItem('current-generated-menu');
  };

  const clearMenuExplicitly = () => {
    clearGeneratedMenu();
    setError(null);
  };

  /** ---------- Geração de Menu ---------- **/
  const generateMenuWithFormData = async (formData: SimpleMenuFormData): Promise<GeneratedMenu | null> => {
    // ... implementação de chamada à Edge Function (igual versão anterior)
    return null; // aqui mantém placeholder porque foco é no retorno
  };

  const generateMenu = async (
    weekPeriod: string,
    preferences?: string[],
    clientOverride?: any,
    mealsPerDay?: number,
    totalMeals?: number
  ) => {
    // monta SimpleMenuFormData e delega para generateMenuWithFormData
  };

  /** ---------- Retorno do Hook ---------- **/
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
    violations,
    validateMenu,
    validateMenuAndSetViolations: (recipes: any[]) => validateMenu(recipes),
    marketIngredients
  };
}