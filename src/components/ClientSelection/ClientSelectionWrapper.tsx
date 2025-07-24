import React from 'react';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import ClientSelector from './ClientSelector';

interface ClientSelectionWrapperProps {
  children: React.ReactNode;
}

const ClientSelectionWrapper = ({ children }: ClientSelectionWrapperProps) => {
  const { selectedClient } = useSelectedClient();

  if (!selectedClient) {
    return (
      <div className="min-h-screen bg-background p-6">
        <ClientSelector />
      </div>
    );
  }

  return <>{children}</>;
};

export default ClientSelectionWrapper;