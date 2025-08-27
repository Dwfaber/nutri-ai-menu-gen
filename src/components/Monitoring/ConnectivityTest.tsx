import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { checkEdgeFunctionHealth, testEdgeFunctionConnectivity } from '@/utils/edgeFunctionHealthCheck';
import { Wifi, WifiOff, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConnectivityStatus {
  isHealthy: boolean;
  status: string;
  responseTime: number;
  timestamp: string;
  error?: string;
}

export const ConnectivityTest = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [connectivityStatus, setConnectivityStatus] = useState<ConnectivityStatus | null>(null);
  const [lastTestTime, setLastTestTime] = useState<string | null>(null);
  const { toast } = useToast();

  const runConnectivityTest = async () => {
    setIsLoading(true);
    
    try {
      const result = await testEdgeFunctionConnectivity('gpt-assistant');
      
      setConnectivityStatus({
        isHealthy: result.canConnect,
        status: result.healthCheck.status,
        responseTime: result.healthCheck.responseTime,
        timestamp: result.healthCheck.timestamp,
        error: result.healthCheck.error
      });
      
      setLastTestTime(new Date().toLocaleString('pt-BR'));
      
      if (result.canConnect) {
        toast({
          title: "Conectividade OK",
          description: `Backend conectado com sucesso em ${result.healthCheck.responseTime}ms`,
        });
      } else {
        toast({
          title: "Problema de Conectividade",
          description: result.healthCheck.error || "Falha na comunicação com o backend",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setConnectivityStatus({
        isHealthy: false,
        status: 'error',
        responseTime: 0,
        timestamp: new Date().toISOString(),
        error: errorMessage
      });
      
      toast({
        title: "Erro no Teste",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-test on component mount
  useEffect(() => {
    runConnectivityTest();
  }, []);

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (!connectivityStatus) return <AlertCircle className="w-4 h-4" />;
    return connectivityStatus.isHealthy ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getStatusColor = () => {
    if (!connectivityStatus) return 'secondary';
    return connectivityStatus.isHealthy ? 'default' : 'destructive';
  };

  const getResponseTimeColor = () => {
    if (!connectivityStatus) return 'text-muted-foreground';
    const time = connectivityStatus.responseTime;
    if (time < 1000) return 'text-green-500';
    if (time < 3000) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {navigator.onLine ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          Status de Conectividade
        </CardTitle>
        <CardDescription>
          Monitoramento em tempo real da conectividade backend
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">
              Backend Status:
            </span>
            <Badge variant={getStatusColor()}>
              {connectivityStatus?.status || 'Testando...'}
            </Badge>
          </div>
          <Button 
            onClick={runConnectivityTest} 
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Testar Novamente
              </>
            )}
          </Button>
        </div>

        {connectivityStatus && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Tempo de Resposta:</span>
              <div className={`font-mono ${getResponseTimeColor()}`}>
                {connectivityStatus.responseTime}ms
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Último Teste:</span>
              <div className="font-mono">
                {lastTestTime || 'Nunca'}
              </div>
            </div>
          </div>
        )}

        {connectivityStatus?.error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="text-sm font-medium text-destructive mb-1">
              Detalhes do Erro:
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              {connectivityStatus.error}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-green-500' : 'bg-red-500'}`} />
          Conexão Internet: {navigator.onLine ? 'Online' : 'Offline'}
        </div>
      </CardContent>
    </Card>
  );
};