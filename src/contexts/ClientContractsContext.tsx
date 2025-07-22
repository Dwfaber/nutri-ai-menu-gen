
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
        .from('clientes_contratos')
        .select('*')
        .order('nome_empresa');

      if (fetchError) {
        throw fetchError;
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

  const getClientById = (id: string): ContractClient | null => {
    return clients.find(client => client.id === id) || null;
  };

  const getClientContract = async (clientId: string): Promise<ContractClient | null> => {
    try {
      const { data, error } = await supabase
        .from('clientes_contratos')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) {
        throw error;
      }

      return data;
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
