import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MenuDay {
  date: string;
  recipes: Array<{
    receita_id: string;
    nome: string;
    meals_quantity: number;
  }>;
}

interface OptimizedPurchase {
  produto_base_id: number;
  nome: string;
  total_needed: number;
  packages_to_buy: number;
  total_quantity_bought: number;
  total_cost: number;
  cost_per_unit: number;
  surplus: number;
  packaging_info: {
    descricao: string;
    quantidade_embalagem: number;
    preco: number;
    preco_compra: number;
    apenas_valor_inteiro: boolean;
    em_promocao: boolean;
  };
  daily_distribution: Array<{
    date: string;
    quantity_used: number;
    cost_allocated: number;
  }>;
}

interface OptimizationSummary {
  total_cost: number;
  cost_per_meal: number;
  total_meals: number;
  total_products: number;
  promotional_items: number;
  estimated_savings: number;
  savings_percentage: number;
  surplus_info: {
    total_surplus: number;
    products_with_surplus: number;
  };
}

interface OptimizationResult {
  optimized_purchases: OptimizedPurchase[];
  summary: OptimizationSummary;
  total_meals: number;
}

export function useMenuOptimization() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const optimizeMenuPurchases = async (menuDays: MenuDay[], totalMeals: number) => {
    setIsOptimizing(true);
    setError(null);

    try {
      console.log('🚀 Iniciando otimização de compras para', menuDays.length, 'dias');

      const { data, error: functionError } = await supabase.functions.invoke('optimize-menu-purchases', {
        body: {
          menu_days: menuDays,
          total_meals: totalMeals
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido na otimização');
      }

      setOptimizationResult(data);
      
      toast({
        title: "Otimização Concluída",
        description: `Economia estimada: R$ ${data.summary.estimated_savings.toFixed(2)} (${data.summary.savings_percentage.toFixed(1)}%)`,
      });

      console.log('✅ Otimização concluída:', data.summary);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na otimização';
      setError(errorMessage);
      
      toast({
        title: "Erro na Otimização",
        description: errorMessage,
        variant: "destructive",
      });

      console.error('❌ Erro na otimização:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const resetOptimization = () => {
    setOptimizationResult(null);
    setError(null);
  };

  const getOptimizedCostPerMeal = (date: string, recipeName: string): number | null => {
    if (!optimizationResult) return null;

    // Buscar custo otimizado para esta data
    const dayTotal = optimizationResult.optimized_purchases.reduce((total, purchase) => {
      const dayDistribution = purchase.daily_distribution.find(d => d.date === date);
      return total + (dayDistribution?.cost_allocated || 0);
    }, 0);

    // Contar dias únicos para calcular refeições por dia
    const uniqueDays = new Set(
      optimizationResult.optimized_purchases.flatMap(p => p.daily_distribution.map(d => d.date))
    ).size;
    
    if (uniqueDays === 0) return null;

    // Retornar custo médio por refeição do dia
    return dayTotal / (optimizationResult.summary.total_meals / uniqueDays);
  };

  return {
    isOptimizing,
    optimizationResult,
    error,
    optimizeMenuPurchases,
    resetOptimization,
    getOptimizedCostPerMeal
  };
}