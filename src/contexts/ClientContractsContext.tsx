
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

interface ClientContractsContextType {
  clients: ContractClient[];
  isLoading: boolean;
  error: string | null;
  refreshClients: () => Promise<void>;
  getClientById: (id: string) => ContractClient | null;
}

const ClientContractsContext = createContext<ClientContractsContextType | undefined>(undefined);

interface ClientContractsProviderProps {
  children: ReactNode;
}

export const ClientContractsProvider: React.FC<ClientContractsProviderProps> = ({ children }) => {
  const [clients, setClients] = useState<ContractClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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

  const refreshClients = async () => {
    await loadClients();
  };

  const getClientById = (id: string): ContractClient | null => {
    return clients.find(client => client.id === id) || null;
  };

  useEffect(() => {
    loadClients();
  }, []);

  const value: ClientContractsContextType = {
    clients,
    isLoading,
    error,
    refreshClients,
    getClientById
  };

  return (
    <ClientContractsContext.Provider value={value}>
      {children}
    </ClientContractsContext.Provider>
  );
};

export const useClientContractsContext = (): ClientContractsContextType => {
  const context = useContext(ClientContractsContext);
  if (context === undefined) {
    throw new Error('useClientContractsContext must be used within a ClientContractsProvider');
  }
  return context;
};
