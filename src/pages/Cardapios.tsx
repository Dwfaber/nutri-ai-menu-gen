import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Database, ShoppingCart, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMenuAI } from '../hooks/useMenuAI';
import { useShoppingList } from '../hooks/useShoppingList';
import { useClientContracts, ContractFormData } from '../hooks/useClientContracts';
import { Client, Menu } from '../types/client';
import SyncMonitor from '../components/SyncMonitor/SyncMonitor';
import NLPInput from '../components/MenuGenerator/NLPInput';
import PreviewTabs from '../components/MenuGenerator/PreviewTabs';
import { MenuCreationForm } from '../components/MenuGenerator/MenuCreationForm';
import IntegratedMenuGenerator from '../components/MenuGeneration/IntegratedMenuGenerator';

const Cardapios = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState<Menu | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuForShopping, setSelectedMenuForShopping] = useState<string | null>(null);
  
  const { generateMenu, editMenuWithNLP, isGenerating, error } = useMenuAI();
  const { createFromMenu, isLoading: isCreatingList } = useShoppingList();
  const { clients, generateAIContextSummary } = useClientContracts();

  const handleCreateMenu = async (formData: ContractFormData) => {
    if (!formData.contractData) return;
    
    // Generate AI context summary for better menu generation
    const aiContextSummary = generateAIContextSummary(formData);
    
    const menu = await generateMenu(
      formData.clientId,
      formData.budgetPerMeal,
      formData.restrictions,
      aiContextSummary
    );
    
    if (menu) {
      setGeneratedMenu(menu);
      setMenus([...menus, menu]);
      setShowCreateForm(false);
    }
  };

  const handleNLPCommand = async (command: string) => {
    if (generatedMenu) {
      await editMenuWithNLP(generatedMenu.id, command);
    }
  };

  const handleGenerateShoppingList = async (menu: Menu) => {
    setSelectedMenuForShopping(menu.id);
    
    const client = clients.find(c => c.id === menu.clientId);
    if (!client) {
      console.error('Client not found for menu');
      return;
    }

    await createFromMenu(menu.id, client.nome_fantasia, menu.totalCost);
    setSelectedMenuForShopping(null);
  };

  const getBudgetStatus = (menu: Menu) => {
    const client = clients.find(c => c.id === menu.clientId);
    if (!client) return 'unknown';
    
    const budgetPercentage = (menu.totalCost / client.custo_medio_diario) * 100;
    
    if (budgetPercentage <= 90) return 'good';
    if (budgetPercentage <= 100) return 'warning';
    return 'exceeded';
  };

  const getBudgetBadge = (status: string) => {
    switch (status) {
      case 'good':
        return <Badge className="bg-green-100 text-green-800">Dentro do Orçamento</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Próximo do Limite</Badge>;
      case 'exceeded':
        return <Badge className="bg-red-100 text-red-800">Orçamento Excedido</Badge>;
      default:
        return <Badge variant="outline">Status Desconhecido</Badge>;
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
          disabled={clients.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Cardápio
        </Button>
      </div>

      <Tabs defaultValue="integrated" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="integrated">Gerador Inteligente</TabsTrigger>
          <TabsTrigger value="menus">Cardápios Salvos</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
        </TabsList>
        
        <TabsContent value="integrated" className="space-y-6">
          <IntegratedMenuGenerator />
        </TabsContent>
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

          {showCreateForm && clients.length > 0 && (
            <MenuCreationForm
              onSubmit={handleCreateMenu}
              onCancel={() => setShowCreateForm(false)}
              isGenerating={isGenerating}
              error={error}
            />
          )}

          {generatedMenu && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Cardápio Gerado - {generatedMenu.name}</CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      {getBudgetBadge(getBudgetStatus(generatedMenu))}
                      <Badge variant="outline" className="text-green-600">
                        <DollarSign className="w-3 h-3 mr-1" />
                        R$ {generatedMenu.totalCost.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleGenerateShoppingList(generatedMenu)}
                    disabled={isCreatingList || selectedMenuForShopping === generatedMenu.id}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {selectedMenuForShopping === generatedMenu.id ? 'Gerando Lista...' : 'Gerar Lista de Compras'}
                  </Button>
                </div>
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

          {menus.length === 0 && !generatedMenu && (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Nenhum cardápio encontrado</p>
                <p className="text-sm mb-4">
                  {clients.length === 0 
                    ? 'Sincronize os dados do sistema legado para começar' 
                    : 'Crie seu primeiro cardápio com IA'
                  }
                </p>
                {clients.length === 0 && (
                  <Button variant="outline" onClick={() => window.location.hash = '#sync'}>
                    Ir para Sincronização
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {menus.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {menus.map((menu) => {
                const budgetStatus = getBudgetStatus(menu);
                return (
                  <Card key={menu.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{menu.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">
                            Semana de {new Date(menu.week).toLocaleDateString()}
                          </p>
                          <div className="flex items-center space-x-2">
                            {getBudgetBadge(budgetStatus)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateShoppingList(menu)}
                          disabled={isCreatingList || selectedMenuForShopping === menu.id}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          {selectedMenuForShopping === menu.id ? 'Gerando...' : 'Lista'}
                        </Button>
                      </div>
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
                );
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="sync">
          <SyncMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Cardapios;
