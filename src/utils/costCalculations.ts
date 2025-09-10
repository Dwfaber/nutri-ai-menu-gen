import { ClientCostDetails } from '@/types/clientCosts';

/**
 * Calculate total weekly cost from daily costs
 * Ignores custo_total field as it's 0.00 for all records
 */
export const calculateWeeklyTotalFromDailyCosts = (costData: ClientCostDetails): number => {
  const dailyCosts = [
    costData.RefCustoSegunda || 0,
    costData.RefCustoTerca || 0,
    costData.RefCustoQuarta || 0,
    costData.RefCustoQuinta || 0,
    costData.RefCustoSexta || 0,
    costData.RefCustoSabado || 0,
    costData.RefCustoDomingo || 0
  ];
  
  return dailyCosts.reduce((sum, cost) => sum + Number(cost), 0);
};

/**
 * Calculate average daily cost from daily costs
 */
export const calculateAverageDailyCost = (costData: ClientCostDetails): number => {
  const weeklyTotal = calculateWeeklyTotalFromDailyCosts(costData);
  return weeklyTotal / 7;
};

/**
 * Get unique clients count using filial_id since cliente_id_legado is null
 */
export const getUniqueClientsCount = (costData: ClientCostDetails[]): number => {
  return new Set(costData.map(c => c.filial_id)).size;
};

/**
 * Calculate cost metrics for multiple cost records
 */
export const calculateCostMetrics = (costData: ClientCostDetails[]) => {
  if (!costData || costData.length === 0) {
    return {
      totalWeeklyCost: 0,
      averageCostPerClient: 0,
      totalDailyCosts: {
        segunda: 0, terca: 0, quarta: 0, quinta: 0,
        sexta: 0, sabado: 0, domingo: 0
      }
    };
  }

  // Calculate total weekly cost across all clients
  const totalWeeklyCost = costData.reduce((sum, cost) => {
    return sum + calculateWeeklyTotalFromDailyCosts(cost);
  }, 0);

  // Calculate average cost per client
  const averageCostPerClient = totalWeeklyCost / costData.length;

  // Calculate total costs by day
  const totalDailyCosts = costData.reduce((acc, cost) => {
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
  });

  return {
    totalWeeklyCost,
    averageCostPerClient,
    totalDailyCosts
  };
};

/**
 * Calculate contractual cost per meal from daily cost
 */
export const calculateContractMealCost = (dailyCost: number, mealsPerDay: number = 1): number => {
  if (!dailyCost || !mealsPerDay || mealsPerDay <= 0) return 0;
  return dailyCost / mealsPerDay;
};

/**
 * Get top expensive clients based on weekly total from daily costs
 */
export const getTopExpensiveClients = (
  costData: ClientCostDetails[], 
  limit: number = 5
): Array<{ name: string; cost: number; filial_id: number }> => {
  return costData
    .map(cost => ({
      name: cost.nome_fantasia || cost.razao_social || 'Cliente Desconhecido',
      cost: calculateWeeklyTotalFromDailyCosts(cost),
      filial_id: cost.filial_id || 0
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
};