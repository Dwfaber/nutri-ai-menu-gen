
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
  filial_id: number;
  nome_fantasia: string;
  razao_social?: string;
  nome_filial?: string;
  tipo_refeicao: string;
  custo_medio_diario: number;
  custo_dia_especial: number;
  usa_validacao_media: boolean;
  limite_percentual_acima_media: number;
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

      // Buscar dados reais da tabela custos_filiais
      const { data, error: fetchError } = await supabase
        .from('custos_filiais')
        .select('*')
        .order('nome_fantasia');

      if (fetchError) {
        throw fetchError;
      }

      // Agrupar por nome_fantasia para evitar duplicatas de clientes
      const uniqueClients = new Map<string, any>();
      
      (data || []).forEach(item => {
        const key = item.nome_fantasia || `Cliente_${item.id}`;
        if (!uniqueClients.has(key)) {
          uniqueClients.set(key, item);
        }
      });

      // Transform data to match ContractClient interface usando apenas dados reais
      const transformedData: ContractClient[] = Array.from(uniqueClients.values()).map(item => ({
        id: item.id,
        filial_id: item.filial_id,
        nome_fantasia: item.nome_fantasia || `Filial ${item.filial_id}`,
        razao_social: item.razao_social,
        nome_filial: item.nome_filial,
        tipo_refeicao: item.solicitacao_compra_tipo_descricao || 'REFEIÇÃO',
        custo_medio_diario: (
          Number(item.RefCustoSegunda || 0) + 
          Number(item.RefCustoTerca || 0) + 
          Number(item.RefCustoQuarta || 0) + 
          Number(item.RefCustoQuinta || 0) + 
          Number(item.RefCustoSexta || 0) + 
          Number(item.RefCustoSabado || 0) + 
          Number(item.RefCustoDomingo || 0)
        ) / 7,
        custo_dia_especial: Number(item.RefCustoDiaEspecial || 0),
        usa_validacao_media: item.QtdeRefeicoesUsarMediaValidarSimNao || false,
        limite_percentual_acima_media: Number(item.PorcentagemLimiteAcimaMedia || 0),
        created_at: item.created_at,
        updated_at: item.updated_at
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
      const { data, error } = await supabase
        .from('custos_filiais')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) {
        throw error;
      }

      if (!data) return null;

      // Transform single record to match ContractClient interface usando dados reais
      return {
        id: data.id,
        filial_id: data.filial_id,
        nome_fantasia: data.nome_fantasia || `Filial ${data.filial_id}`,
        razao_social: data.razao_social,
        nome_filial: data.nome_filial,
        tipo_refeicao: data.solicitacao_compra_tipo_descricao || 'REFEIÇÃO',
        custo_medio_diario: (
          Number(data.RefCustoSegunda || 0) + 
          Number(data.RefCustoTerca || 0) + 
          Number(data.RefCustoQuarta || 0) + 
          Number(data.RefCustoQuinta || 0) + 
          Number(data.RefCustoSexta || 0) + 
          Number(data.RefCustoSabado || 0) + 
          Number(data.RefCustoDomingo || 0)
        ) / 7,
        custo_dia_especial: Number(data.RefCustoDiaEspecial || 0),
        usa_validacao_media: data.QtdeRefeicoesUsarMediaValidarSimNao || false,
        limite_percentual_acima_media: Number(data.PorcentagemLimiteAcimaMedia || 0),
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar contrato do cliente';
      console.error('Erro ao buscar contrato do cliente:', err);
      
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
      if (!client) return [];

      const { data, error } = await supabase
        .from('custos_filiais')
        .select('*')
        .eq('filial_id', client.filial_id)
        .order('nome_filial');

      if (error) {
        console.error('Erro ao buscar custos da filial:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        cliente_id_legado: item.cliente_id_legado || 0,
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
