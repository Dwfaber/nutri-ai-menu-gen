
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMenuAI } from '@/hooks/useMenuAI';

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
  const { syncLegacyData, isGenerating } = useMenuAI();

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

  const handleSync = async (operation: 'all' | 'produtos' | 'receitas' | 'clientes') => {
    await syncLegacyData(operation);
    await fetchLogs(); // Refresh logs after sync
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Sincronização com Sistema Legado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={() => handleSync('all')}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Sincronizar Tudo
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSync('produtos')}
              disabled={isGenerating}
            >
              Produtos
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSync('receitas')}
              disabled={isGenerating}
            >
              Receitas
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSync('clientes')}
              disabled={isGenerating}
            >
              Clientes
            </Button>
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
