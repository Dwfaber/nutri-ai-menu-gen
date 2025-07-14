import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SystemFlowchart from '../components/SystemFlowchart/SystemFlowchart';

const SystemArchitecture = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Arquitetura do Sistema</h1>
        <p className="text-gray-600">Visualização completa da arquitetura do Nutr's IA</p>
      </div>

      <Tabs defaultValue="flowchart" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="flowchart">Fluxograma Interativo</TabsTrigger>
          <TabsTrigger value="details">Detalhes Técnicos</TabsTrigger>
          <TabsTrigger value="documentation">Documentação</TabsTrigger>
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

        <TabsContent value="documentation" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📋 Visão Geral do Sistema
                  <Badge variant="outline">v1.0</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-lg mb-2">Nutr's IA - Sistema de Gestão Nutricional</h4>
                  <p className="text-gray-600">
                    O Nutr's IA é uma plataforma avançada de gestão nutricional que utiliza inteligência artificial 
                    para otimizar cardápios corporativos, reduzir custos e garantir qualidade nutricional.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-semibold text-green-700">Principais Benefícios</h5>
                    <ul className="text-sm text-gray-600 space-y-1 mt-2">
                      <li>• Redução de custos operacionais em até 30%</li>
                      <li>• Cardápios personalizados por IA</li>
                      <li>• Análise nutricional automática</li>
                      <li>• Integração com sistemas legados</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-blue-700">Público-Alvo</h5>
                    <ul className="text-sm text-gray-600 space-y-1 mt-2">
                      <li>• Nutricionistas especializados</li>
                      <li>• Empresas de alimentação corporativa</li>
                      <li>• Gestores de refeitórios industriais</li>
                      <li>• Consultorias em nutrição</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🎯 Funcionalidades Principais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-purple-700">Dashboard Inteligente</h5>
                      <p className="text-sm text-gray-600">
                        Métricas em tempo real, análise de custos e indicadores de performance nutricional.
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-purple-700">Geração de Cardápios por IA</h5>
                      <p className="text-sm text-gray-600">
                        Utiliza GPT-4o-mini para criar cardápios otimizados baseados em orçamento, 
                        restrições e preferências.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-purple-700">Sistema de Compras</h5>
                      <p className="text-sm text-gray-600">
                        Gestão automatizada de listas de compras com integração a fornecedores 
                        e controle de estoque.
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-purple-700">Relatórios Avançados</h5>
                      <p className="text-sm text-gray-600">
                        Análises detalhadas de custos, valor nutricional e performance operacional.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🔧 Stack Tecnológico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h5 className="font-semibold text-orange-700 mb-3">Frontend</h5>
                    <div className="space-y-2">
                      <Badge variant="secondary">React 18</Badge>
                      <Badge variant="secondary">TypeScript</Badge>
                      <Badge variant="secondary">Tailwind CSS</Badge>
                      <Badge variant="secondary">Shadcn/ui</Badge>
                      <Badge variant="secondary">React Query</Badge>
                      <Badge variant="secondary">React Router</Badge>
                      <Badge variant="secondary">Lucide Icons</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-semibold text-orange-700 mb-3">Backend</h5>
                    <div className="space-y-2">
                      <Badge variant="secondary">Supabase</Badge>
                      <Badge variant="secondary">PostgreSQL</Badge>
                      <Badge variant="secondary">Edge Functions</Badge>
                      <Badge variant="secondary">RLS Policies</Badge>
                      <Badge variant="secondary">Real-time</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-semibold text-orange-700 mb-3">Integrações</h5>
                    <div className="space-y-2">
                      <Badge variant="secondary">OpenAI GPT-4o</Badge>
                      <Badge variant="secondary">SQL Server</Badge>
                      <Badge variant="secondary">REST APIs</Badge>
                      <Badge variant="secondary">Webhooks</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📊 Estrutura de Dados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="font-semibold text-indigo-700 mb-3">Banco Principal (Supabase)</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">contratos_corporativos</span>
                        <Badge variant="outline" className="text-xs">11 cols</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">produtos_legado</span>
                        <Badge variant="outline" className="text-xs">10 cols</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">receitas_legado</span>
                        <Badge variant="outline" className="text-xs">11 cols</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">sync_logs</span>
                        <Badge variant="outline" className="text-xs">10 cols</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-semibold text-indigo-700 mb-3">Sistema Legado (SQL Server)</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">produtos</span>
                        <Badge variant="outline" className="text-xs">Leitura</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">receitas</span>
                        <Badge variant="outline" className="text-xs">Leitura</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">clientes_corporativos</span>
                        <Badge variant="outline" className="text-xs">Leitura</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">ingredientes_receita</span>
                        <Badge variant="outline" className="text-xs">Leitura</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🚀 Fluxo de Uso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <h5 className="font-semibold">Configuração Inicial</h5>
                      <p className="text-sm text-gray-600">
                        Nutricionista configura parâmetros básicos, restrições alimentares e orçamento disponível.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <h5 className="font-semibold">Sincronização de Dados</h5>
                      <p className="text-sm text-gray-600">
                        Sistema sincroniza produtos, receitas e clientes do banco legado para otimizar sugestões.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <h5 className="font-semibold">Geração por IA</h5>
                      <p className="text-sm text-gray-600">
                        GPT-4o-mini analisa dados e gera cardápios personalizados considerando todos os parâmetros.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                    <div>
                      <h5 className="font-semibold">Revisão e Aprovação</h5>
                      <p className="text-sm text-gray-600">
                        Nutricionista revisa, ajusta e aprova cardápios antes da implementação.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</div>
                    <div>
                      <h5 className="font-semibold">Execução e Monitoramento</h5>
                      <p className="text-sm text-gray-600">
                        Sistema gera listas de compras, monitora custos e produz relatórios de performance.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🔐 Segurança e Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="font-semibold text-red-700 mb-3">Medidas de Segurança</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Autenticação via Supabase Auth</li>
                      <li>• Row-Level Security (RLS) ativo</li>
                      <li>• Conexão SSL/TLS obrigatória</li>
                      <li>• API Keys protegidas em secrets</li>
                      <li>• Acesso somente leitura ao legado</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h5 className="font-semibold text-red-700 mb-3">Compliance</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• LGPD - Proteção de dados pessoais</li>
                      <li>• Auditoria de todas as operações</li>
                      <li>• Logs detalhados de sincronização</li>
                      <li>• Backup automático diário</li>
                      <li>• Controle de acesso granular</li>
                    </ul>
                  </div>
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
