import { ContractClient } from '../contexts/ClientContractsContext';

export interface ClientCostDetails {
  id: string;
  cliente_id_legado: number;
  filial_id: number;
  nome_filial: string;
  razao_social: string;
  nome_fantasia: string;
  custo_total: number;
  custo_medio_semanal: number;
  
  // Daily cost breakdown
  RefCustoSegunda: number;
  RefCustoTerca: number;
  RefCustoQuarta: number;
  RefCustoQuinta: number;
  RefCustoSexta: number;
  RefCustoSabado: number;
  RefCustoDomingo: number;
  RefCustoDiaEspecial: number;
  
  // Cost validation controls
  QtdeRefeicoesUsarMediaValidarSimNao: boolean;
  PorcentagemLimiteAcimaMedia: number;
  
  // Request and type info
  solicitacao_filial_custo_id: number;
  solicitacao_compra_tipo_id: number;
  solicitacao_compra_tipo_descricao: string;
  
  // Metadata
  user_name: string;
  user_date_time: string;
  sync_at: string;
  created_at: string;
  updated_at: string;
}

export interface DailyCostBreakdown {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  special: number;
  average: number;
  weekTotal: number;
}

export interface CostValidationRules {
  useAverageValidation: boolean;
  maxPercentageAboveAverage: number;
  averageCost: number;
  maxAllowedCost: number;
}

export interface ClientWithCosts {
  client: ContractClient;
  costDetails: ClientCostDetails[];
  dailyCosts: DailyCostBreakdown;
  validationRules: CostValidationRules;
  totalBranches: number;
}

// Helper functions
export const calculateDailyCostBreakdown = (costDetails: ClientCostDetails[]): DailyCostBreakdown => {
  if (costDetails.length === 0) {
    return {
      monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0,
      saturday: 0, sunday: 0, special: 0, average: 0, weekTotal: 0
    };
  }

  // Calculate average across all branches
  const totals = costDetails.reduce((acc, cost) => ({
    monday: acc.monday + (cost.RefCustoSegunda || 0),
    tuesday: acc.tuesday + (cost.RefCustoTerca || 0),
    wednesday: acc.wednesday + (cost.RefCustoQuarta || 0),
    thursday: acc.thursday + (cost.RefCustoQuinta || 0),
    friday: acc.friday + (cost.RefCustoSexta || 0),
    saturday: acc.saturday + (cost.RefCustoSabado || 0),
    sunday: acc.sunday + (cost.RefCustoDomingo || 0),
    special: acc.special + (cost.RefCustoDiaEspecial || 0)
  }), {
    monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0,
    saturday: 0, sunday: 0, special: 0
  });

  const count = costDetails.length;
  const dailyCosts = {
    monday: totals.monday / count,
    tuesday: totals.tuesday / count,
    wednesday: totals.wednesday / count,
    thursday: totals.thursday / count,
    friday: totals.friday / count,
    saturday: totals.saturday / count,
    sunday: totals.sunday / count,
    special: totals.special / count,
    average: 0,
    weekTotal: 0
  };

  // Calculate week total and average
  dailyCosts.weekTotal = dailyCosts.monday + dailyCosts.tuesday + dailyCosts.wednesday + 
                        dailyCosts.thursday + dailyCosts.friday + dailyCosts.saturday + dailyCosts.sunday;
  dailyCosts.average = dailyCosts.weekTotal / 7;

  return dailyCosts;
};

export const calculateCostValidationRules = (costDetails: ClientCostDetails[]): CostValidationRules => {
  if (costDetails.length === 0) {
    return {
      useAverageValidation: false,
      maxPercentageAboveAverage: 0,
      averageCost: 0,
      maxAllowedCost: 0
    };
  }

  // Get validation rules from first record (should be consistent across branches)
  const firstRecord = costDetails[0];
  const averageCost = firstRecord.custo_medio_semanal || 0;
  const maxPercentage = firstRecord.PorcentagemLimiteAcimaMedia || 0;
  
  return {
    useAverageValidation: firstRecord.QtdeRefeicoesUsarMediaValidarSimNao || false,
    maxPercentageAboveAverage: maxPercentage,
    averageCost,
    maxAllowedCost: averageCost * (1 + maxPercentage / 100)
  };
};

export const getDayOfWeekCost = (dailyCosts: DailyCostBreakdown, dayOfWeek: string): number => {
  const dayMap: Record<string, keyof DailyCostBreakdown> = {
    'monday': 'monday',
    'tuesday': 'tuesday', 
    'wednesday': 'wednesday',
    'thursday': 'thursday',
    'friday': 'friday',
    'saturday': 'saturday',
    'sunday': 'sunday',
    'segunda': 'monday',
    'terça': 'tuesday',
    'quarta': 'wednesday',
    'quinta': 'thursday',
    'sexta': 'friday',
    'sábado': 'saturday',
    'domingo': 'sunday'
  };

  const day = dayMap[dayOfWeek.toLowerCase()];
  return day ? dailyCosts[day] : dailyCosts.average;
};