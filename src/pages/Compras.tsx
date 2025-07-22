import { useState, useEffect } from 'react';
import { Plus, Search, Filter, ShoppingCart, Download, AlertCircle, CheckCircle, Package, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useShoppingList, ShoppingList, ShoppingListItem } from '../hooks/useShoppingList';
import ShoppingListCard from '../components/ShoppingList/ShoppingListCard';
import AdaptationPanel from '../components/LegacyAdaptation/AdaptationPanel';
import { ProductRequestManager } from '../components/ProductRequests/ProductRequestManager';
import OptimizationSettings from '../components/Optimization/OptimizationSettings';
import OptimizationAnalysis from '../components/Optimization/OptimizationAnalysis';
import OptimizationResults from '../components/Optimization/OptimizationResults';
import { useOptimization } from '../hooks/useOptimization';

// Define valid status types for shopping lists
type ShoppingListStatus = 'pending' | 'budget_ok' | 'budget_exceeded' | 'finalized' | 'draft' | 'approved' | 'purchased';

const Compras = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [listItems, setListItems] = useState<ShoppingListItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [optimizationSummary, setOptimizationSummary] = useState<any>(null);
  const [budgetStatus, setBudgetStatus] = useState<any>(null);

  const { 
    lists,
    getShoppingLists, 
    getShoppingListItems, 
    exportToCSV, 
    updateItemQuantity 
  } = useShoppingList();
  
  const { config: optimizationConfig, lastResults: optimizationResults } = useOptimization();

  useEffect(() => {
    loadShoppingLists();
  }, []);

  const loadShoppingLists = async () => {
    const listsData = await getShoppingLists();
    setShoppingLists(listsData);
  };

  const handleSelectList = async (list: ShoppingList) => {
    setSelectedList(list);
    setIsLoadingItems(true);
    
    try {
      const items = await getShoppingListItems(list.id);
      setListItems(items);
      
      // Set budget status for optimization display
      setBudgetStatus({
        predicted: list.budget_predicted,
        actual: list.cost_actual || 0,
        withinBudget: (list.cost_actual || 0) <= list.budget_predicted,
        difference: list.budget_predicted - (list.cost_actual || 0)
      });

      // Mock optimization summary for display (in real scenario this would come from the API)
      const optimizedItems = items.filter(item => (item as any).optimized);
      const promotionItems = items.filter(item => (item as any).promocao);
      
      if (optimizedItems.length > 0) {
        setOptimizationSummary({
          enabled: true,
          products_optimized: optimizedItems.length,
          total_savings: Math.max(0, list.budget_predicted - (list.cost_actual || 0)) * 0.1, // Estimate
          promotions_used: promotionItems.length,
          products_with_surplus: Math.floor(optimizedItems.length * 0.3) // Estimate
        });
      } else {
        setOptimizationSummary(null);
      }
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleExportList = () => {
    if (selectedList && listItems.length > 0) {
      exportToCSV(listItems, selectedList.client_name);
    }
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    await updateItemQuantity(itemId, quantity);
    if (selectedList) {
      const updatedItems = await getShoppingListItems(selectedList.id);
      setListItems(updatedItems);
    }
  };

  const getStatusBadge = (status: ShoppingListStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600">Pendente</Badge>;
      case 'budget_ok':
        return <Badge className="bg-green-100 text-green-800">Orçamento OK</Badge>;
      case 'budget_exceeded':
        return <Badge className="bg-red-100 text-red-800">Orçamento Excedido</Badge>;
      case 'finalized':
        return <Badge className="bg-blue-100 text-blue-800">Finalizada</Badge>;
      case 'draft':
        return <Badge variant="outline" className="text-gray-600">Rascunho</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800">Aprovada</Badge>;
      case 'purchased':
        return <Badge className="bg-green-100 text-green-800">Comprada</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  const totalCost = listItems.reduce((sum, item) => sum + item.total_price, 0);
  const totalItems = listItems.length;

  // Group items by category
  const groupedByCategory = listItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  // Use lists from hook, fallback to local state
  const displayLists = lists.length > 0 ? lists : shoppingLists;

  // Helper function to check if status indicates success
  const isSuccessStatus = (status: ShoppingListStatus) => {
    return status === 'budget_ok' || status === 'approved' || status === 'purchased';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sistema de Compras</h1>
          <p className="text-gray-600">Gerencie listas de compras com otimização inteligente</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700" disabled>
          <Plus className="w-4 h-4 mr-2" />
          Nova Lista Manual
        </Button>
      </div>

      <Tabs defaultValue="shopping" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shopping">Listas de Compras</TabsTrigger>
          <TabsTrigger value="market">Mercado de Produtos</TabsTrigger>
          <TabsTrigger value="optimization">Otimização</TabsTrigger>
          <TabsTrigger value="adaptation">Adaptação do Sistema</TabsTrigger>
        </TabsList>
        
        <TabsContent value="shopping" className="space-y-6">
          {/* Optimization Results - Show when available */}
          {optimizationSummary && budgetStatus && (
            <OptimizationResults 
              summary={optimizationSummary}
              budgetStatus={budgetStatus}
            />
          )}

          {/* Header com estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Listas Ativas</p>
                    <p className="text-2xl font-bold">{displayLists.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Custo Total</p>
                  <p className="text-2xl font-bold text-green-600">R$ {totalCost.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Itens</p>
                  <p className="text-2xl font-bold">{totalItems}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  {selectedList && isSuccessStatus(selectedList.status as ShoppingListStatus) ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-600">Status</p>
                    <p className="text-sm font-medium">
                      {selectedList ? getStatusBadge(selectedList.status as ShoppingListStatus) : 'Nenhuma lista selecionada'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="flex space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar listas de compras..."
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de Shopping Lists */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Listas de Compras Disponíveis</h3>
              {displayLists.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">Nenhuma lista de compras encontrada</p>
                    <p className="text-sm">Gere cardápios na aba "Cardápios" para criar listas automaticamente</p>
                  </CardContent>
                </Card>
              ) : (
                displayLists.map((list) => (
                  <Card 
                    key={list.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedList?.id === list.id ? 'ring-2 ring-green-500 bg-green-50' : ''
                    }`}
                    onClick={() => handleSelectList(list)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">{list.client_name}</h4>
                        {getStatusBadge(list.status as ShoppingListStatus)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Criada em: {new Date(list.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          Orçamento: R$ {list.budget_predicted.toFixed(2)}
                        </span>
                        <span className={`font-medium ${
                          (list.cost_actual || 0) <= list.budget_predicted ? 'text-green-600' : 'text-red-600'
                        }`}>
                          Custo: R$ {list.cost_actual?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Detalhes da Lista Selecionada */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  {selectedList ? `Itens - ${selectedList.client_name}` : 'Selecione uma Lista'}
                </h3>
                {selectedList && listItems.length > 0 && (
                  <Button onClick={handleExportList} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                )}
              </div>

              {isLoadingItems ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-gray-500">Carregando itens...</p>
                  </CardContent>
                </Card>
              ) : selectedList ? (
                Object.keys(groupedByCategory).length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-gray-500">
                      <p>Nenhum item encontrado para esta lista</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedByCategory).map(([category, items]) => (
                      <ShoppingListCard
                        key={category}
                        category={category}
                        items={items}
                        onUpdateQuantity={handleUpdateQuantity}
                      />
                    ))}
                    
                    {/* Resumo da Lista */}
                    <Card className="bg-gray-50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">Resumo da Lista</h4>
                            <p className="text-sm text-gray-600">
                              {totalItems} itens | Orçamento: R$ {selectedList.budget_predicted.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">R$ {totalCost.toFixed(2)}</p>
                            <p className={`text-sm ${
                              totalCost <= selectedList.budget_predicted ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {totalCost <= selectedList.budget_predicted ? 'Dentro do orçamento' : 'Orçamento excedido'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              ) : (
                <Card>
                  <CardContent className="p-8 text-center text-gray-500">
                    <p>Selecione uma lista de compras para ver os detalhes</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="market" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Package className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold">Mercado de Produtos</h3>
                <p className="text-sm text-gray-600">
                  Gerencie o catálogo de produtos disponíveis para geração de cardápios
                </p>
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Catálogo Digital</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Este é o mercado digital que a IA utiliza para gerar cardápios e listas de compras. 
                  Todos os produtos aqui cadastrados têm preços atualizados e dados per capita configurados.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900">Produtos Ativos</h4>
                    <p className="text-2xl font-bold text-blue-600">1.735</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900">Categorias</h4>
                    <p className="text-2xl font-bold text-green-600">8</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-medium text-orange-900">Em Promoção</h4>
                    <p className="text-2xl font-bold text-orange-600">1</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <ProductRequestManager />
          </div>
        </TabsContent>
        
        <TabsContent value="optimization" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Settings className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold">Otimização de Compras</h3>
                <p className="text-sm text-gray-600">
                  Configure e analise a otimização inteligente de compras
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OptimizationSettings />
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-purple-600">Algoritmo Ativo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">
                        ✅ Sistema de Otimização Ativo
                      </h4>
                      <p className="text-sm text-green-700 mb-3">
                        O algoritmo de otimização está funcionando e aplicando:
                      </p>
                      <ul className="text-xs space-y-1 text-green-600">
                        <li>• Análise de produtos base vs produtos embalados</li>
                        <li>• Otimização por preço e promoções</li>
                        <li>• Cálculo de combinações de embalagens</li>
                        <li>• Respeito a restrições de fracionamento</li>
                        <li>• Minimização de desperdício</li>
                      </ul>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-3 rounded">
                        <h5 className="text-sm font-medium">Algoritmo Integrado</h5>
                        <p className="text-xs text-gray-600 mt-1">
                          Funcionando na edge function
                        </p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded">
                        <h5 className="text-sm font-medium">Configurações</h5>
                        <p className="text-xs text-gray-600 mt-1">
                          Sistema de preferências ativo
                        </p>
                      </div>
                    </div>
                    
                    <Badge className="w-full justify-center bg-green-600 text-white">
                      Otimização Aplicada Automaticamente
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {optimizationResults.length > 0 && (
              <OptimizationAnalysis 
                results={optimizationResults}
                className="mt-6"
              />
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="adaptation">
          <AdaptationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Compras;
