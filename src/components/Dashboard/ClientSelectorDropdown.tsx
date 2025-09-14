import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Users, DollarSign, Calendar, ChevronDown, AlertCircle } from 'lucide-react';
import { useClientContractsContext } from '@/contexts/ClientContractsContext';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ClientSelectorDropdown = () => {
  const { clients, isLoading, error } = useClientContractsContext();
  const { selectedClient, setSelectedClient } = useSelectedClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Debug logs
  console.log('🔍 ClientSelectorDropdown - clients recebidos:', clients.length);
  console.log('📋 Primeiros 3 clientes:', clients.slice(0, 3));

  // Memoize valid clients with relaxed validation
  const validClients = useMemo(() => {
    const filtered = clients.filter(client => {
      // Relaxar validação - aceitar se tem nome_fantasia válido
      const hasValidName = client.nome_fantasia && client.nome_fantasia.trim() !== '';
      const hasValidId = client.id || client.filial_id !== null;
      
      const isValid = hasValidName && hasValidId;
      
      if (!isValid) {
        console.log('❌ Cliente filtrado:', { 
          id: client.id, 
          nome_fantasia: client.nome_fantasia, 
          filial_id: client.filial_id,
          hasValidName,
          hasValidId
        });
      }
      
      return isValid;
    });
    
    console.log('✅ Clientes válidos após filtro:', filtered.length);
    return filtered;
  }, [clients]);

  const handleClientSelect = (clientId: string) => {
    const client = validClients.find(c => c.id === clientId);
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
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar clientes: {error}
            </AlertDescription>
          </Alert>
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
              <div className="mt-4">
                {validClients.length === 0 ? (
                  <div className="text-center py-8 space-y-4">
                    <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <div className="space-y-2">
                      <p className="text-muted-foreground">
                        Nenhum cliente válido encontrado
                      </p>
                      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        <p>Debug Info:</p>
                        <p>Total de clientes carregados: {clients.length}</p>
                        <p>Clientes com nome válido: {clients.filter(c => c.nome_fantasia && c.nome_fantasia.trim()).length}</p>
                        <p>Clientes com filial_id: {clients.filter(c => c.filial_id !== null && c.filial_id !== undefined).length}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => window.location.reload()}
                        className="mt-2"
                      >
                        Recarregar Página
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {validClients.map((client) => (
                      <Card 
                        key={client.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedClient?.id === client.id ? 'ring-2 ring-primary bg-primary/5' : ''
                        }`}
                        onClick={() => handleClientSelectFromDialog(client)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base line-clamp-2">
                              {client.nome_fantasia}
                            </CardTitle>
                            <Badge variant="outline" className="text-primary border-primary flex-shrink-0 ml-2">
                              {client.filial_id !== null && client.filial_id !== 0 ? `Filial ${client.filial_id}` : 'Filial 0'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center space-x-2 text-sm">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              R$ {client.custo_medio_diario.toFixed(2)} / dia
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {client.tipo_refeicao}
                            </span>
                          </div>
                          {client.razao_social && (
                            <div className="flex items-center space-x-2 text-sm">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground line-clamp-1">
                                {client.razao_social}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientSelectorDropdown;