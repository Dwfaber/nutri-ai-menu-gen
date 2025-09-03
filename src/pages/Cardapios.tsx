import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Database, ShoppingCart, DollarSign, Eye, Download, Copy, Trash2, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useShoppingList } from '../hooks/useShoppingList';
import { useClientContracts, ContractFormData } from '../hooks/useClientContracts';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useIntegratedMenuGeneration, GeneratedMenu } from '../hooks/useIntegratedMenuGeneration';
import { useJuiceConfiguration } from '../hooks/useJuiceConfiguration';
import { Client, ContractClient } from '../types/client';
import SyncMonitor from '../components/SyncMonitor/SyncMonitor';
import NLPInput from '../components/MenuGenerator/NLPInput';
import PreviewTabs from '../components/MenuGenerator/PreviewTabs';
import { MenuCreationForm } from '../components/MenuGenerator/MenuCreationForm';
import IntegratedMenuGenerator from '../components/MenuGeneration/IntegratedMenuGenerator';
import { WeeklyMenuView } from '../components/MenuGeneration/WeeklyMenuView';
import { JuiceMenuDisplay } from '../components/MenuGeneration/JuiceMenuDisplay';

const Cardapios = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMenuForShopping, setSelectedMenuForShopping] = useState<string | null>(null);
  const [viewingMenu, setViewingMenu] = useState<GeneratedMenu | null>(null);
  const [juiceTestResult, setJuiceTestResult] = useState<any>(null);
  
  const { 
    isGenerating, 
    generatedMenu, 
    savedMenus,
    generateMenu,
    loadSavedMenus,
    generateShoppingListFromMenu,
    deleteGeneratedMenu
  } = useIntegratedMenuGeneration();
  const { createFromMenu, isLoading: isCreatingList } = useShoppingList();
  const { clients, generateAIContextSummary } = useClientContracts();
  const { selectedClient } = useSelectedClient();
  const { generateJuiceConfig } = useJuiceConfiguration();
  const { toast } = useToast();

  const handleGenerateShoppingList = async (menu: GeneratedMenu) => {
    setSelectedMenuForShopping(menu.id);
    await generateShoppingListFromMenu(menu);
    setSelectedMenuForShopping(null);
  };

  const getBudgetStatus = (menu: GeneratedMenu) => {
    const client = clients.find(c => c.id === menu.clientId);
    if (!client || !menu.totalCost) return 'unknown';
    
    // Calculate total daily cost: cost per meal * meals per day
    const defaultMealsPerDay = 50; // Default assumption
    const totalDailyCost = menu.costPerMeal * defaultMealsPerDay;
    const clientDailyBudget = client.custo_medio_diario * defaultMealsPerDay;
    
    const budgetPercentage = (totalDailyCost / clientDailyBudget) * 100;
    
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

  const handleVisualizarCardapio = (menu: GeneratedMenu) => {
    setViewingMenu(menu);
  };

  const handleExportarCardapio = (menu: GeneratedMenu) => {
    // Get dynamic days from the menu
    const uniqueDays = [...new Set(menu.recipes?.map(r => r.day).filter(Boolean))].sort();
    
    // Create CSV content with dynamic days
    const csvContent = [
      ['Categoria', ...uniqueDays],
      ...(['PP1', 'PP2', 'Arroz Branco', 'Feijão', 'Salada 1', 'Salada 2', 'Suco 1', 'Suco 2'].map(category => [
        category,
        ...(uniqueDays.map(day => {
          const recipe = menu.recipes?.find(r => r.category === category && r.day?.toLowerCase().includes(day.toLowerCase()));
          return recipe ? `${recipe.name} (R$ ${recipe.cost?.toFixed(2) || '0.00'})` : '-';
        }))
      ]))
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cardapio-${menu.weekPeriod.replace(/\s+/g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Cardápio exportado",
      description: "O arquivo CSV foi baixado com sucesso.",
    });
  };

  const handleDuplicarCardapio = async (menu: GeneratedMenu) => {
    try {
      // Create a copy of the menu with new ID and current date
      const duplicatedMenu = {
        ...menu,
        id: `menu-${Date.now()}`,
        weekPeriod: `${menu.weekPeriod} (Cópia)`,
        createdAt: new Date().toISOString(),
        status: 'draft' as const
      };
      
      // In a real app, you would save this to the database
      // For now, we'll just show a success message
      toast({
        title: "Cardápio duplicado",
        description: "Uma cópia do cardápio foi criada com sucesso.",
      });
      
      // Reload saved menus to show the new copy
      loadSavedMenus();
    } catch (error) {
      toast({
        title: "Erro ao duplicar",
        description: "Não foi possível duplicar o cardápio.",
        variant: "destructive",
      });
    }
  };

  const handleExcluirCardapio = async (menu: GeneratedMenu) => {
    const success = await deleteGeneratedMenu(menu.id);
    if (success) {
      // Menu was deleted successfully, state is already updated in the hook
    }
  };

  const handleTestJuiceConfiguration = async () => {
    if (!selectedClient) {
      toast({
        title: "Cliente não selecionado",
        description: "Selecione um cliente para testar a configuração de sucos.",
        variant: "destructive",
      });
      return;
    }

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const config = {
      use_pro_mix: selectedClient.use_pro_mix || false,
      use_pro_vita: selectedClient.use_pro_vita || false,
      use_suco_diet: selectedClient.use_suco_diet || false,
      use_suco_natural: selectedClient.use_suco_natural || true, // default fallback
    };

    const result = await generateJuiceConfig(startDate, endDate, config);
    if (result) {
      setJuiceTestResult(result);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cardápios</h1>
          <p className="text-gray-600">Sistema inteligente de cardápios com receitas reais e lista de compras automática</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={handleTestJuiceConfiguration}
            variant="outline"
            disabled={!selectedClient}
          >
            <TestTube className="w-4 h-4 mr-2" />
            Testar Sucos
          </Button>
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="bg-green-600 hover:bg-green-700"
            disabled={!selectedClient}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Cardápio
          </Button>
        </div>
      </div>

      <Tabs defaultValue="integrated" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="integrated">Gerador Inteligente</TabsTrigger>
          <TabsTrigger value="juice-test">Teste de Sucos</TabsTrigger>
          <TabsTrigger value="menus">Cardápios Salvos</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
        </TabsList>
        
        <TabsContent value="integrated" className="space-y-6">
          <IntegratedMenuGenerator />
        </TabsContent>
        
        <TabsContent value="juice-test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Teste da Nova Estrutura de Sucos</CardTitle>
              <p className="text-sm text-muted-foreground">
                Teste a configuração melhorada de sucos com IDs reais dos produtos e variedade por categoria.
              </p>
            </CardHeader>
            <CardContent>
              {selectedClient ? (
                <div className="space-y-4">
                  <div className="text-sm">
                    <p><strong>Cliente:</strong> {selectedClient?.nome_fantasia}</p>
                    <p><strong>Configurações:</strong></p>
                    <ul className="list-disc list-inside ml-4 text-muted-foreground">
                      <li>Pró Mix: {selectedClient.use_pro_mix ? 'Sim' : 'Não'}</li>
                      <li>Vita Suco: {selectedClient.use_pro_vita ? 'Sim' : 'Não'}</li>
                      <li>Suco Diet: {selectedClient.use_suco_diet ? 'Sim' : 'Não'}</li>
                      <li>Suco Natural: {selectedClient.use_suco_natural ? 'Sim' : 'Não'}</li>
                    </ul>
                  </div>
                  
                  <Button 
                    onClick={handleTestJuiceConfiguration}
                    className="w-full"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    Gerar Configuração de Sucos
                  </Button>
                  
                  {juiceTestResult && (
                    <JuiceMenuDisplay juiceConfig={juiceTestResult} />
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Selecione um cliente para testar a configuração de sucos.</p>
              )}
            </CardContent>
          </Card>
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

          {showCreateForm && selectedClient && (
            <div className="p-4 border rounded-lg bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">
                Use o "Gerador Inteligente" para criar novos cardápios
              </p>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
              >
                Fechar
              </Button>
            </div>
          )}

          {generatedMenu && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Cardápio Gerado - {generatedMenu.weekPeriod}</CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      {getBudgetBadge(getBudgetStatus(generatedMenu))}
                      <Badge variant="outline" className="text-green-600">
                        <DollarSign className="w-3 h-3 mr-1" />
                        R$ {generatedMenu.totalCost?.toFixed(2) || '0.00'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleGenerateShoppingList(generatedMenu)}
                    disabled={selectedMenuForShopping === generatedMenu.id}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {selectedMenuForShopping === generatedMenu.id ? 'Gerando Lista...' : 'Gerar Lista de Compras'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p><strong>Receitas:</strong> {generatedMenu.recipes?.length || 0}</p>
                    <p><strong>Custo por porção:</strong> R$ {generatedMenu.recipes?.length ? (generatedMenu.totalCost! / generatedMenu.recipes.length).toFixed(2) : '0.00'}</p>
                    <p><strong>Status:</strong> {generatedMenu.status}</p>
                  </div>
                  {generatedMenu.recipes && generatedMenu.recipes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">Receitas:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {generatedMenu.recipes.map((recipe, index) => (
                          <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                            <p className="font-medium">{recipe.name}</p>
                            <p className="text-gray-600">{recipe.category} - {recipe.day}</p>
                            <p className="text-green-600">R$ {recipe.cost?.toFixed(2) || '0.00'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {savedMenus.length === 0 && !generatedMenu && (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Nenhum cardápio encontrado</p>
                <p className="text-sm mb-4">
                  {!selectedClient 
                    ? 'Selecione um cliente para começar a gerar cardápios' 
                    : 'Crie seu primeiro cardápio com IA'
                  }
                </p>
                {!selectedClient && (
                  <Button variant="outline" onClick={() => window.location.pathname = '/'}>
                    Selecionar Cliente
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {savedMenus.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {savedMenus.map((menu) => {
                const budgetStatus = getBudgetStatus(menu);
                return (
                  <Card key={menu.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{menu.weekPeriod}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">
                            Criado em {new Date(menu.createdAt).toLocaleDateString()}
                          </p>
                          <div className="flex items-center space-x-2">
                            {getBudgetBadge(budgetStatus)}
                            <Badge variant="secondary">
                              {menu.status}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateShoppingList(menu)}
                          disabled={selectedMenuForShopping === menu.id}
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
                          <span className="font-medium">R$ {menu.totalCost?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Receitas</span>
                          <span className="text-sm">{menu.recipes?.length || 0}</span>
                        </div>
                        <div className="flex space-x-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleVisualizarCardapio(menu)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Visualizar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleExportarCardapio(menu)}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Exportar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDuplicarCardapio(menu)}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Duplicar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o cardápio "{menu.weekPeriod}"? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleExcluirCardapio(menu)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      {/* Menu Visualization Dialog */}
      <Dialog open={!!viewingMenu} onOpenChange={() => setViewingMenu(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Cardápio - {viewingMenu?.weekPeriod}</DialogTitle>
          </DialogHeader>
          {viewingMenu && (
            <WeeklyMenuView menu={viewingMenu} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cardapios;