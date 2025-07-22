
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface ContractClient {
  id: string;
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
  isLoading: boolean;
  error: string | null;
  refreshClients: () => Promise<void>;
  getClientById: (id: string) => ContractClient | null;
  getClientContract: (clientId: string) => Promise<ContractClient | null>;
}

const ClientContractsContext = createContext<ClientContractsContextType | undefined>(undefined);

export const ClientContractsProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useState<ContractClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshClients = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('contratos_corporativos')
        .select('*')
        .order('nome_empresa');

      if (fetchError) {
        throw fetchError;
      }

      // Transform data to match ContractClient interface
      const transformedData: ContractClient[] = (data || []).map(item => ({
        id: item.id,
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

  const getClientById = (id: string): ContractClient | null => {
    return clients.find(client => client.id === id) || null;
  };

  const getClientContract = async (clientId: string): Promise<ContractClient | null> => {
    try {
      const { data, error } = await supabase
        .from('contratos_corporativos')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) {
        throw error;
      }

      if (!data) return null;

      // Transform single record to match ContractClient interface
      return {
        id: data.id,
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
      console.error('Erro ao buscar contrato do cliente:', err);
      return null;
    }
  };

  useEffect(() => {
    refreshClients();
  }, []);

  const value: ClientContractsContextType = {
    clients,
    isLoading,
    error,
    refreshClients,
    getClientById,
    getClientContract
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
