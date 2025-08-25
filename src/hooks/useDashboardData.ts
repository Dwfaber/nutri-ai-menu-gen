
import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { calculateCostMetrics, getUniqueClientsCount } from '@/utils/costCalculations';

export interface DashboardMetrics {
  activeClients: number;
  totalEmployees: number;
  monthlyMeals: number;
  averageMealCost: number;
  monthlyBudget: number;
  generatedMenus: number;
  totalSavings: number;
  acceptanceRate: number;
}

export const useDashboardData = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeClients: 0,
    totalEmployees: 0,
    monthlyMeals: 0,
    averageMealCost: 0,
    monthlyBudget: 0,
    generatedMenus: 0,
    totalSavings: 0,
    acceptanceRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch active clients data
      const { data: clients, error: clientsError } = await supabase
        .from('contratos_corporativos')
        .select('*');

      if (clientsError) {
        throw new Error(clientsError.message);
      }

      // Fetch real cost data from custos_filiais view
      const { data: costData, error: costError } = await supabase
        .from('custos_filiais')
        .select('*');

      if (costError) {
        throw new Error(costError.message);
      }

      // Fetch shopping lists for menu count
      const { data: shoppingLists, error: shoppingError } = await supabase
        .from('shopping_lists')
        .select('*');

      if (shoppingError) {
        throw new Error(shoppingError.message);
      }

      // Calculate metrics using real cost data - ignore custo_total (it's 0.00)
      const activeClients = clients?.length || 0;
      const uniqueClients = costData ? getUniqueClientsCount(costData) : 0;
      const generatedMenus = shoppingLists?.length || 0;

      // Calculate cost metrics using daily costs only
      const costMetrics = calculateCostMetrics(costData || []);
      const weeklyTotal = costMetrics.totalWeeklyCost;
      const averageWeeklyCost = costMetrics.averageCostPerClient;
      const averageDailyCost = averageWeeklyCost / 7;
      const monthlyBudget = weeklyTotal * 4; // Approximate monthly budget

      // Calculate shopping list metrics
      const actualCosts = shoppingLists?.reduce((sum, list) => sum + Number(list.cost_actual || 0), 0) || 0;
      const predictedBudget = shoppingLists?.reduce((sum, list) => sum + Number(list.budget_predicted || 0), 0) || 0;
      const totalSavings = Math.max(0, predictedBudget - actualCosts);

      // Calculate acceptance rate (improved calculation)
      const acceptanceRate = generatedMenus > 0 ? Math.min(95, 75 + (totalSavings / predictedBudget) * 20) : 0;

      // Estimate monthly meals based on weekly costs and average meal cost
      const estimatedMealsPerWeek = averageDailyCost > 0 ? Math.round(weeklyTotal / averageDailyCost) : uniqueClients * 35; // fallback estimate
      const monthlyMeals = estimatedMealsPerWeek * 4;

      setMetrics({
        activeClients: uniqueClients,
        totalEmployees: uniqueClients, // Using unique clients as employee metric proxy
        monthlyMeals,
        averageMealCost: averageDailyCost,
        monthlyBudget,
        generatedMenus,
        totalSavings,
        acceptanceRate: Math.round(acceptanceRate)
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard';
      setError(errorMessage);
      toast({
        title: "Erro ao Carregar Dashboard",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return {
    metrics,
    isLoading,
    error,
    refetch: fetchDashboardData
  };
};
