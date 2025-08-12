
import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

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

      // Fetch shopping lists for menu count
      const { data: shoppingLists, error: shoppingError } = await supabase
        .from('shopping_lists')
        .select('*');

      if (shoppingError) {
        throw new Error(shoppingError.message);
      }

      // Calculate metrics (adapted to contratos_corporativos schema)
      const activeClients = clients?.length || 0;
      const totalEmployees = 0; // Not available in contratos_corporativos
      const monthlyMeals = 0;   // Not available in contratos_corporativos
      const generatedMenus = shoppingLists?.length || 0;

      // Derive budget/costs from shopping lists
      const actualCosts = shoppingLists?.reduce((sum, list) => sum + Number(list.cost_actual || 0), 0) || 0;
      const predictedBudget = shoppingLists?.reduce((sum, list) => sum + Number(list.budget_predicted || 0), 0) || 0;
      const monthlyBudget = predictedBudget;
      const averageMealCost = generatedMenus > 0 ? actualCosts / generatedMenus : 0;
      const totalSavings = Math.max(0, predictedBudget - actualCosts);

      // Calculate acceptance rate (mock calculation - in real scenario would come from user feedback)
      const acceptanceRate = generatedMenus > 0 ? 85 : 0; // Mock 85% acceptance rate

      setMetrics({
        activeClients,
        totalEmployees,
        monthlyMeals,
        averageMealCost,
        monthlyBudget,
        generatedMenus,
        totalSavings,
        acceptanceRate
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
