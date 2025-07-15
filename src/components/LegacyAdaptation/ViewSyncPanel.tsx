
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Database, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  Play
} from 'lucide-react';
import { useLegacyAdaptation } from '@/hooks/useLegacyAdaptation';

const ViewSyncPanel = () => {
  const {
    syncSpecificView,
    syncAllViews,
    checkViewsAvailability,
    isProcessing,
    viewsStatus,
    syncProgress
  } = useLegacyAdaptation();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string) => {
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

  const progressPercentage = syncProgress.totalViews > 0 
    ? (syncProgress.completedViews / syncProgress.totalViews) * 100 
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Sincronização com Views do Sistema Legado
          </CardTitle>
          <p className="text-sm text-gray-600">
            Sincronize dados das views liberadas pelo TI da empresa
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <Button
              onClick={syncAllViews}
              disabled={isProcessing}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Sincronizar Todas as Views
            </Button>
            
            <Button
              variant="outline"
              onClick={checkViewsAvailability}
              disabled={isProcessing}
            >
              <Eye className="w-4 h-4 mr-2" />
              Verificar Disponibilidade
            </Button>
          </div>

          {syncProgress.isProcessing && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">
                  Sincronizando: {syncProgress.currentView}
                </span>
                <span className="text-sm text-gray-600">
                  {syncProgress.completedViews} de {syncProgress.totalViews}
                </span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(viewsStatus).map(([viewName, info]) => (
          <Card key={viewName}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{info.name}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{info.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(info.status)}
                  <Badge variant={getStatusVariant(info.status)}>
                    {info.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {info.lastSync && (
                  <div className="text-sm text-gray-600">
                    <strong>Última sincronização:</strong> {new Date(info.lastSync).toLocaleString()}
                  </div>
                )}
                
                {info.recordCount && (
                  <div className="text-sm text-gray-600">
                    <strong>Registros processados:</strong> {info.recordCount}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncSpecificView(viewName)}
                  disabled={isProcessing}
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Sincronizar View
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ViewSyncPanel;
