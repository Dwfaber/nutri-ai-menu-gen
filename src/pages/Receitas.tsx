import { useState } from 'react';
import { Search, Book, Filter, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRecipeAnalysis } from '@/hooks/useRecipeAnalysis';

const Receitas = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');
  
  const { 
    recipes, 
    categories, 
    statistics, 
    problematicRecipes, 
    loading, 
    error, 
    getRecipeStatus, 
    getRecipesByStatus 
  } = useRecipeAnalysis();

  const filteredRecipes = recipes.filter(recipe => {
    const matchesCategory = selectedCategory === 'all' || recipe.categoria_descricao === selectedCategory;
    const matchesSearch = recipe.nome_receita.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      const status = getRecipeStatus(recipe);
      switch (statusFilter) {
        case 'with_cost':
          matchesStatus = status.costStatus === 'with_cost';
          break;
        case 'without_cost':
          matchesStatus = status.costStatus === 'without_cost' || status.costStatus === 'null_cost';
          break;
        case 'with_ingredients':
          matchesStatus = status.ingredientStatus === 'complete';
          break;
        case 'without_ingredients':
          matchesStatus = status.ingredientStatus === 'none';
          break;
        case 'ready':
          matchesStatus = status.readyForProduction;
          break;
        case 'high_priority':
          matchesStatus = status.priority === 'high';
          break;
        case 'medium_priority':
          matchesStatus = status.priority === 'medium';
          break;
      }
    }
    
    return matchesCategory && matchesSearch && matchesStatus;
  });

  const getStatusBadge = (recipe: any) => {
    const status = getRecipeStatus(recipe);
    
    if (status.readyForProduction) {
      return <Badge variant="default" className="bg-green-600">Pronta</Badge>;
    }
    if (status.priority === 'high') {
      return <Badge variant="destructive">Alta Prioridade</Badge>;
    }
    if (status.priority === 'medium') {
      return <Badge variant="secondary" className="bg-yellow-600">Média Prioridade</Badge>;
    }
    return <Badge variant="outline">Baixa Prioridade</Badge>;
  };

  const getCostBadge = (recipe: any) => {
    const status = getRecipeStatus(recipe);
    if (status.costStatus === 'with_cost') {
      return <Badge variant="default" className="bg-green-600">Com Custo</Badge>;
    }
    return <Badge variant="destructive">Sem Custo</Badge>;
  };

  const getIngredientBadge = (recipe: any) => {
    const status = getRecipeStatus(recipe);
    if (status.ingredientStatus === 'complete') {
      return <Badge variant="default" className="bg-green-600">Completos</Badge>;
    }
    return <Badge variant="destructive">Sem Ingredientes</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Carregando receitas...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-destructive">Erro ao carregar receitas: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Book className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Análise Completa de Receitas</h1>
          <p className="text-muted-foreground">
            Dashboard executivo com análise detalhada de {statistics?.total || 0} receitas do sistema
          </p>
        </div>
      </div>

      {/* Estatísticas Principais */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Receitas</CardTitle>
              <Book className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total}</div>
              <p className="text-xs text-muted-foreground">
                {statistics.active} ativas • {statistics.inactive} inativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Com Custo Calculado</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statistics.withCost}</div>
              <p className="text-xs text-muted-foreground">
                {((statistics.withCost / statistics.total) * 100).toFixed(1)}% do total
              </p>
              <Progress value={(statistics.withCost / statistics.total) * 100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sem Custo</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{statistics.withoutCost}</div>
              <p className="text-xs text-muted-foreground">
                {((statistics.withoutCost / statistics.total) * 100).toFixed(1)}% do total
              </p>
              <Progress value={(statistics.withoutCost / statistics.total) * 100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prontas para Produção</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statistics.readyForProduction}</div>
              <p className="text-xs text-muted-foreground">
                {((statistics.readyForProduction / statistics.total) * 100).toFixed(1)}% do total
              </p>
              <Progress value={(statistics.readyForProduction / statistics.total) * 100} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alertas Críticos */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statistics.withoutIngredients > 0 && (
            <Alert className="border-destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>URGENTE:</strong> {statistics.withoutIngredients} receitas ({((statistics.withoutIngredients / statistics.total) * 100).toFixed(1)}%) 
                estão sem ingredientes cadastrados
              </AlertDescription>
            </Alert>
          )}
          
          {statistics.withoutCost > 0 && (
            <Alert className="border-yellow-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>CRÍTICO:</strong> {statistics.withoutCost} receitas ({((statistics.withoutCost / statistics.total) * 100).toFixed(1)}%) 
                estão sem custo calculado
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Tabs para diferentes visualizações */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="categories">Por Categoria</TabsTrigger>
          <TabsTrigger value="problematic">Problemáticas</TabsTrigger>
          <TabsTrigger value="detailed">Lista Detalhada</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Resumo Executivo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Resumo Executivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {statistics ? ((statistics.readyForProduction / statistics.total) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-sm text-green-700">Receitas Prontas</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {statistics ? statistics.mediumPriority : 0}
                    </div>
                    <div className="text-sm text-yellow-700">Prioridade Média</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {statistics ? statistics.highPriority : 0}
                    </div>
                    <div className="text-sm text-red-700">Alta Prioridade</div>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Recomendações:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Priorizar cadastro de ingredientes para {statistics?.withoutIngredients || 0} receitas</li>
                    <li>• Executar recálculo de custos para {statistics?.withoutCost || 0} receitas</li>
                    <li>• Revisar qualidade dos dados para melhorar produtividade</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categories.map((category) => (
                  <div key={category.name} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold">{category.name}</h4>
                      <Badge variant="outline">{category.count} receitas</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="text-green-600">
                        ✓ {category.withCost} com custo
                      </div>
                      <div className="text-red-600">
                        ✗ {category.withoutCost} sem custo
                      </div>
                      <div className="text-green-600">
                        ✓ {category.withIngredients} com ingredientes
                      </div>
                      <div className="text-red-600">
                        ✗ {category.withoutIngredients} sem ingredientes
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">Custos</div>
                          <Progress value={(category.withCost / category.count) * 100} className="h-2" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">Ingredientes</div>
                          <Progress value={(category.withIngredients / category.count) * 100} className="h-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="problematic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Receitas Problemáticas ({problematicRecipes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {problematicRecipes.slice(0, 20).map((recipe) => (
                  <div key={recipe.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{recipe.nome_receita}</div>
                      <div className="text-sm text-muted-foreground">{recipe.categoria_descricao}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {recipe.issues.map((issue, index) => (
                        <Badge key={index} variant="destructive" className="text-xs">
                          {issue}
                        </Badge>
                      ))}
                      <Badge 
                        variant={recipe.priority === 'high' ? 'destructive' : 'secondary'}
                        className={recipe.priority === 'high' ? '' : 'bg-yellow-600'}
                      >
                        {recipe.priority === 'high' ? 'URGENTE' : 'MÉDIA'}
                      </Badge>
                    </div>
                  </div>
                ))}
                {problematicRecipes.length > 20 && (
                  <div className="text-center text-muted-foreground text-sm">
                    E mais {problematicRecipes.length - 20} receitas problemáticas...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">

          {/* Filtros Avançados */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros e Busca</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar receitas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="all">Todos os status</option>
                  <option value="ready">Prontas para produção</option>
                  <option value="with_cost">Com custo</option>
                  <option value="without_cost">Sem custo</option>
                  <option value="with_ingredients">Com ingredientes</option>
                  <option value="without_ingredients">Sem ingredientes</option>
                  <option value="high_priority">Alta prioridade</option>
                  <option value="medium_priority">Média prioridade</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                >
                  Todas ({recipes.length})
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.name}
                    variant={selectedCategory === category.name ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    {category.name} ({category.count})
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tabela Detalhada */}
          <Card>
            <CardHeader>
              <CardTitle>
                Lista Detalhada ({filteredRecipes.length} receitas)
                {(statusFilter !== 'all' || selectedCategory !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory('all');
                      setStatusFilter('all');
                    }}
                    className="ml-2"
                  >
                    Limpar filtros
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da Receita</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Ingredientes</TableHead>
                    <TableHead>Porções</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Última Atualização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipes.slice(0, 50).map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="font-medium max-w-xs">
                        <div className="truncate" title={recipe.nome_receita}>
                          {recipe.nome_receita}
                        </div>
                      </TableCell>
                      <TableCell>{recipe.categoria_descricao || 'Sem Categoria'}</TableCell>
                      <TableCell>{getStatusBadge(recipe)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getCostBadge(recipe)}
                          {recipe.custo_total && (
                            <span className="text-xs text-muted-foreground">
                              R$ {recipe.custo_total.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getIngredientBadge(recipe)}</TableCell>
                      <TableCell>{recipe.porcoes || 1}</TableCell>
                      <TableCell>{recipe.tempo_preparo || 0}min</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(recipe.sync_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredRecipes.length > 50 && (
                <div className="text-center text-muted-foreground text-sm mt-4">
                  Mostrando 50 de {filteredRecipes.length} receitas. Use os filtros para refinar a busca.
                </div>
              )}
              
              {filteredRecipes.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Book className="h-8 w-8 text-muted-foreground mb-2" />
                  <h3 className="font-medium mb-1">Nenhuma receita encontrada</h3>
                  <p className="text-sm text-muted-foreground">
                    Tente ajustar os filtros ou termo de busca.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Receitas;