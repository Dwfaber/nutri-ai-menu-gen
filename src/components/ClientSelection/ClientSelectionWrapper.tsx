import React from 'react';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import ClientSelector from './ClientSelector';

interface ClientSelectionWrapperProps {
  children: React.ReactNode;
}

const ClientSelectionWrapper = ({ children }: ClientSelectionWrapperProps) => {
  const { selectedClient } = useSelectedClient();

  // Check if this is the first visit
  const isFirstVisit = !localStorage.getItem('has-visited') && !selectedClient;
  
  // If first visit, show welcome screen
  if (isFirstVisit && window.location.pathname !== '/welcome') {
    localStorage.setItem('has-visited', 'true');
    window.location.href = '/welcome';
    return null;
  }

  // If no client selected and not on welcome page, show client selector
  if (!selectedClient && window.location.pathname !== '/welcome') {
    return (
      <div className="min-h-screen bg-background p-6">
        <ClientSelector />
      </div>
    );
  }

  return <>{children}</>;
};

export default ClientSelectionWrapper;