import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, DollarSign, Calendar, AlertCircle, TrendingUp } from 'lucide-react';
import { useClientContractsContext } from '@/contexts/ClientContractsContext';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import CostBreakdownCard from './CostBreakdownCard';

const ClientSelector = () => {
  const { clients, clientsWithCosts, isLoading, error } = useClientContractsContext();
  const { selectedClient, setSelectedClient } = useSelectedClient();

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

  const activeClients = clients.filter(client => client.ativo);

  if (activeClients.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">Nenhum cliente ativo encontrado</p>
          <p className="text-sm text-gray-500">Configure contratos corporativos para começar</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeClients.map((client) => {
          const clientWithCosts = clientsWithCosts.find(cwc => cwc.client.id === client.id);
          
          return (
            <Card 
              key={client.id} 
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedClient?.id === client.id ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => setSelectedClient(client)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{client.nome_empresa}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Ativo
                    </Badge>
                    {clientWithCosts && clientWithCosts.totalBranches > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        {clientWithCosts.totalBranches} filiais
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">
                      {client.total_funcionarios} funcionários
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">
                      Máx. R$ {client.custo_maximo_refeicao.toFixed(2)} por refeição
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">
                      {client.total_refeicoes_mes} refeições/mês
                    </span>
                  </div>

                  {/* Show daily cost average */}
                  {clientWithCosts && clientWithCosts.dailyCosts.average > 0 && (
                    <div className="flex items-center space-x-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-600">
                        Média diária: R$ {clientWithCosts.dailyCosts.average.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {client.restricoes_alimentares && client.restricoes_alimentares.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">Restrições:</p>
                    <div className="flex flex-wrap gap-1">
                      {client.restricoes_alimentares.slice(0, 3).map((restricao, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {restricao}
                        </Badge>
                      ))}
                      {client.restricoes_alimentares.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{client.restricoes_alimentares.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <Button 
                  className={`w-full ${
                    selectedClient?.id === client.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClient(client);
                  }}
                >
                  {selectedClient?.id === client.id ? 'Selecionado' : 'Selecionar'}
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