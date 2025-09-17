import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Database, ShoppingCart, DollarSign, Eye, Download, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useShoppingList } from '@/hooks/useShoppingList';
import { useClientContracts } from '@/hooks/useClientContracts';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { useIntegratedMenuGeneration, GeneratedMenu } from '@/hooks/useIntegratedMenuGeneration';
import { useJuiceConfiguration } from '@/hooks/useJuiceConfiguration';
import SyncMonitor from '@/components/SyncMonitor/SyncMonitor';
import IntegratedMenuGenerator from '@/components/MenuGeneration/IntegratedMenuGenerator';
import WeeklyMenuView from '@/components/MenuGeneration/WeeklyMenuView';

const Cardapios = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMenuForShopping, setSelectedMenuForShopping] = useState<string | null>(null);
  const [viewingMenu, setViewingMenu] = useState<GeneratedMenu | null>(null);
  const [juiceTestResult, setJuiceTestResult] = useState<any>(null);
  
  const { 
    generatedMenu, 
    savedMenus,
    loadSavedMenus,
    generateShoppingListFromMenu,
    deleteGeneratedMenu
  } = useIntegratedMenuGeneration();
  const { clients } = useClientContracts();
  const { selectedClient } = useSelectedClient();
  const { generateJuiceConfig } = useJuiceConfiguration();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      await loadSavedMenus();
    })();
  }, []);

  const handleGenerateShoppingList = async (menu: GeneratedMenu) => {
    setSelectedMenuForShopping(menu.id);
    await generateShoppingListFromMenu(menu);
    setSelectedMenuForShopping(null);
  };

  const getBudgetStatus = (menu: GeneratedMenu) => {
    const client = clients.find(c => c.id === menu.clientId);
    if (!client) return 'unknown';
    
    // Calculate cost from recipes if menu.costPerMeal is 0
    let costPerMeal = menu.costPerMeal || 0;
    if (costPerMeal === 0 && menu.recipes && menu.recipes.length > 0) {
      const totalCost = menu.recipes.reduce((sum: number, recipe: any) => {
        return sum + (Number(recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0));
      }, 0);
      costPerMeal = totalCost / (menu.mealsPerDay || 50);
    }
    
    if (costPerMeal === 0) return 'unknown';
    
    const defaultMealsPerDay = menu.mealsPerDay || 50; 
    const totalDailyCost = costPerMeal * defaultMealsPerDay;
    const clientDailyBudget = (client.custo_medio_diario || 0) * defaultMealsPerDay;
    
    if (clientDailyBudget === 0) return 'unknown';
    
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

  const handleVisualizarCardapio = (menu: GeneratedMenu) => setViewingMenu(menu);

  const handleExportarCardapio = (menu: GeneratedMenu) => {
    const uniqueDays = [...new Set(menu.recipes?.map(r => r.day).filter(Boolean))].sort();
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
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cardapio-${menu.weekPeriod.replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Cardápio exportado", description: "O arquivo CSV foi baixado com sucesso." });
  };

  const handleDuplicarCardapio = async (menu: GeneratedMenu) => {
    try {
      const duplicatedMenu = {
        ...menu,
        id: `menu-${Date.now()}`,
        weekPeriod: `${menu.weekPeriod} (Cópia)`,
        createdAt: new Date().toISOString(),
        status: 'draft' as const
      };
      toast({ title: "Cardápio duplicado", description: "Uma cópia foi criada com sucesso." });
      await loadSavedMenus(); // ✅ corrigido
    } catch {
      toast({ title: "Erro ao duplicar", description: "Não foi possível duplicar", variant: "destructive" });
    }
  };

  const handleExcluirCardapio = async (menu: GeneratedMenu) => await deleteGeneratedMenu(menu.id);

  const handleTestJuiceConfiguration = async () => {
    if (!selectedClient) {
      toast({ title: "Cliente não selecionado", description: "Selecione um cliente", variant: "destructive" });
      return;
    }
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = await generateJuiceConfig(startDate, endDate, {
      use_pro_mix: selectedClient.use_pro_mix || false,
      use_pro_vita: selectedClient.use_pro_vita || false,
      use_suco_diet: selectedClient.use_suco_diet || false,
      use_suco_natural: selectedClient.use_suco_natural ?? true
    });
    if (result) setJuiceTestResult(result);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cardápios</h1>
          <p className="text-gray-600">Sistema inteligente de cardápios com lista de compras automática</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} disabled={!selectedClient} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" /> Novo Cardápio
        </Button>
      </div>

      <Tabs defaultValue="integrated">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="integrated">Gerador Inteligente</TabsTrigger>
          <TabsTrigger value="menus">Cardápios Salvos</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
        </TabsList>
        
        <TabsContent value="integrated"><IntegratedMenuGenerator /></TabsContent>
        
        <TabsContent value="menus" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, período..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={loadSavedMenus}>
              <Database className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedMenus
              .filter((m) =>
                `${m.clientName} ${m.weekPeriod}`
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())
              )
              .map((menu) => (
                <Card key={menu.id} className="border hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{menu.clientName}</span>
                      {getBudgetBadge(getBudgetStatus(menu))}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{menu.weekPeriod}</p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Custo/refeição</p>
                      <p className="font-semibold">R$ {Number(menu.costPerMeal || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" onClick={() => handleVisualizarCardapio(menu)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => handleGenerateShoppingList(menu)} disabled={selectedMenuForShopping===menu.id}>
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => handleExportarCardapio(menu)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => handleDuplicarCardapio(menu)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir cardápio?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleExcluirCardapio(menu)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {savedMenus.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhum cardápio salvo ainda. Gere um novo na aba "Gerador Inteligente".
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sync"><SyncMonitor /></TabsContent>
      </Tabs>

      <Dialog open={!!viewingMenu} onOpenChange={() => setViewingMenu(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Visualizar Cardápio - {viewingMenu?.weekPeriod}</DialogTitle></DialogHeader>
          {viewingMenu && <WeeklyMenuView menu={viewingMenu?.menu || viewingMenu} />} {/* ✅ WeeklyMenuView agora importa certo */}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cardapios;