
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Settings,
  Code,
  Table,
  FileText
} from 'lucide-react';
import { useLegacyAdaptation } from '@/hooks/useLegacyAdaptation';

const AdaptationPanel = () => {
  const {
    discoverSchema,
    mapTables,
    adaptCodes,
    runFullAdaptation,
    isProcessing,
    schemaInfo,
    tableMapping,
    codeAdaptation
  } = useLegacyAdaptation();

  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Adaptação do Sistema Legado
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configure o sistema para trabalhar com sua estrutura de dados específica
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={runFullAdaptation}
              disabled={isProcessing}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Adaptação Completa
            </Button>
            
            <Button
              variant="outline"
              onClick={discoverSchema}
              disabled={isProcessing}
            >
              <Table className="w-4 h-4 mr-2" />
              Descobrir Schema
            </Button>
            
            <Button
              variant="outline"
              onClick={mapTables}
              disabled={isProcessing}
            >
              <FileText className="w-4 h-4 mr-2" />
              Mapear Tabelas
            </Button>
            
            <Button
              variant="outline"
              onClick={adaptCodes}
              disabled={isProcessing}
            >
              <Code className="w-4 h-4 mr-2" />
              Adaptar Códigos
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="mapping">Mapeamento</TabsTrigger>
          <TabsTrigger value="codes">Códigos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Schema</p>
                    <p className="text-2xl font-bold">
                      {schemaInfo ? schemaInfo.tables.length : '0'}
                    </p>
                    <p className="text-xs text-gray-600">Tabelas descobertas</p>
                  </div>
                  {schemaInfo ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Mapeamento</p>
                    <p className="text-2xl font-bold">
                      {tableMapping ? Object.keys(tableMapping).length : '0'}
                    </p>
                    <p className="text-xs text-gray-600">Tabelas mapeadas</p>
                  </div>
                  {tableMapping ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Códigos</p>
                    <p className="text-2xl font-bold">
                      {codeAdaptation ? Object.keys(codeAdaptation.categoryMapping).length : '0'}
                    </p>
                    <p className="text-xs text-gray-600">Categorias adaptadas</p>
                  </div>
                  {codeAdaptation ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schema" className="space-y-4">
          {schemaInfo ? (
            <div className="space-y-4">
              {schemaInfo.tables.map((table, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{table.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {table.columns.map((column, colIndex) => (
                        <div key={colIndex} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium text-sm">{column.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {column.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Execute a descoberta do schema para ver as tabelas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          {tableMapping ? (
            <div className="space-y-4">
              {Object.entries(tableMapping).map(([key, mapping]) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {mapping.legacyTable} → {mapping.supabaseTable}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(mapping.columnMapping).map(([legacyCol, supabaseCol]) => (
                        <div key={legacyCol} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{legacyCol}</span>
                          <span className="text-xs text-gray-500">→</span>
                          <span className="text-sm font-medium">{supabaseCol}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Execute o mapeamento de tabelas para ver as correspondências</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="codes" className="space-y-4">
          {codeAdaptation ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Formato dos Códigos de Produto</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-2">{codeAdaptation.productCodeFormat.description}</p>
                  <div className="flex gap-2">
                    {codeAdaptation.productCodeFormat.examples.map((example, index) => (
                      <Badge key={index} variant="outline">{example}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mapeamento de Categorias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(codeAdaptation.categoryMapping).map(([code, info]) => (
                      <div key={code} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <Badge className="mb-1">{code}</Badge>
                          <p className="text-sm font-medium">{info.name}</p>
                          <p className="text-xs text-gray-600">{info.group}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Unidades de Medida</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(codeAdaptation.unitMapping).map(([legacy, standard]) => (
                      <div key={legacy} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{legacy}</span>
                        <span className="text-xs text-gray-500">→</span>
                        <span className="text-sm font-medium">{standard}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Execute a adaptação de códigos para ver as configurações</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdaptationPanel;
