import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Download,
  Search,
  Database,
  Play,
  Timer
} from "lucide-react";
import { useLegacyAdaptation } from "@/hooks/useLegacyAdaptation";
import { useTriggerAutomation } from "@/hooks/useTriggerAutomation";

// Status Icon Helper
const getStatusIcon = (status: string): JSX.Element => {
  switch (status) {
    case 'synced':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

// Status Variant Helper
const getStatusVariant = (status: string): string => {
  switch (status) {
    case 'synced':
      return 'default';
    case 'error':
      return 'destructive';
    case 'pending':
      return 'secondary';
    default:
      return 'outline';
  }
};

export const ViewSyncPanel = () => {
  const { 
    viewsStatus, 
    syncProgress, 
    syncAllViews, 
    syncSpecificView, 
    checkViewsAvailability 
  } = useLegacyAdaptation();

  const {
    isTriggering,
    status: automationStatus,
    triggerCompleteSync,
    fetchAutomationStatus
  } = useTriggerAutomation();

  useEffect(() => {
    fetchAutomationStatus();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sincronização de Views do Sistema Legado
          </CardTitle>
          <CardDescription>
            Sincronize dados das views liberadas pelo TI da empresa usando automação n8n
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Status da Automação Agendada */}
          {automationStatus && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center">
                  <Timer className="h-4 w-4 mr-2" />
                  Automação Agendada
                </span>
                <Badge variant={automationStatus.is_enabled ? "default" : "secondary"}>
                  {automationStatus.is_enabled ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Execução: Segunda a Sexta às 20:00 (Horário de Brasília)</p>
                {automationStatus.last_triggered_at && (
                  <p>Última execução: {new Date(automationStatus.last_triggered_at).toLocaleString('pt-BR')}</p>
                )}
                <p>Status: <span className="capitalize">{automationStatus.status}</span></p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={triggerCompleteSync} 
              disabled={isTriggering || syncProgress.isProcessing}
              size="sm"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Play className="h-4 w-4 mr-2" />
              {isTriggering ? 'Iniciando Automação...' : 'Iniciar Automação Completa'}
            </Button>
            
            <Button 
              onClick={syncAllViews} 
              disabled={syncProgress.isProcessing || isTriggering}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar Todas
            </Button>
            
            <Button 
              onClick={checkViewsAvailability} 
              variant="outline"
              size="sm"
            >
              <Search className="h-4 w-4 mr-2" />
              Verificar Disponibilidade
            </Button>
          </div>

          {syncProgress.isProcessing && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso da Sincronização</span>
                <span>{Math.round((syncProgress.completedViews / syncProgress.totalViews) * 100)}%</span>
              </div>
              <Progress value={(syncProgress.completedViews / syncProgress.totalViews) * 100} className="w-full" />
              {syncProgress.currentView && (
                <p className="text-sm text-muted-foreground">
                  Sincronizando: {syncProgress.currentView}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Views Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(viewsStatus).map(([viewName, viewInfo]) => (
          <Card key={viewName} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{viewInfo.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {viewInfo.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(viewInfo.status)}
                  <Badge variant={getStatusVariant(viewInfo.status) as any}>
                    {viewInfo.status === 'synced' ? 'Sincronizado' : 
                     viewInfo.status === 'error' ? 'Erro' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {viewInfo.lastSync && (
                <div className="text-xs text-muted-foreground">
                  <strong>Última sync:</strong><br />
                  {new Date(viewInfo.lastSync).toLocaleString('pt-BR')}
                </div>
              )}
              
              {viewInfo.recordCount && (
                <div className="text-xs text-muted-foreground">
                  <strong>Registros:</strong> {viewInfo.recordCount}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => syncSpecificView(viewName)}
                disabled={syncProgress.isProcessing || isTriggering}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar View
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};