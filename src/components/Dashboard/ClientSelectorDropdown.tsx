import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Users, DollarSign, Calendar, ChevronDown } from 'lucide-react';
import { useClientContractsContext } from '@/contexts/ClientContractsContext';
import { useSelectedClient } from '@/contexts/SelectedClientContext';

const ClientSelectorDropdown = () => {
  const { clients, isLoading } = useClientContractsContext();
  const { selectedClient, setSelectedClient } = useSelectedClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
    }
  };

  const handleClientSelectFromDialog = (client: any) => {
    setSelectedClient(client);
    setIsDialogOpen(false);
  };

  if (isLoading) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 animate-pulse" />
            <span className="text-sm">Carregando clientes...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Cliente Ativo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between gap-3">
          {selectedClient ? (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-medium">{selectedClient.nome_fantasia}</span>
                <Badge variant="outline" className="text-xs">
                  Filial {selectedClient.filial_id}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  R$ {(selectedClient.custo_medio_diario || 0).toFixed(2)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {selectedClient.tipo_refeicao}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <span className="text-muted-foreground">Nenhum cliente selecionado</span>
            </div>
          )}
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {selectedClient ? 'Trocar' : 'Selecionar'}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Selecionar Cliente</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {clients.map((client) => (
                  <Card 
                    key={client.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedClient?.id === client.id ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleClientSelectFromDialog(client)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{client.nome_fantasia}</CardTitle>
                        <Badge variant="outline" className="text-blue-600 border-blue-600">
                          Filial {client.filial_id}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">
                          R$ {client.custo_medio_diario.toFixed(2)} / dia
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">
                          {client.tipo_refeicao}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">
                          Dados de contrato
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientSelectorDropdown;