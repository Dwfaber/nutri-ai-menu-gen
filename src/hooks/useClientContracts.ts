import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface ContractClient {
  id: string;
  cliente_id_legado: string;
  nome_empresa: string;
  total_funcionarios: number;
  custo_maximo_refeicao: number;
  total_refeicoes_mes: number;
  restricoes_alimentares: string[];
  periodicidade: string;
  ativo: boolean;
  created_at: string;
  sync_at: string;
}

export interface ContractFormData {
  clientId: string;
  period: {
    start: string;
    end: string;
  };
  estimatedMeals: number;
  budgetPerMeal: number;
  totalBudget: number;
  restrictions: string[];
  preferences: string;
  contractData: ContractClient | null;
}

export const useClientContracts = () => {
  const [clients, setClients] = useState<ContractClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load all clients from contracts table
  const loadClients = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('contratos_corporativos')
        .select('*')
        .eq('ativo', true)
        .order('nome_empresa');

      if (queryError) {
        throw new Error(queryError.message);
      }

      setClients(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar clientes';
      setError(errorMessage);
      toast({
        title: "Erro ao Carregar Clientes",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get specific client contract details
  const getClientContract = async (clientId: string): Promise<ContractClient | null> => {
    try {
      const { data, error: queryError } = await supabase
        .from('contratos_corporativos')
        .select('*')
        .eq('id', clientId)
        .single();

      if (queryError) {
        throw new Error(queryError.message);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar contrato';
      setError(errorMessage);
      toast({
        title: "Erro ao Carregar Contrato",
        description: errorMessage,
        variant: "destructive"
      });
      return null;
    }
  };

  // Calculate estimated meals for a period
  const calculateEstimatedMeals = (
    contract: ContractClient,
    startDate: string,
    endDate: string
  ): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Assuming 5 working days per week
    const workingDays = Math.ceil((days / 7) * 5);
    
    // Calculate based on contract frequency
    switch (contract.periodicidade) {
      case 'diario':
        return workingDays * contract.total_funcionarios;
      case 'semanal':
        return Math.ceil(workingDays / 7) * contract.total_funcionarios;
      case 'mensal':
        return Math.ceil(days / 30) * contract.total_refeicoes_mes;
      default:
        return workingDays * contract.total_funcionarios;
    }
  };

  // Validate contract completeness
  const validateContract = (contract: ContractClient): {
    isValid: boolean;
    warnings: string[];
  } => {
    const warnings: string[] = [];

    if (!contract.ativo) {
      warnings.push('Contrato inativo');
    }

    if (contract.custo_maximo_refeicao <= 0) {
      warnings.push('Custo máximo por refeição não definido');
    }

    if (contract.total_funcionarios <= 0) {
      warnings.push('Número de funcionários não definido');
    }

    if (!contract.restricoes_alimentares || contract.restricoes_alimentares.length === 0) {
      warnings.push('Restrições alimentares não definidas');
    }

    if (!contract.periodicidade) {
      warnings.push('Periodicidade do contrato não definida');
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

    return `Cliente ${contract.nome_empresa} requer ${formData.estimatedMeals} refeições no ${periodText}. ` +
           `Orçamento total de R$ ${formData.totalBudget.toFixed(2)} (R$ ${formData.budgetPerMeal.toFixed(2)} por refeição). ` +
           `Contrato com ${restrictionsText}. ${preferencesText}. ` +
           `Periodicidade: ${contract.periodicidade}. ${contract.total_funcionarios} funcionários.`;
  };

  useEffect(() => {
    loadClients();
  }, []);

  return {
    clients,
    isLoading,
    error,
    loadClients,
    getClientContract,
    calculateEstimatedMeals,
    validateContract,
    generateAIContextSummary
  };
};