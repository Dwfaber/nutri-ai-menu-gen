
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SystemFlowchart from '../components/SystemFlowchart/SystemFlowchart';

const SystemArchitecture = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Arquitetura do Sistema</h1>
        <p className="text-gray-600">Visualização completa da arquitetura do Nutr's IA</p>
      </div>

      <Tabs defaultValue="flowchart" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="flowchart">Fluxograma Interativo</TabsTrigger>
          <TabsTrigger value="details">Detalhes Técnicos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="flowchart" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fluxograma do Sistema Nutr's IA</CardTitle>
              <p className="text-sm text-gray-600">
                Interaja com o diagrama: arraste os nós, use zoom e explore as conexões
              </p>
            </CardHeader>
            <CardContent>
              <SystemFlowchart />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-300 rounded border-2 border-blue-400"></div>
                  <span className="text-sm font-medium">Interface do Usuário</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-pink-300 rounded border-2 border-pink-400"></div>
                  <span className="text-sm font-medium">Inteligência Artificial</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-300 rounded border-2 border-green-400"></div>
                  <span className="text-sm font-medium">Lógica de Negócio</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-indigo-300 rounded border-2 border-indigo-400"></div>
                  <span className="text-sm font-medium">Banco de Dados</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Funcionalidades de IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-green-700">GPT Assistant</h4>
                  <p className="text-sm text-gray-600">
                    Utiliza OpenAI GPT-4o-mini para geração inteligente de cardápios baseada em:
                  </p>
                  <ul className="text-xs text-gray-500 ml-4 mt-1">
                    <li>• Orçamento disponível</li>
                    <li>• Restrições alimentares</li>
                    <li>• Preferências do cliente</li>
                    <li>• Produtos disponíveis</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-green-700">NLP Processor</h4>
                  <p className="text-sm text-gray-600">
                    Processa comandos em linguagem natural para edição de cardápios
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integrações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-blue-700">Sistema Legado</h4>
                  <p className="text-sm text-gray-600">
                    Conecta com SQL Server existente para sincronização de:
                  </p>
                  <ul className="text-xs text-gray-500 ml-4 mt-1">
                    <li>• Produtos e ingredientes</li>
                    <li>• Receitas e preparos</li>
                    <li>• Clientes corporativos</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700">Supabase</h4>
                  <p className="text-sm text-gray-600">
                    Banco principal PostgreSQL com Edge Functions para IA
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="font-semibold">1. Entrada:</span> Nutricionista define parâmetros
                </div>
                <div className="text-sm">
                  <span className="font-semibold">2. IA:</span> GPT gera cardápio otimizado
                </div>
                <div className="text-sm">
                  <span className="font-semibold">3. Processamento:</span> Análise nutricional e custos
                </div>
                <div className="text-sm">
                  <span className="font-semibold">4. Saída:</span> Cardápio personalizado por perfil
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Segurança</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="font-semibold">Autenticação:</span> Supabase Auth
                </div>
                <div className="text-sm">
                  <span className="font-semibold">API Keys:</span> Secrets gerenciados
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Dados:</span> RLS policies ativas
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Legado:</span> Acesso somente leitura
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemArchitecture;
