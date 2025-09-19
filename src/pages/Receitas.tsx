import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Search, ChefHat, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useRecipeAnalysis } from '@/hooks/useRecipeAnalysis';
import { Separator } from '@/components/ui/separator';

const Receitas = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const { data: recipeData, isLoading, error } = useRecipeAnalysis();

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const filteredCategories = recipeData?.filter(category => 
    category.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.receitas_completas.some(recipe => 
      recipe.nome.toLowerCase().includes(searchTerm.toLowerCase())
    ) ||
    category.receitas_problematicas.some(recipe => 
      recipe.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (percentage >= 50) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    return 'bg-red-500/10 text-red-500 border-red-500/20';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <ChefHat className="mx-auto h-12 w-12 text-muted-foreground animate-pulse" />
            <p className="mt-2 text-sm text-muted-foreground">Carregando análise de receitas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p>Erro ao carregar dados das receitas</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalReceitas = recipeData?.reduce((sum, cat) => sum + cat.total_receitas, 0) || 0;
  const totalCompletas = recipeData?.reduce((sum, cat) => sum + cat.receitas_completas.length, 0) || 0;
  const percentualGeral = totalReceitas > 0 ? (totalCompletas / totalReceitas) * 100 : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise de Receitas</h1>
          <p className="text-muted-foreground">
            Visualize receitas completas vs problemáticas por categoria
          </p>
        </div>
      </div>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <ChefHat className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalReceitas}</p>
                <p className="text-xs text-muted-foreground">Total de Receitas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 rounded-full bg-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{totalCompletas}</p>
                <p className="text-xs text-muted-foreground">Receitas Completas (5+ ingredientes)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 rounded-full bg-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-600">{totalReceitas - totalCompletas}</p>
                <p className="text-xs text-muted-foreground">Receitas Problemáticas (0-4 ingredientes)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por categoria ou nome da receita..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Categorias */}
      <div className="space-y-4">
        {filteredCategories.map((category) => {
          const isOpen = openCategories[category.nome];
          const completionPercentage = category.total_receitas > 0 
            ? (category.receitas_completas.length / category.total_receitas) * 100 
            : 0;

          return (
            <Card key={category.nome}>
              <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category.nome)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <CardTitle className="text-xl">{category.nome}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant="outline" 
                          className={getCompletionColor(completionPercentage)}
                        >
                          {completionPercentage.toFixed(1)}% completas
                        </Badge>
                        <Badge variant="secondary">
                          {category.total_receitas} receitas
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Receitas Completas */}
                      <div>
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="h-3 w-3 rounded-full bg-green-500" />
                          <h3 className="font-semibold text-green-700">
                            Receitas Completas ({category.receitas_completas.length})
                          </h3>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {category.receitas_completas.length > 0 ? (
                            category.receitas_completas
                              .filter(recipe => 
                                searchTerm === '' || 
                                recipe.nome.toLowerCase().includes(searchTerm.toLowerCase())
                              )
                              .map((recipe, index) => (
                                <div 
                                  key={index}
                                  className="p-2 bg-green-50 rounded-lg text-sm border border-green-200"
                                >
                                  <span className="font-medium">{recipe.nome}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {recipe.ingredientes} ingredientes
                                  </Badge>
                                </div>
                              ))
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Nenhuma receita completa encontrada
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Receitas Problemáticas */}
                      <div>
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="h-3 w-3 rounded-full bg-red-500" />
                          <h3 className="font-semibold text-red-700">
                            Receitas Problemáticas ({category.receitas_problematicas.length})
                          </h3>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {category.receitas_problematicas.length > 0 ? (
                            category.receitas_problematicas
                              .filter(recipe => 
                                searchTerm === '' || 
                                recipe.nome.toLowerCase().includes(searchTerm.toLowerCase())
                              )
                              .map((recipe, index) => (
                                <div 
                                  key={index}
                                  className="p-2 bg-red-50 rounded-lg text-sm border border-red-200"
                                >
                                  <span className="font-medium">{recipe.nome}</span>
                                  <Badge 
                                    variant="outline" 
                                    className="ml-2 text-xs bg-red-100 text-red-700 border-red-300"
                                  >
                                    {recipe.ingredientes} ingredientes
                                  </Badge>
                                </div>
                              ))
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Todas as receitas estão completas!
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Separator className="mt-4" />
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p>
                        <strong>Receitas Completas:</strong> Possuem 5 ou mais ingredientes e podem ter custos calculados com precisão.
                      </p>
                      <p>
                        <strong>Receitas Problemáticas:</strong> Possuem 0-4 ingredientes e precisam de sistema de fallback para cálculo de custos.
                      </p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {filteredCategories.length === 0 && searchTerm && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Search className="mx-auto h-12 w-12 mb-2" />
              <p>Nenhuma receita encontrada para "{searchTerm}"</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Receitas;