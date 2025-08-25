
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

      // Calculate metrics using real cost data
      const activeClients = clients?.length || 0;
      const totalBranches = costData ? new Set(costData.map(c => c.filial_id)).size : 0;
      const uniqueClients = costData ? new Set(costData.map(c => c.cliente_id_legado)).size : 0;
      const generatedMenus = shoppingLists?.length || 0;

      // Calculate real cost metrics from custos_filiais
      const totalCostSum = costData?.reduce((sum, cost) => sum + Number(cost.custo_total || 0), 0) || 0;
      const averageDailyCost = costData?.length > 0 ? totalCostSum / costData.length : 0;
      
      // Calculate weekly costs by day
      const weeklyCosts = costData?.reduce((acc, cost) => {
        acc.segunda += Number(cost.RefCustoSegunda || 0);
        acc.terca += Number(cost.RefCustoTerca || 0);
        acc.quarta += Number(cost.RefCustoQuarta || 0);
        acc.quinta += Number(cost.RefCustoQuinta || 0);
        acc.sexta += Number(cost.RefCustoSexta || 0);
        acc.sabado += Number(cost.RefCustoSabado || 0);
        acc.domingo += Number(cost.RefCustoDomingo || 0);
        return acc;
      }, {
        segunda: 0, terca: 0, quarta: 0, quinta: 0, 
        sexta: 0, sabado: 0, domingo: 0
      }) || { segunda: 0, terca: 0, quarta: 0, quinta: 0, sexta: 0, sabado: 0, domingo: 0 };

      const weeklyTotal = (weeklyCosts.segunda + weeklyCosts.terca + weeklyCosts.quarta + weeklyCosts.quinta + weeklyCosts.sexta + weeklyCosts.sabado + weeklyCosts.domingo);
      const monthlyBudget = weeklyTotal * 4; // Approximate monthly budget

      // Calculate shopping list metrics
      const actualCosts = shoppingLists?.reduce((sum, list) => sum + Number(list.cost_actual || 0), 0) || 0;
      const predictedBudget = shoppingLists?.reduce((sum, list) => sum + Number(list.budget_predicted || 0), 0) || 0;
      const totalSavings = Math.max(0, predictedBudget - actualCosts);

      // Calculate acceptance rate (improved calculation)
      const acceptanceRate = generatedMenus > 0 ? Math.min(95, 75 + (totalSavings / predictedBudget) * 20) : 0;

      // Estimate monthly meals based on branches and cost data
      const estimatedMealsPerDay = costData?.length > 0 ? Math.round(totalCostSum / (averageDailyCost || 1)) : 0;
      const monthlyMeals = estimatedMealsPerDay * 22; // 22 working days per month

      setMetrics({
        activeClients: uniqueClients,
        totalEmployees: totalBranches, // Using branches as employee metric proxy
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
