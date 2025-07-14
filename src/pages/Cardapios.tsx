import { useState } from 'react';
import { Plus, Search, Filter, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMenuAI } from '../hooks/useMenuAI';
import { Client, Menu } from '../types/client';
import SyncMonitor from '../components/SyncMonitor/SyncMonitor';
import NLPInput from '../components/MenuGenerator/NLPInput';
import PreviewTabs from '../components/MenuGenerator/PreviewTabs';

const Cardapios = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState<Menu | null>(null);
  const { generateMenu, editMenuWithNLP, isGenerating, error } = useMenuAI();

  // Mock data
  const mockMenus: Menu[] = [
    {
      id: '1',
      clientId: '1',
      name: 'Cardápio Semanal - Tech Corp',
      week: '2024-01-15',
      items: [],
      totalCost: 2450.00,
      createdAt: '2024-01-10',
      versions: { nutritionist: [], kitchen: [], client: [] }
    },
    {
      id: '2',
      clientId: '2',
      name: 'Cardápio Especial - StartupXYZ',
      week: '2024-01-15',
      items: [],
      totalCost: 1890.50,
      createdAt: '2024-01-12',
      versions: { nutritionist: [], kitchen: [], client: [] }
    }
  ];

  const mockClients: Client[] = [
    {
      id: '1',
      name: 'Tech Corp',
      budget: 5000,
      employees: 150,
      restrictions: ['vegetarian-options'],
      active: true,
      contractStart: '2024-01-01',
      contractEnd: '2024-12-31'
    }
  ];

  const handleCreateMenu = async (clientId: string, budget: number, restrictions: string[], preferences?: string) => {
    const menu = await generateMenu(clientId, budget, restrictions, preferences);
    if (menu) {
      setGeneratedMenu(menu);
      setShowCreateForm(false);
    }
  };

  const handleNLPCommand = async (command: string) => {
    if (generatedMenu) {
      await editMenuWithNLP(generatedMenu.id, command);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cardápios</h1>
          <p className="text-gray-600">Gerencie cardápios corporativos com IA</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Cardápio
        </Button>
      </div>

      <Tabs defaultValue="menus" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="menus">Cardápios</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
        </TabsList>
        
        <TabsContent value="menus" className="space-y-6">
          <div className="flex space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar cardápios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>

          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Criar Novo Cardápio com IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente
                  </label>
                  <select className="w-full p-2 border border-gray-300 rounded-md">
                    {mockClients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} - R$ {client.budget}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Orçamento por Refeição
                  </label>
                  <Input type="number" placeholder="15.00" step="0.01" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Restrições Alimentares
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Vegano', 'Vegetariano', 'Sem Glúten', 'Sem Lactose'].map(restriction => (
                      <label key={restriction} className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">{restriction}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferências Adicionais
                  </label>
                  <Input placeholder="Ex: pratos regionais, comida caseira..." />
                </div>

                <div className="flex space-x-2">
                  <Button 
                    onClick={() => handleCreateMenu('1', 15.00, ['vegetarian-options'], 'comida caseira')}
                    disabled={isGenerating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isGenerating ? 'Gerando com IA...' : 'Gerar com IA'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
                
                {error && (
                  <div className="text-red-600 text-sm">{error}</div>
                )}
              </CardContent>
            </Card>
          )}

          {generatedMenu && (
            <Card>
              <CardHeader>
                <CardTitle>Cardápio Gerado - {generatedMenu.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <PreviewTabs menu={generatedMenu} />
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Editar com Linguagem Natural
                  </h4>
                  <NLPInput 
                    onCommand={handleNLPCommand}
                    isProcessing={isGenerating}
                    placeholder="Ex: Substituir frango por peixe, adicionar opção vegana..."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {mockMenus.map((menu) => (
              <Card key={menu.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{menu.name}</CardTitle>
                    <Badge variant="outline" className="text-green-600">
                      Ativo
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    Semana de {new Date(menu.week).toLocaleDateString()}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Custo Total</span>
                      <span className="font-medium">R$ {menu.totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Criado em</span>
                      <span className="text-sm">{new Date(menu.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex space-x-2 pt-2">
                      <Button variant="outline" size="sm">
                        Editar
                      </Button>
                      <Button variant="outline" size="sm">
                        Exportar
                      </Button>
                      <Button variant="outline" size="sm">
                        Duplicar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="sync">
          <SyncMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Cardapios;
