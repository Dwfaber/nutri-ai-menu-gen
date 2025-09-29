import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRecipeAudit } from '@/hooks/useRecipeAudit';
import { AlertTriangle, Search, RefreshCw, TrendingUp, XCircle, AlertCircle, Info } from 'lucide-react';

interface ProblematicRecipe {
  receita_id: string;
  nome: string;
  categoria: string;
  problems: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    details?: Record<string, any>;
  }>;
  detected_at: Date;
  source: string;
}

export function RecipeAuditDashboard() {
  const {
    getProblematicRecipes,
    getAuditMetrics,
    runBatchAudit,
    isAuditing,
    error
  } = useRecipeAudit();

  const [problematicRecipes, setProblematicRecipes] = useState<ProblematicRecipe[]>([]);
  const [metrics, setMetrics] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const [recipesData, metricsData] = await Promise.all([
        getProblematicRecipes(searchFilter),
        getAuditMetrics()
      ]);
      setProblematicRecipes(recipesData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Erro ao carregar dados de auditoria:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    const recipes = await getProblematicRecipes(searchFilter);
    setProblematicRecipes(recipes);
    setLoading(false);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'outline';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const filteredRecipes = problematicRecipes.filter(recipe => {
    if (selectedSeverity === 'all') return true;
    return recipe.problems.some(p => p.severity === selectedSeverity);
  });

  const runQuickAudit = async () => {
    // Auditar algumas receitas problemáticas conhecidas para teste
    const testRecipeIds = ['1', '2', '3', '4', '5'];
    await runBatchAudit(testRecipeIds);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando dados de auditoria...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auditoria de Receitas</h1>
          <p className="text-muted-foreground">
            Sistema de monitoramento e análise de receitas problemáticas
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={runQuickAudit} 
            disabled={isAuditing}
            variant="outline"
          >
            {isAuditing ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <TrendingUp className="h-4 w-4 mr-2" />
            )}
            Executar Auditoria
          </Button>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Métricas */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Auditadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_recipes_audited}</div>
              <p className="text-xs text-muted-foreground">receitas analisadas</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Problemáticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{metrics.problematic_recipes}</div>
              <p className="text-xs text-muted-foreground">com problemas detectados</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Críticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{metrics.critical_issues}</div>
              <p className="text-xs text-muted-foreground">problemas críticos</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cobertura</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.audit_coverage_percentage}%</div>
              <p className="text-xs text-muted-foreground">da base auditada</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por nome da receita, categoria ou ID..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <Tabs value={selectedSeverity} onValueChange={setSelectedSeverity}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="critical">Críticos</TabsTrigger>
            <TabsTrigger value="high">Alto</TabsTrigger>
            <TabsTrigger value="medium">Médio</TabsTrigger>
            <TabsTrigger value="low">Baixo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Lista de Receitas Problemáticas */}
      <Card>
        <CardHeader>
          <CardTitle>Receitas Problemáticas ({filteredRecipes.length})</CardTitle>
          <CardDescription>
            Lista de receitas com problemas detectados pelo sistema de auditoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRecipes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma receita problemática encontrada</p>
              <p className="text-sm">Use os filtros para refinar a busca</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecipes.map((recipe, index) => (
                <Card key={`${recipe.receita_id}-${index}`} className="border-l-4 border-l-destructive">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{recipe.nome}</CardTitle>
                        <CardDescription>
                          ID: {recipe.receita_id} • Categoria: {recipe.categoria}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{recipe.source}</Badge>
                        <Badge variant="secondary">
                          {new Date(recipe.detected_at).toLocaleDateString('pt-BR')}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <h5 className="font-medium">Problemas Detectados:</h5>
                      <div className="grid gap-2">
                        {recipe.problems.map((problem, problemIndex) => (
                          <div
                            key={problemIndex}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                          >
                            {getSeverityIcon(problem.severity)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={getSeverityColor(problem.severity)} className="text-xs">
                                  {problem.severity.toUpperCase()}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {problem.type}
                                </Badge>
                              </div>
                              <p className="text-sm">{problem.message}</p>
                              {problem.details && (
                                <pre className="text-xs text-muted-foreground mt-1 bg-background p-2 rounded">
                                  {JSON.stringify(problem.details, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}