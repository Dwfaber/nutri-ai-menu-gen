import { useState } from 'react';
import { Search, Book, Filter, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, Users, TrendingUp, AlertCircle, Target, Zap, Settings, Calculator, RefreshCw } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRecipeAnalysis } from '@/hooks/useRecipeAnalysis';
import { useDetailedRecipeDiagnosis } from '@/hooks/useDetailedRecipeDiagnosis';
import { useRecipeCosting } from '@/hooks/useRecipeCosting';
import { useRecipeAuditor } from '@/hooks/useRecipeAuditor';
import { AuditConfigForm } from '@/components/Recipes/AuditConfigForm';
import { AuditResults } from '@/components/Recipes/AuditResults';

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

  const {
    diagnoses,
    metrics,
    loading: diagnosisLoading,
    error: diagnosisError,
    getDiagnosesByFilter,
    refetch: refetchDiagnosis
  } = useDetailedRecipeDiagnosis();

  const { 
    isRecalculating, 
    stats: costStats, 
    logs: costLogs, 
    triggerRecalculation 
  } = useRecipeCosting();

  const {
    auditing,
    progress: auditProgress,
    result: auditResult,
    error: auditError,
    currentCategory,
    runAudit,
    exportToJSON,
    exportToCSV
  } = useRecipeAuditor();

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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="categories">Por Categoria</TabsTrigger>
          <TabsTrigger value="problematic">Problemáticas</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnóstico Detalhado</TabsTrigger>
          <TabsTrigger value="audit">🔍 Auditoria</TabsTrigger>
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

        <TabsContent value="diagnosis" className="space-y-4">
          {diagnosisLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-lg text-muted-foreground">Analisando receitas...</div>
            </div>
          ) : diagnosisError ? (
            <Alert className="border-destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Erro ao carregar diagnóstico: {diagnosisError}</AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Métricas de Qualidade dos Dados */}
              {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Score Médio de Qualidade</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.averageQualityScore.toFixed(1)}%</div>
                      <Progress value={metrics.averageQualityScore} className="mt-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Receitas Bloqueadas</CardTitle>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">{metrics.blockedRecipes}</div>
                      <p className="text-xs text-muted-foreground">
                        {((metrics.blockedRecipes / metrics.totalRecipes) * 100).toFixed(1)}% do total
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Receitas Usáveis</CardTitle>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{metrics.usableRecipes}</div>
                      <p className="text-xs text-muted-foreground">
                        {((metrics.usableRecipes / metrics.totalRecipes) * 100).toFixed(1)}% do total
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Problemas Críticos</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">{metrics.criticalProblems}</div>
                      <p className="text-xs text-muted-foreground">
                        Precisam atenção imediata
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Sistema de Recálculo de Custos */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-primary" />
                      <CardTitle>Recálculo Automático de Custos</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={async () => {
                          await triggerRecalculation();
                          refetchDiagnosis();
                        }}
                        disabled={isRecalculating}
                        className="flex items-center gap-2"
                      >
                        {isRecalculating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            Recalculando...
                          </>
                        ) : (
                          <>
                            <Calculator className="h-4 w-4" />
                            Recalcular Custos
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={refetchDiagnosis}
                        variant="outline"
                        size="sm"
                        disabled={diagnosisLoading}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {costStats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-background rounded-lg border">
                        <div className="text-2xl font-bold">{costStats.total_recipes}</div>
                        <div className="text-sm text-muted-foreground">Total de Receitas</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="text-2xl font-bold text-green-600">{costStats.recipes_with_cost}</div>
                        <div className="text-sm text-green-700 dark:text-green-300">Com Custo Calculado</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="text-2xl font-bold text-orange-600">{costStats.recipes_without_cost}</div>
                        <div className="text-sm text-orange-700 dark:text-orange-300">Sem Custo</div>
                      </div>
                    </div>
                  )}
                  
                  {costStats && costStats.recipes_without_cost > 0 && (
                    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800 dark:text-orange-200">
                        <strong>{costStats.recipes_without_cost} receitas</strong> podem ter seus custos calculados automaticamente.
                        Execute o recálculo para processar receitas que têm ingredientes mas ainda não têm custo definido.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Categorias de Problemas Separadas */}
              <div className="space-y-6">
                {/* CRÍTICO - Receitas Bloqueadas (Sem Ingredientes) */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Card className="border-destructive bg-destructive/5 hover:bg-destructive/10 cursor-pointer transition-colors">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-destructive"></div>
                            <CardTitle className="text-lg text-destructive">
                              🔴 CRÍTICO - Receitas Bloqueadas (Sem Ingredientes)
                            </CardTitle>
                          </div>
                          <Badge variant="destructive">
                            {getDiagnosesByFilter('sem-ingredientes').length}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="mt-2">
                      <CardContent className="pt-6">
                        {getDiagnosesByFilter('sem-ingredientes').length > 0 ? (
                          <div className="space-y-4">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Receita</TableHead>
                                    <TableHead>Problemas</TableHead>
                                    <TableHead>Ação Necessária</TableHead>
                                    <TableHead>Impacto no Negócio</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {getDiagnosesByFilter('sem-ingredientes').slice(0, 20).map((diagnosis) => (
                                    <TableRow key={diagnosis.recipe.id}>
                                      <TableCell>
                                        <div className="font-medium">{diagnosis.recipe.nome_receita}</div>
                                        <div className="text-sm text-muted-foreground">
                                          ID: {diagnosis.recipe.receita_id_legado}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="space-y-1">
                                          {diagnosis.problems.filter(p => p.category === 'Ingredientes').map((problem, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                              <span>{problem.icon}</span>
                                              <span className="text-sm">{problem.description}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="space-y-1">
                                          {diagnosis.problems.filter(p => p.category === 'Ingredientes').map((problem, idx) => (
                                            <div key={idx} className="text-sm text-muted-foreground">
                                              {problem.action}
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="destructive" className="text-xs">
                                          {diagnosis.businessImpact}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {getDiagnosesByFilter('sem-ingredientes').length > 20 && (
                              <p className="text-sm text-muted-foreground text-center">
                                Mostrando 20 de {getDiagnosesByFilter('sem-ingredientes').length} receitas. 
                                Use a aba "Lista Detalhada" para ver todas.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                            <p>Nenhuma receita com problemas críticos de ingredientes!</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                {/* ERROS DE CADASTRO - Informações Incompletas */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Card className="border-orange-500 bg-orange-50 hover:bg-orange-100 cursor-pointer transition-colors">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                            <CardTitle className="text-lg text-orange-700">
                              🟠 ERROS DE CADASTRO (Informações Incompletas)
                            </CardTitle>
                          </div>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                            {getDiagnosesByFilter('erros-cadastro').length}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="mt-2">
                      <CardContent className="pt-6">
                        {getDiagnosesByFilter('erros-cadastro').length > 0 ? (
                          <div className="space-y-4">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Receita</TableHead>
                                    <TableHead>Problemas de Cadastro</TableHead>
                                    <TableHead>Ação Necessária</TableHead>
                                    <TableHead>Prioridade</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {getDiagnosesByFilter('erros-cadastro').slice(0, 20).map((diagnosis) => (
                                    <TableRow key={diagnosis.recipe.id}>
                                      <TableCell>
                                        <div className="font-medium">{diagnosis.recipe.nome_receita}</div>
                                        <div className="text-sm text-muted-foreground">
                                          Custo: {diagnosis.recipe.custo_total ? `R$ ${diagnosis.recipe.custo_total.toFixed(2)}` : 'N/A'}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="space-y-1">
                                          {diagnosis.problems.filter(p => 
                                            ['Categoria', 'Porções', 'Preparo', 'Tempo'].includes(p.category)
                                          ).map((problem, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                              <span>{problem.icon}</span>
                                              <span className="text-sm">{problem.description}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="space-y-1">
                                          {diagnosis.problems.filter(p => 
                                            ['Categoria', 'Porções', 'Preparo', 'Tempo'].includes(p.category)
                                          ).map((problem, idx) => (
                                            <div key={idx} className="text-sm text-muted-foreground">
                                              {problem.action}
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="secondary" className="text-xs">
                                          {diagnosis.severity.toUpperCase()}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {getDiagnosesByFilter('erros-cadastro').length > 20 && (
                              <p className="text-sm text-muted-foreground text-center">
                                Mostrando 20 de {getDiagnosesByFilter('erros-cadastro').length} receitas. 
                                Use a aba "Lista Detalhada" para ver todas.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                            <p>Nenhuma receita com erros de cadastro!</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                {/* PROBLEMAS DE CUSTO - Ingredientes OK, Custo Pendente */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Card className="border-yellow-500 bg-yellow-50 hover:bg-yellow-100 cursor-pointer transition-colors">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <CardTitle className="text-lg text-yellow-700">
                              🟡 PROBLEMAS DE CUSTO (Ingredientes OK, Custo Pendente)
                            </CardTitle>
                          </div>
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                            {getDiagnosesByFilter('problemas-custo').length}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="mt-2">
                      <CardContent className="pt-6">
                        {getDiagnosesByFilter('problemas-custo').length > 0 ? (
                          <div className="space-y-4">
                            <div className="flex gap-2 mb-4">
                              <Button 
                                onClick={async () => {
                                  await triggerRecalculation();
                                  refetchDiagnosis();
                                }}
                                disabled={isRecalculating}
                                className="flex items-center gap-2"
                              >
                                {isRecalculating ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Calculator className="h-4 w-4" />
                                )}
                                Recalcular Custos de Todas
                              </Button>
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Receita</TableHead>
                                    <TableHead>Problema de Custo</TableHead>
                                    <TableHead>Status dos Ingredientes</TableHead>
                                    <TableHead>Ação</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {getDiagnosesByFilter('problemas-custo').slice(0, 20).map((diagnosis) => (
                                    <TableRow key={diagnosis.recipe.id}>
                                      <TableCell>
                                        <div className="font-medium">{diagnosis.recipe.nome_receita}</div>
                                        <div className="text-sm text-muted-foreground">
                                          Categoria: {diagnosis.recipe.categoria_descricao || 'Não definida'}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="space-y-1">
                                          {diagnosis.problems.filter(p => p.category === 'Custo').map((problem, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                              <span>{problem.icon}</span>
                                              <span className="text-sm">{problem.description}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-green-700 border-green-700">
                                          Ingredientes OK
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Button variant="outline" size="sm" className="text-xs">
                                          Recalcular Individual
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {getDiagnosesByFilter('problemas-custo').length > 20 && (
                              <p className="text-sm text-muted-foreground text-center">
                                Mostrando 20 de {getDiagnosesByFilter('problemas-custo').length} receitas. 
                                Use a aba "Lista Detalhada" para ver todas.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                            <p>Nenhuma receita com problemas de custo!</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Diagnóstico Detalhado por Receita */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Diagnóstico Individual Detalhado
                    </CardTitle>
                    <Button
                      onClick={refetchDiagnosis}
                      variant="outline"
                      size="sm"
                      disabled={diagnosisLoading}
                    >
                      {diagnosisLoading ? 'Atualizando...' : 'Atualizar Diagnósticos'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receita</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Problemas Identificados</TableHead>
                        <TableHead>Ação Requerida</TableHead>
                        <TableHead>Impacto no Negócio</TableHead>
                        <TableHead>Tempo p/ Correção</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diagnoses.slice(0, 50).map((diagnosis) => (
                        <TableRow key={diagnosis.recipe.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{diagnosis.recipe.nome_receita}</div>
                              <div className="text-sm text-muted-foreground">
                                {diagnosis.recipe.categoria_descricao || 'Sem categoria'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold">{diagnosis.qualityScore}%</span>
                              <Progress value={diagnosis.qualityScore} className="w-16 h-2" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {diagnosis.problems.slice(0, 3).map((problem, index) => (
                                <div key={index} className="flex items-center gap-1 text-xs">
                                  <span>{problem.icon}</span>
                                  <span>{problem.description}</span>
                                </div>
                              ))}
                              {diagnosis.problems.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  +{diagnosis.problems.length - 3} problemas...
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {diagnosis.problems.slice(0, 2).map((problem, index) => (
                                <div key={index} className="text-xs">
                                  • {problem.action}
                                </div>
                              ))}
                              {diagnosis.problems.length > 2 && (
                                <Button variant="outline" size="sm" className="h-6 text-xs">
                                  Ver todas ações
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {diagnosis.businessImpact}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {diagnosis.estimatedFixTime}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {diagnosis.canBeUsed ? (
                              <Badge variant="default" className="bg-green-600">
                                Usável
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                Bloqueada
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {diagnoses.length > 50 && (
                    <div className="text-center text-muted-foreground text-sm mt-4">
                      Mostrando 50 de {diagnoses.length} receitas. Use os filtros para refinar a busca.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Painel de Ações Corretivas em Massa */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Ações Corretivas em Massa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-destructive">🔴 Ações Urgentes</h4>
                      <Button variant="destructive" size="sm" className="w-full">
                        Corrigir {getDiagnosesByFilter('no_ingredients').length} receitas sem ingredientes
                      </Button>
                      <Button variant="destructive" size="sm" className="w-full">
                        Reativar receitas inativas úteis
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-orange-600">🟠 Ações Importantes</h4>
                      <Button variant="outline" size="sm" className="w-full border-orange-600">
                        Recalcular {getDiagnosesByFilter('no_cost').length} custos zerados
                      </Button>
                      <Button variant="outline" size="sm" className="w-full border-orange-600">
                        Revisar custos muito altos
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-yellow-600">🟡 Melhorias</h4>
                      <Button variant="outline" size="sm" className="w-full border-yellow-600">
                        Definir categorias em falta
                      </Button>
                      <Button variant="outline" size="sm" className="w-full border-yellow-600">
                        Completar modos de preparo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Auditoria Completa de Categorias
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Análise profunda baseada nos CRITERIOS_AVALIACAO
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <AuditConfigForm 
                onStartAudit={(config) => runAudit(config)}
                isAuditing={auditing}
              />

              {auditing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {currentCategory || 'Processando...'}
                    </span>
                    <span className="font-medium">{auditProgress}%</span>
                  </div>
                  <Progress value={auditProgress} className="h-2" />
                </div>
              )}

              {auditResult && (
                <AuditResults 
                  result={auditResult}
                  onExportJSON={exportToJSON}
                  onExportCSV={exportToCSV}
                />
              )}

              {auditError && (
                <Alert className="border-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{auditError}</AlertDescription>
                </Alert>
              )}
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