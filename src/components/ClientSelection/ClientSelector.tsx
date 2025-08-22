import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, Users, DollarSign, Calendar, AlertCircle, TrendingUp, Info, Search, X } from 'lucide-react';
import { useClientContractsContext } from '@/contexts/ClientContractsContext';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import CostBreakdownCard from './CostBreakdownCard';
import ClientInfoForm, { ClientAdditionalInfo } from './ClientInfoForm';

const ClientSelector = () => {
  const { clients, clientsWithCosts, isLoading, error, searchClients } = useClientContractsContext();
  const { selectedClient, setSelectedClient } = useSelectedClient();
  const [showInfoForm, setShowInfoForm] = useState(false);
  const [clientForForm, setClientForForm] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg font-medium">Carregando clientes...</p>
          <p className="text-sm text-gray-500">Aguarde enquanto buscamos os contratos</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-lg font-medium text-red-600">Erro ao carregar clientes</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // Como não temos o campo 'ativo' nos dados reais, considerar todos os clientes
  const activeClients = clients;

  const handleClientSelect = (client: any) => {
    setClientForForm(client);
    setShowInfoForm(true);
  };

  const handleInfoComplete = (info: ClientAdditionalInfo) => {
    setSelectedClient({ ...clientForForm, additionalInfo: info });
    setShowInfoForm(false);
    setClientForForm(null);
  };

  const handleInfoCancel = () => {
    setShowInfoForm(false);
    setClientForForm(null);
  };

  const handleSearch = useCallback(async (term: string) => {
    if (term.trim() === searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      await searchClients(term);
      setSearchTerm(term);
    } catch (err) {
      console.error('Erro na busca:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchClients, searchTerm]);

  const handleClearSearch = async () => {
    setSearchTerm('');
    setIsSearching(true);
    try {
      await searchClients('');
    } catch (err) {
      console.error('Erro ao limpar busca:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.length >= 2 || searchTerm.length === 0) {
        handleSearch(searchTerm);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, handleSearch]);

  if (showInfoForm && clientForForm) {
    return <ClientInfoForm client={clientForForm} onComplete={handleInfoComplete} onCancel={handleInfoCancel} />;
  }

  if (activeClients.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">Nenhum cliente encontrado</p>
          <p className="text-sm text-gray-500">Verifique a sincronização dos dados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Selecione uma Filial</h2>
        <p className="text-gray-600 mt-2">
          Escolha a filial para configurar o cardápio e lista de compras
        </p>
      </div>

      {/* Campo de busca */}
      <div className="max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Buscar por nome da empresa, filial ou razão social..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        {(isSearching || isLoading) && (
          <p className="text-sm text-gray-500 mt-2 text-center">
            {isSearching ? 'Buscando...' : 'Carregando...'}
          </p>
        )}
        {searchTerm && !isSearching && !isLoading && (
          <p className="text-sm text-gray-500 mt-2 text-center">
            {clients.length} resultado(s) para "{searchTerm}"
          </p>
        )}
        {!searchTerm && !isSearching && !isLoading && (
          <p className="text-sm text-gray-500 mt-2 text-center">
            Mostrando amostra de {clients.length} empresas. Use a busca para encontrar clientes específicos.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeClients.map((client) => {
          const clientWithCosts = clientsWithCosts.find(cwc => cwc.client.id === client.id);
          
          return (
            <Card 
              key={client.id} 
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedClient?.id === client.id ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleClientSelect(client)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{client.nome_fantasia}</CardTitle>
                    {client.nome_filial && (
                      <p className="text-sm text-gray-600 mt-1">{client.nome_filial}</p>
                    )}
                    {client.razao_social && client.razao_social !== client.nome_fantasia && (
                      <p className="text-xs text-gray-500 mt-1">{client.razao_social}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      {client.nome_filial}
                    </Badge>
                    <Badge 
                      variant={client.tipo_refeicao?.includes('Almoço') ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {client.tipo_refeicao}
                    </Badge>
                    {clientWithCosts && clientWithCosts.totalBranches > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        {clientWithCosts.totalBranches} custos
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">
                      {clientWithCosts && clientWithCosts.totalBranches > 1 ? (
                        <>A partir de R$ {client.custo_medio_diario.toFixed(2)}</>
                      ) : (
                        <>Custo médio diário: R$ {client.custo_medio_diario.toFixed(2)}</>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">
                      Tipo: {client.tipo_refeicao}
                    </span>
                  </div>
                  
                  {client.custo_dia_especial > 0 && (
                    <div className="flex items-center space-x-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      <span className="text-gray-600">
                        Dia especial: R$ {client.custo_dia_especial.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Show daily cost average */}
                  {clientWithCosts && clientWithCosts.dailyCosts.average > 0 && (
                    <div className="flex items-center space-x-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-600">
                        Média semanal: R$ {clientWithCosts.dailyCosts.average.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Informação sobre dados complementares */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-orange-700 text-sm">
                    <Info className="w-4 h-4" />
                    <span>Clique para preencher informações complementares</span>
                  </div>
                </div>

                <Button 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClientSelect(client);
                  }}
                >
                  Selecionar e Configurar
                </Button>

                {/* Show detailed cost breakdown for selected client */}
                {selectedClient?.id === client.id && clientWithCosts && (
                  <CostBreakdownCard
                    dailyCosts={clientWithCosts.dailyCosts}
                    validationRules={clientWithCosts.validationRules}
                    totalBranches={clientWithCosts.totalBranches}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedClient && (
        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => setSelectedClient(null)}
            className="mt-4"
          >
            Trocar Cliente
          </Button>
        </div>
      )}
    </div>
  );
};

export default ClientSelector;