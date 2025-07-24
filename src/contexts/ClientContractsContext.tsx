
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { 
  ClientCostDetails, 
  ClientWithCosts, 
  DailyCostBreakdown, 
  CostValidationRules,
  calculateDailyCostBreakdown,
  calculateCostValidationRules
} from '@/types/clientCosts';

export interface ContractClient {
  id: string;
  cliente_id_legado: string;
  nome_empresa: string;
  total_funcionarios: number;
  custo_maximo_refeicao: number;
  restricoes_alimentares: string[];
  periodicidade: 'diario' | 'semanal' | 'mensal';
  total_refeicoes_mes: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface ClientContractsContextType {
  clients: ContractClient[];
  clientsWithCosts: ClientWithCosts[];
  isLoading: boolean;
  error: string | null;
  refreshClients: () => Promise<void>;
  getClientById: (id: string) => ContractClient | null;
  getClientWithCosts: (id: string) => ClientWithCosts | null;
  getClientContract: (clientId: string) => Promise<ContractClient | null>;
  getClientCostDetails: (clientId: string) => Promise<ClientCostDetails[]>;
}

const ClientContractsContext = createContext<ClientContractsContextType | undefined>(undefined);

export const ClientContractsProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useState<ContractClient[]>([]);
  const [clientsWithCosts, setClientsWithCosts] = useState<ClientWithCosts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshClients = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Select explícito das colunas necessárias
      const { data, error: fetchError } = await supabase
        .from('contratos_corporativos_v2')
        .select(`
          id,
          cliente_id_legado,
          nome_empresa,
          total_funcionarios,
          custo_maximo_refeicao,
          restricoes_alimentares,
          periodicidade,
          total_refeicoes_mes,
          ativo,
          created_at,
          sync_at
        `)
        .order('nome_empresa');

      if (fetchError) {
        throw fetchError;
      }

      // Transform data to match ContractClient interface
      const transformedData: ContractClient[] = (data || []).map(item => ({
        id: item.id,
        cliente_id_legado: item.cliente_id_legado,
        nome_empresa: item.nome_empresa,
        total_funcionarios: item.total_funcionarios,
        custo_maximo_refeicao: Number(item.custo_maximo_refeicao),
        restricoes_alimentares: item.restricoes_alimentares || [],
        periodicidade: item.periodicidade as 'diario' | 'semanal' | 'mensal',
        total_refeicoes_mes: item.total_refeicoes_mes,
        ativo: item.ativo,
        created_at: item.created_at,
        updated_at: item.sync_at // Using sync_at as updated_at since that's what exists in the table
      }));

      setClients(transformedData);

      // Load cost details for each client
      await loadClientsWithCosts(transformedData);
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

  const loadClientsWithCosts = async (clientList: ContractClient[]) => {
    try {
      const clientsWithCostsData: ClientWithCosts[] = [];

      for (const client of clientList) {
        const costDetails = await getClientCostDetails(client.id);
        const dailyCosts = calculateDailyCostBreakdown(costDetails);
        const validationRules = calculateCostValidationRules(costDetails);

        clientsWithCostsData.push({
          client,
          costDetails,
          dailyCosts,
          validationRules,
          totalBranches: costDetails.length
        });
      }

      setClientsWithCosts(clientsWithCostsData);
    } catch (err) {
      console.error('Erro ao carregar custos dos clientes:', err);
    }
  };

  const getClientById = (id: string): ContractClient | null => {
    return clients.find(client => client.id === id) || null;
  };

  const getClientWithCosts = (id: string): ClientWithCosts | null => {
    return clientsWithCosts.find(cwc => cwc.client.id === id) || null;
  };

  const getClientContract = async (clientId: string): Promise<ContractClient | null> => {
    try {
        // Select explícito das colunas necessárias
        const { data, error } = await supabase
          .from('contratos_corporativos_v2')
          .select(`
            id,
            cliente_id_legado,
            nome_empresa,
            total_funcionarios,
            custo_maximo_refeicao,
            restricoes_alimentares,
            periodicidade,
            total_refeicoes_mes,
            ativo,
            created_at,
            sync_at
          `)
          .eq('id', clientId)
          .single();

      if (error) {
        throw error;
      }

      if (!data) return null;

        // Transform single record to match ContractClient interface
        return {
          id: data.id,
          cliente_id_legado: data.cliente_id_legado,
          nome_empresa: data.nome_empresa,
          total_funcionarios: data.total_funcionarios,
          custo_maximo_refeicao: Number(data.custo_maximo_refeicao),
          restricoes_alimentares: data.restricoes_alimentares || [],
          periodicidade: data.periodicidade as 'diario' | 'semanal' | 'mensal',
          total_refeicoes_mes: data.total_refeicoes_mes,
          ativo: data.ativo,
          created_at: data.created_at,
          updated_at: data.sync_at
        };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar contrato do cliente';
      console.error('Erro ao buscar contrato do cliente:', err);
      
      // Adicionar toast para consistência na experiência do usuário
      toast({
        title: "Erro ao Buscar Contrato",
        description: errorMessage,
        variant: "destructive"
      });
      
      return null;
    }
  };

  const getClientCostDetails = async (clientId: string): Promise<ClientCostDetails[]> => {
    try {
      const client = getClientById(clientId);
      if (!client?.cliente_id_legado) return [];

      const { data, error } = await supabase
        .from('custos_filiais')
        .select('*')
        .eq('cliente_id_legado', parseInt(client.cliente_id_legado))
        .order('nome_filial');

      if (error) {
        console.error('Erro ao buscar custos da filial:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        cliente_id_legado: item.cliente_id_legado,
        filial_id: item.filial_id,
        nome_filial: item.nome_filial || '',
        razao_social: item.razao_social || '',
        nome_fantasia: item.nome_fantasia || '',
        custo_total: Number(item.custo_total || 0),
        custo_medio_semanal: Number(item.custo_medio_semanal || 0),
        RefCustoSegunda: Number(item.RefCustoSegunda || 0),
        RefCustoTerca: Number(item.RefCustoTerca || 0),
        RefCustoQuarta: Number(item.RefCustoQuarta || 0),
        RefCustoQuinta: Number(item.RefCustoQuinta || 0),
        RefCustoSexta: Number(item.RefCustoSexta || 0),
        RefCustoSabado: Number(item.RefCustoSabado || 0),
        RefCustoDomingo: Number(item.RefCustoDomingo || 0),
        RefCustoDiaEspecial: Number(item.RefCustoDiaEspecial || 0),
        QtdeRefeicoesUsarMediaValidarSimNao: item.QtdeRefeicoesUsarMediaValidarSimNao || false,
        PorcentagemLimiteAcimaMedia: Number(item.PorcentagemLimiteAcimaMedia || 0),
        solicitacao_filial_custo_id: item.solicitacao_filial_custo_id,
        solicitacao_compra_tipo_id: item.solicitacao_compra_tipo_id,
        solicitacao_compra_tipo_descricao: item.solicitacao_compra_tipo_descricao || '',
        user_name: item.user_name || '',
        user_date_time: item.user_date_time || '',
        sync_at: item.sync_at,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
    } catch (err) {
      console.error('Erro ao buscar detalhes de custos do cliente:', err);
      return [];
    }
  };

  useEffect(() => {
    refreshClients();
  }, []);

  const value: ClientContractsContextType = {
    clients,
    clientsWithCosts,
    isLoading,
    error,
    refreshClients,
    getClientById,
    getClientWithCosts,
    getClientContract,
    getClientCostDetails
  };

  return (
    <ClientContractsContext.Provider value={value}>
      {children}
    </ClientContractsContext.Provider>
  );
};

export const useClientContractsContext = () => {
  const context = useContext(ClientContractsContext);
  if (context === undefined) {
    throw new Error('useClientContractsContext must be used within a ClientContractsProvider');
  }
  return context;
};
