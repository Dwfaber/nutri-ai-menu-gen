import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RecipeCost {
  receita_id: string;
  nome: string;
  categoria: string;
  custo_total: number;
  custo_por_porcao: number;
  total_ingredientes: number;
}

interface CostCache {
  [key: string]: {
    cost: number;
    timestamp: number;
    data: RecipeCost;
  };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useRealTimeCosts() {
  const [costCache, setCostCache] = useState<CostCache>({});
  const [isLoading, setIsLoading] = useState(false);

  const calculateRecipeCost = useCallback(async (
    receitaId: string, 
    mealQuantity: number = 50
  ): Promise<RecipeCost | null> => {
    const cacheKey = `${receitaId}-${mealQuantity}`;
    const cached = costCache[cacheKey];
    
    // Check cache validity
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('calculate-recipe-cost', {
        body: {
          receita_id: receitaId,
          meal_quantity: mealQuantity
        }
      });

      if (error) {
        console.error('Erro ao calcular custo da receita:', error);
        return null;
      }

      if (!data?.success) {
        console.error('Falha no cálculo:', data?.error);
        return null;
      }

      const recipeCost = data.data;
      
      // Update cache
      setCostCache(prev => ({
        ...prev,
        [cacheKey]: {
          cost: recipeCost.custo_por_porcao,
          timestamp: Date.now(),
          data: recipeCost
        }
      }));

      return recipeCost;
    } catch (error) {
      console.error('Erro na chamada da função:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [costCache]);

  const getCachedCost = useCallback((receitaId: string, mealQuantity: number = 50): number | null => {
    const cacheKey = `${receitaId}-${mealQuantity}`;
    const cached = costCache[cacheKey];
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.cost;
    }
    
    return null;
  }, [costCache]);

  const clearCache = useCallback(() => {
    setCostCache({});
  }, []);

  return {
    calculateRecipeCost,
    getCachedCost,
    clearCache,
    isLoading,
    cacheSize: Object.keys(costCache).length
  };
}