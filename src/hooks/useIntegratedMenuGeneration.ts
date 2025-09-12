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

      if (attempt === options.maxRetries) break;

      const delay = Math.min(
        options.initialDelay * Math.pow(options.backoffFactor, attempt),
        options.maxDelay
      );

      console.log(`Tentativa ${attempt + 1} falhou, tentando em ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Erro desconhecido com retry');
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

  // Persistência local
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

  useEffect(() => {
    setGeneratedMenu(null);
    localStorage.removeItem('current-generated-menu');
  }, [selectedClient?.id]);

  // Helpers
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

  // 🔥 corrigido aqui
  const toDayKey = (day: unknown): string => {
    if (!day || typeof day !== 'string') return '';

    const normalized = day.toLowerCase().trim();
    const dayMap: Record<string, string> = {
      'segunda': 'Segunda-feira',
      'segunda-feira': 'Segunda-feira',
      'monday': 'Segunda-feira',
      'seg': 'Segunda-feira',
      'terça': 'Terça-feira',
      'terca': 'Terça-feira',
      'terça-feira': 'Terça-feira',
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
      'sex': 'Sexta-feira',
      'sabado': 'Sábado',
      'sábado': 'Sábado',
      'saturday': 'Sábado',
      'domingo': 'Domingo',
      'sunday': 'Domingo'
    };

    return dayMap[normalized] || normalized;
  };

  const mapCategoryToMenuStructure = (category: string): string => {
    if (!category) return 'PP1';
    const normalizedCategory = category.toLowerCase().trim();

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

    if (categoryMap[normalizedCategory]) return categoryMap[normalizedCategory];
    if (normalizedCategory.includes('prato') || normalizedCategory.includes('principal') || normalizedCategory.includes('proteina')) return 'PP1';
    if (normalizedCategory.includes('salada') || normalizedCategory.includes('verdura') || normalizedCategory.includes('folha')) return 'Salada';
    if (normalizedCategory.includes('guarnicao') || normalizedCategory.includes('guarnição') || normalizedCategory.includes('acompanhamento')) return 'Guarnição';
    if (normalizedCategory.includes('suco') || normalizedCategory.includes('bebida')) return 'Suco';
    if (normalizedCategory.includes('arroz')) return 'Arroz';
    if (normalizedCategory.includes('feijao') || normalizedCategory.includes('feijão')) return 'Feijão';
    if (normalizedCategory.includes('sobremesa') || normalizedCategory.includes('doce')) return 'Sobremesa';

    return 'PP1';
  };

  // ... resto do hook (saveMenuToDatabase, deleteGeneratedMenu,
  // generateMenuWithFormData, generateMenu, approve, reject etc.)
  // ⚠️ Mantenha igual ao último arquivo que já ajustamos juntos

  return {
    isGenerating,
    generatedMenu,
    savedMenus,
    error,
    generateMenuWithFormData,
    // ... tudo que já estava sendo retornado
    violations,
    validateMenu,
    validateMenuAndSetViolations: (recipes: any[]) => validateMenu(recipes),
    marketIngredients
  };
}