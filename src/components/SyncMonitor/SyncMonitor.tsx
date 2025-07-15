
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLegacyAdaptation } from '@/hooks/useLegacyAdaptation';

interface SyncLog {
  id: string;
  tabela_destino: string;
  operacao: string;
  status: string;
  registros_processados: number | null;
  tempo_execucao_ms: number | null;
  erro_msg: string | null;
  created_at: string;
}

const SyncMonitor = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { syncAllViews, syncSpecificView, isProcessing } = useLegacyAdaptation();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSync = async (viewName: string) => {
    await syncSpecificView(viewName);
    await fetchLogs();
  };

  const handleFullSync = async () => {
    await syncAllViews();
    await fetchLogs();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'erro':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'iniciado':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'concluido':
        return 'default';
      case 'erro':
        return 'destructive';
      case 'iniciado':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const viewNames = [
    'vwCoSolicitacaoFilialCusto',
    'vwCoSolicitacaoProdutoListagem', 
    'vwCpReceita',
    'vwCpReceitaProduto',
    'vwEstProdutoBase',
    'vwOrFiliaisAtiva'
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Sincronização com Views do Sistema Legado
          </CardTitle>
          <p className="text-sm text-gray-600">
            Monitore e execute sincronizações das views liberadas pelo TI
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Button
              onClick={handleFullSync}
              disabled={isProcessing}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Sincronizar Todas
            </Button>
            
            {viewNames.slice(0, 3).map(viewName => (
              <Button
                key={viewName}
                variant="outline"
                onClick={() => handleViewSync(viewName)}
                disabled={isProcessing}
                className="text-xs"
              >
                <Eye className="w-3 h-3 mr-1" />
                {viewName.replace('vw', '').slice(0, 8)}...
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {viewNames.slice(3).map(viewName => (
              <Button
                key={viewName}
                variant="outline"
                onClick={() => handleViewSync(viewName)}
                disabled={isProcessing}
                className="text-xs"
              >
                <Eye className="w-3 h-3 mr-1" />
                {viewName.replace('vw', '')}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Histórico de Sincronização</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center text-gray-500">Carregando logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center text-gray-500">Nenhum log de sincronização encontrado</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="font-medium">
                        {log.tabela_destino} - {log.operacao}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                      {log.erro_msg && (
                        <div className="text-sm text-red-600 mt-1">
                          {log.erro_msg}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {log.registros_processados !== null && (
                      <span className="text-sm text-gray-600">
                        {log.registros_processados} registros
                      </span>
                    )}
                    {log.tempo_execucao_ms !== null && (
                      <span className="text-sm text-gray-600">
                        {log.tempo_execucao_ms}ms
                      </span>
                    )}
                    <Badge variant={getStatusVariant(log.status)}>
                      {log.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncMonitor;
