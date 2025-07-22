
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings } from 'lucide-react';
import { ViewSyncPanel } from './ViewSyncPanel';
import { useLegacyAdaptation } from '@/hooks/useLegacyAdaptation';

const AdaptationPanel = () => {
  const [activeTab, setActiveTab] = useState('views');
  const { viewsStatus } = useLegacyAdaptation();

  // Calculate statistics
  const totalViews = Object.keys(viewsStatus).length;
  const syncedViews = Object.values(viewsStatus).filter(v => v.status === 'synced').length;
  const errorViews = Object.values(viewsStatus).filter(v => v.status === 'error').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Adaptação do Sistema Legado
          </CardTitle>
          <p className="text-sm text-gray-600">
            Sistema integrado com as views específicas liberadas pelo TI
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{syncedViews}</div>
              <div className="text-sm text-green-700">Views Sincronizadas</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalViews}</div>
              <div className="text-sm text-blue-700">Views Disponíveis</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{errorViews}</div>
              <div className="text-sm text-red-700">Views com Erro</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="views">Sincronização de Views</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
        </TabsList>

        <TabsContent value="views">
          <ViewSyncPanel />
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>Status das Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(viewsStatus).map(([viewName, info]) => (
                  <div key={viewName} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{info.name}</div>
                      <div className="text-sm text-gray-600">{viewName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium capitalize">{info.status}</div>
                      {info.lastSync && (
                        <div className="text-xs text-gray-500">
                          {new Date(info.lastSync).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdaptationPanel;
