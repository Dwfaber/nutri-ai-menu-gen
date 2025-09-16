import { ClientCostDetails } from "@/types/clientCosts";

/**
 * Calcula o custo semanal total a partir dos custos diários
 * Ignora o campo custo_total pois ele está sempre zerado nos registros
 */
export const calculateWeeklyTotalFromDailyCosts = (
  costData: ClientCostDetails
): number => {
  const dailyCosts = [
    costData.RefCustoSegunda,
    costData.RefCustoTerca,
    costData.RefCustoQuarta,
    costData.RefCustoQuinta,
    costData.RefCustoSexta,
    costData.RefCustoSabado,
    costData.RefCustoDomingo,
  ].map((c) => Number(c) || 0);

  return dailyCosts.reduce((sum, cost) => sum + cost, 0);
};

/**
 * Calcula o custo diário médio a partir dos custos diários
 */
export const calculateAverageDailyCost = (
  costData: ClientCostDetails
): number => {
  const weeklyTotal = calculateWeeklyTotalFromDailyCosts(costData);
  return weeklyTotal / 7;
};

/**
 * Retorna a contagem de clientes únicos usando filial_id
 * (já que cliente_id_legado é nulo)
 */
export const getUniqueClientsCount = (
  costData: ClientCostDetails[]
): number => {
  return new Set(costData.map((c) => c.filial_id)).size;
};

/**
 * Calcula métricas agregadas de custos para vários registros de clientes
 */
export const calculateCostMetrics = (costData: ClientCostDetails[]) => {
  if (!costData || costData.length === 0) {
    return {
      totalWeeklyCost: 0,
      averageCostPerClient: 0,
      totalDailyCosts: {
        segunda: 0,
        terca: 0,
        quarta: 0,
        quinta: 0,
        sexta: 0,
        sabado: 0,
        domingo: 0,
      },
    };
  }

  // Total semanal somando todos os clientes
  const totalWeeklyCost = costData.reduce(
    (sum, cost) => sum + calculateWeeklyTotalFromDailyCosts(cost),
    0
  );

  // Média por cliente
  const averageCostPerClient = totalWeeklyCost / costData.length;

  // Custos totais por dia
  const totalDailyCosts = costData.reduce(
    (acc, cost) => {
      acc.segunda += Number(cost.RefCustoSegunda) || 0;
      acc.terca += Number(cost.RefCustoTerca) || 0;
      acc.quarta += Number(cost.RefCustoQuarta) || 0;
      acc.quinta += Number(cost.RefCustoQuinta) || 0;
      acc.sexta += Number(cost.RefCustoSexta) || 0;
      acc.sabado += Number(cost.RefCustoSabado) || 0;
      acc.domingo += Number(cost.RefCustoDomingo) || 0;
      return acc;
    },
    {
      segunda: 0,
      terca: 0,
      quarta: 0,
      quinta: 0,
      sexta: 0,
      sabado: 0,
      domingo: 0,
    }
  );

  return {
    totalWeeklyCost,
    averageCostPerClient,
    totalDailyCosts,
  };
};

/**
 * Calcula o custo contratual por refeição a partir do custo diário
 */
export const calculateContractMealCost = (
  dailyCost: number,
  mealsPerDay: number = 1
): number => {
  if (!dailyCost || !mealsPerDay || mealsPerDay <= 0) return 0;
  return dailyCost / mealsPerDay;
};

/**
 * Retorna os clientes mais caros baseado no custo semanal total
 */
export const getTopExpensiveClients = (
  costData: ClientCostDetails[],
  limit: number = 5
): Array<{ name: string; cost: number; filial_id: number }> => {
  return costData
    .map((cost) => ({
      name: cost.nome_fantasia || cost.razao_social || "Cliente Desconhecido",
      cost: calculateWeeklyTotalFromDailyCosts(cost),
      filial_id: cost.filial_id || 0,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
};