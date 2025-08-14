
import { useClientContractsContext } from '@/contexts/ClientContractsContext';
import type { ContractClient } from '@/contexts/ClientContractsContext';

export interface ContractFormData {
  clientId: string;
  period: {
    start: string;
    end: string;
  };
  estimatedMeals: number;
  mealsPerDay: number;
  budgetPerMeal: number;
  totalBudget: number;
  restrictions: string[];
  preferences: string;
  contractData: ContractClient | null;
}

export const useClientContracts = () => {
  const context = useClientContractsContext();

  // Calculate estimated meals for a period
  const calculateEstimatedMeals = (
    contract: ContractClient,
    startDate: string,
    endDate: string,
    employeeCount: number = 50,
    periodicidade: string = 'diario'
  ): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculate based on contract frequency
    switch (periodicidade) {
      case 'diario':
        return totalDays * employeeCount;
      case 'semanal':
        return Math.ceil(totalDays / 7) * employeeCount;
      case 'mensal':
        return Math.ceil(totalDays / 30) * employeeCount;
      default:
        return totalDays * employeeCount;
    }
  };

  // Validate contract completeness
  const validateContract = (contract: ContractClient): {
    isValid: boolean;
    warnings: string[];
  } => {
    const warnings: string[] = [];

    if (contract.custo_medio_diario <= 0) {
      warnings.push('Custo médio diário não definido');
    }

    if (!contract.nome_fantasia) {
      warnings.push('Nome da empresa não definido');
    }

    if (!contract.tipo_refeicao) {
      warnings.push('Tipo de refeição não definido');
    }

    return {
      isValid: warnings.length === 0,
      warnings
    };
  };

  // Generate AI context summary
  const generateAIContextSummary = (formData: ContractFormData): string => {
    const contract = formData.contractData;
    if (!contract) return '';

    const restrictionsText = formData.restrictions.length > 0 
      ? `restrições: ${formData.restrictions.join(', ')}`
      : 'sem restrições específicas';

    const preferencesText = formData.preferences 
      ? `preferências: ${formData.preferences}`
      : '';

    const periodText = `período de ${new Date(formData.period.start).toLocaleDateString()} a ${new Date(formData.period.end).toLocaleDateString()}`;

    return `Cliente ${contract.nome_fantasia} requer ${formData.estimatedMeals} refeições no ${periodText}. ` +
           `Orçamento total de R$ ${formData.totalBudget.toFixed(2)} (R$ ${formData.budgetPerMeal.toFixed(2)} por refeição). ` +
           `Contrato com ${restrictionsText}. ${preferencesText}. ` +
           `Tipo de refeição: ${contract.tipo_refeicao}. Custo médio diário: R$ ${contract.custo_medio_diario.toFixed(2)}.`;
  };

  return {
    ...context,
    calculateEstimatedMeals,
    validateContract,
    generateAIContextSummary
  };
};
