import { ClientCostDetails } from "@/types/clientCosts";

// ========================================================
// TIPOS PARA MENU GENERATION
// ========================================================

export interface MenuRequest {
  cliente: string;
  periodo_dias: number;
  refeicoes_por_dia: number;
  orcamento_por_refeicao: number;
  receitas_fixas?: string[];
  receitas_sugeridas?: string[];
}

export interface IngredientCost {
  nome: string;
  produto_base_id: number;
  quantidade_necessaria: number;
  quantidade_comprar: number;
  unidade: string;
  preco_unitario: number;
  custo_total: number;
  custo_por_refeicao: number;
  custo_utilizado: number;
  fornecedor: string;
  em_promocao: boolean;
  sobra: number;
  percentual_sobra: number;
  compra_inteira: boolean;
}

export interface RecipeCost {
  receita_id: number;
  nome: string;
  categoria?: string;
  porcoes_base: number;
  porcoes_calculadas: number;
  ingredientes: IngredientCost[];
  ingredientes_sem_preco: string[];
  custo_total: number;
  custo_por_porcao: number;
  dentro_orcamento: boolean;
  precisao_calculo: number;
  avisos: string[];
}

export interface ShoppingListItem {
  produto_base_id: number;
  nome: string;
  quantidade_total: number;
  unidade: string;
  preco_unitario: number;
  custo_total: number;
  fornecedor: string;
  em_promocao: boolean;
  receitas: string[];
  observacao?: string;
}

export interface MenuResult {
  cliente: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  total_refeicoes: number;
  refeicoes_por_dia: number;
  orcamento_total: number;
  orcamento_por_refeicao: number;

  receitas: {
    fixas: RecipeCost[];
    principais: RecipeCost[];
    acompanhamentos: RecipeCost[];
  };

  resumo_custos: {
    custo_total_calculado: number;
    custo_por_refeicao: number;
    economia_total: number;
    economia_percentual: number;
    dentro_orcamento: boolean;
  };

  lista_compras: {
    itens: ShoppingListItem[];
    total_itens: number;
    custo_total: number;
    itens_promocao: number;
    economia_promocoes: number;
  };

  avisos: string[];
  metadata: {
    generated_at: string;
    calculation_time_ms: number;
    precision_percentage: number;
  };
}

// ========================================================
// FUNÇÕES DE MÉTRICAS CONTRATUAIS
// ========================================================

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

export const calculateAverageDailyCost = (
  costData: ClientCostDetails
): number => {
  const weeklyTotal = calculateWeeklyTotalFromDailyCosts(costData);
  return weeklyTotal / 7;
};

export const getUniqueClientsCount = (
  costData: ClientCostDetails[]
): number => {
  return new Set(costData.map((c) => c.filial_id)).size;
};

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

  const totalWeeklyCost = costData.reduce(
    (sum, cost) => sum + calculateWeeklyTotalFromDailyCosts(cost),
    0
  );

  const averageCostPerClient = totalWeeklyCost / costData.length;

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

export const calculateContractMealCost = (
  dailyCost: number,
  mealsPerDay: number = 1
): number => {
  if (!dailyCost || !mealsPerDay || mealsPerDay <= 0) return 0;
  return dailyCost / mealsPerDay;
};

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

// ========================================================
// PROXY PARA EDGE FUNCTION (MENU GENERATION)
// ========================================================

export async function generateMenu(request: MenuRequest): Promise<MenuResult> {
  console.log("🍽️ [Frontend] Chamando Edge Function:", request);

  const response = await fetch("/functions/v1/gpt-assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      action: "generate_menu",
      request,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Erro na Edge Function:", errorText);
    throw new Error(`Erro na geração do menu: ${response.statusText}`);
  }

  return response.json();
}

export async function calculateRecipeCost(
  recipeId: number,
  servings: number = 100,
  days: number = 1,
  budgetPerServing?: number
): Promise<RecipeCost> {
  console.log("🧮 [Frontend] Calculando custo de receita:", {
    recipeId,
    servings,
    days,
  });

  const response = await fetch("/functions/v1/gpt-assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      action: "calculate_recipe_cost",
      recipeId,
      servings,
      days,
      budgetPerServing,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Erro no cálculo de receita:", errorText);
    throw new Error(`Erro no cálculo: ${response.statusText}`);
  }

  return response.json();
}