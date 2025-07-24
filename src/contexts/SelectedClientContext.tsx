import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ContractClient } from './ClientContractsContext';

interface SelectedClientContextType {
  selectedClient: ContractClient | null;
  setSelectedClient: (client: ContractClient | null) => void;
  clearClient: () => void;
}

const SelectedClientContext = createContext<SelectedClientContextType | undefined>(undefined);

export const SelectedClientProvider = ({ children }: { children: ReactNode }) => {
  const [selectedClient, setSelectedClientState] = useState<ContractClient | null>(null);

  // Persist client selection in localStorage
  const setSelectedClient = (client: ContractClient | null) => {
    setSelectedClientState(client);
    if (client) {
      localStorage.setItem('selected-client', JSON.stringify(client));
    } else {
      localStorage.removeItem('selected-client');
    }
  };

  const clearClient = () => {
    setSelectedClient(null);
  };

  // Load persisted client on mount
  useEffect(() => {
    const stored = localStorage.getItem('selected-client');
    if (stored) {
      try {
        const client = JSON.parse(stored);
        setSelectedClientState(client);
      } catch (error) {
        console.error('Error loading stored client:', error);
        localStorage.removeItem('selected-client');
      }
    }
  }, []);

  return (
    <SelectedClientContext.Provider value={{ selectedClient, setSelectedClient, clearClient }}>
      {children}
    </SelectedClientContext.Provider>
  );
};

export const useSelectedClient = () => {
  const context = useContext(SelectedClientContext);
  if (context === undefined) {
    throw new Error('useSelectedClient must be used within a SelectedClientProvider');
  }
  return context;
};