
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { 
  ClientCostDetails, 
  ClientWithCosts, 
  DailyCostBreakdown, 
  CostValidationRules,
  calculateDailyCostBreakdown,
  calculateCostValidationRules
} from '../types/clientCosts';

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
  // Configurações de sucos
  use_pro_mix?: boolean;
  use_pro_vita?: boolean;
  use_suco_diet?: boolean;
  use_suco_natural?: boolean;
  // Configurações de gramagem das proteínas
  protein_grams_pp1?: number;
  protein_grams_pp2?: number;
}

interface ClientContractsContextType {
  clients: ContractClient[];
  clientsWithCosts: ClientWithCosts[];
  isLoading: boolean;
  error: string | null;
  refreshClients: (searchTerm?: string, limit?: number) => Promise<void>;
  searchClients: (searchTerm: string) => Promise<void>;
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

  const refreshClients = async (searchTerm?: string, limit?: number) => {
    try {
      setIsLoading(true);
      setError(null);

      // Loading clients with optional search

      // Buscar dados otimizados da tabela custos_filiais
      let query = supabase
        .from('custos_filiais')
        .select(`
          id,
          filial_id,
          cliente_id_legado,
          nome_fantasia,
          razao_social,
          nome_filial,
          solicitacao_compra_tipo_descricao,
          RefCustoSegunda,
          RefCustoTerca,
          RefCustoQuarta,
          RefCustoQuinta,
          RefCustoSexta,
          RefCustoSabado,
          RefCustoDomingo,
          RefCustoDiaEspecial,
          QtdeRefeicoesUsarMediaValidarSimNao,
          PorcentagemLimiteAcimaMedia,
          created_at,
          updated_at
        `);

      // Estratégia diferente para busca vs. carregamento inicial
      if (searchTerm && searchTerm.trim()) {
        // Na busca, usar filtro e ordenação alfabética
        query = query
          .or(`nome_fantasia.ilike.%${searchTerm}%,razao_social.ilike.%${searchTerm}%,nome_filial.ilike.%${searchTerm}%`)
          .order('nome_fantasia')
          .limit(limit || 1000);
      } else {
        // No carregamento inicial, pegar amostra diversificada
        query = query
          .order('cliente_id_legado')
          .limit(limit || 2000);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Data fetched successfully

      // Transform data to match ContractClient interface - with null safety
      const transformedData: ContractClient[] = (data || [])
        .filter(item => {
          // Filter out invalid clients
          const isValid = item.nome_fantasia || item.cliente_id_legado || item.id;
          return isValid;
        })
        .map(item => {
          const client = {
            id: item.id,
            filial_id: item.filial_id !== null ? item.filial_id : 0, // Garantir que seja número
            nome_fantasia: item.nome_fantasia?.trim() || `Cliente ${item.cliente_id_legado || item.id || 'Sem ID'}`,
            razao_social: item.razao_social?.trim() || undefined,
            nome_filial: item.nome_filial?.trim() || `Filial ${item.filial_id || 0}`,
            tipo_refeicao: item.solicitacao_compra_tipo_descricao?.trim() || 'REFEIÇÃO',
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
            usa_validacao_media: Boolean(item.QtdeRefeicoesUsarMediaValidarSimNao),
            limite_percentual_acima_media: Number(item.PorcentagemLimiteAcimaMedia || 0),
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
          };
          
          console.log('✅ Cliente transformado:', { 
            id: client.id, 
            nome_fantasia: client.nome_fantasia, 
            filial_id: client.filial_id 
          });
          
          return client;
        });

      console.log('🔧 Clientes após transformação:', { 
        total: transformedData.length,
        validNames: transformedData.filter(c => c.nome_fantasia && c.nome_fantasia !== '').length,
        validFilials: transformedData.filter(c => c.filial_id !== null && c.filial_id !== undefined).length
      });

      // Para carregamento inicial, mostrar amostra diversificada por empresa
      let finalClients = transformedData;
      if (!searchTerm) {
        const uniqueCompanies = new Map<string, ContractClient>();
        transformedData.forEach(client => {
          const companyKey = client.nome_fantasia;
          const existingClient = uniqueCompanies.get(companyKey);
          
          // Estratégia: pegar o cliente com maior custo médio diário (mais representativo)
          // ou o primeiro se não existir
          if (!existingClient || client.custo_medio_diario > existingClient.custo_medio_diario) {
            uniqueCompanies.set(companyKey, client);
          }
        });
        // Aumentar para 200 empresas para ter mais opções
        finalClients = Array.from(uniqueCompanies.values()).slice(0, 200);
        console.log('🏢 Empresas únicas selecionadas:', finalClients.length);
      }

      console.log('✨ Clientes finais definidos no estado:', finalClients.length);
      setClients(finalClients);

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
        filial_id: data.filial_id || 0,
        nome_fantasia: data.nome_fantasia || `Filial ${data.filial_id || ''}`,
        razao_social: data.razao_social || undefined,
        nome_filial: data.nome_filial || undefined,
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
        usa_validacao_media: !!data.QtdeRefeicoesUsarMediaValidarSimNao,
        limite_percentual_acima_media: Number(data.PorcentagemLimiteAcimaMedia || 0),
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString()
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
        filial_id: item.filial_id || 0,
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
        QtdeRefeicoesUsarMediaValidarSimNao: !!item.QtdeRefeicoesUsarMediaValidarSimNao,
        PorcentagemLimiteAcimaMedia: Number(item.PorcentagemLimiteAcimaMedia || 0),
        solicitacao_filial_custo_id: item.solicitacao_filial_custo_id || 0,
        solicitacao_compra_tipo_id: item.solicitacao_compra_tipo_id || 0,
        solicitacao_compra_tipo_descricao: item.solicitacao_compra_tipo_descricao || '',
        user_name: item.user_name || '',
        user_date_time: item.user_date_time || '',
        sync_at: item.sync_at || '',
        created_at: item.created_at || '',
        updated_at: item.updated_at || ''
      }));
    } catch (err) {
      console.error('Erro ao buscar detalhes de custos do cliente:', err);
      return [];
    }
  };

  const searchClients = async (searchTerm: string) => {
    await refreshClients(searchTerm);
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
    searchClients,
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
