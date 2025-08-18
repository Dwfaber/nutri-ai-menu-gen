import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, ChevronDown, ChevronRight, Package, DollarSign, Target, Zap } from 'lucide-react';

interface DetailedIngredient {
  nome: string;
  quantidade_necessaria: number;
  unidade: string;
  preco_embalagem: number;
  tamanho_embalagem: number;
  custo_unitario: number;
  custo_total: number;
  custo_por_refeicao: number;
  pode_fracionado: boolean;
  eficiencia_uso: number;
  produto_encontrado: boolean;
  descricao_produto?: string;
  promocao?: boolean;
}

interface DetailedRecipe {
  slot: string;
  nome: string;
  custo_total: number;
  custo_por_refeicao: number;
  placeholder?: boolean;
  ingredientes?: DetailedIngredient[];
}

interface MenuCostBreakdownProps {
  menu: {
    days: Array<{
      dia: string;
      budget_per_meal: number;
      custo_por_refeicao: number;
      custo_total_dia: number;
      dentro_orcamento: boolean;
      itens: Array<DetailedRecipe>;
    }>;
    total_cost: number;
    average_cost_per_meal: number;
    portions_total: number;
    analise_detalhada?: {
      ingredientes_mais_caros: DetailedIngredient[];
      produtos_sem_base_id: number;
      produtos_em_promocao: number;
      eficiencia_media: number;
      sugestoes_economia: string[];
    };
  };
  warnings?: string[];
}

export function MenuCostBreakdown({ menu, warnings = [] }: MenuCostBreakdownProps) {
  const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set());
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  
  const totalBudget = menu.days.reduce((sum, day) => sum + (day.budget_per_meal * menu.portions_total / menu.days.length), 0);
  const totalCost = menu.total_cost;
  const isOverBudget = totalCost > totalBudget;
  const savings = totalBudget - totalCost;
  const savingsPercentage = totalBudget > 0 ? (savings / totalBudget) * 100 : 0;

  const toggleRecipeExpansion = (recipeKey: string) => {
    const newExpanded = new Set(expandedRecipes);
    if (newExpanded.has(recipeKey)) {
      newExpanded.delete(recipeKey);
    } else {
      newExpanded.add(recipeKey);
    }
    setExpandedRecipes(newExpanded);
  };

  const getSlotColor = (slot: string) => {
    switch (slot) {
      case 'ARROZ BRANCO': return 'bg-amber-100 text-amber-800';
      case 'FEIJÃO': return 'bg-green-100 text-green-800';
      case 'PRATO PRINCIPAL 1':
      case 'PRATO PRINCIPAL 2': return 'bg-red-100 text-red-800';
      case 'SALADA 1 (VERDURAS)':
      case 'SALADA 2 (LEGUMES)': return 'bg-emerald-100 text-emerald-800';
      case 'SUCO 1':
      case 'SUCO 2': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOverBudget ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            Resumo Financeiro do Cardápio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                R$ {menu.average_cost_per_meal.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Custo por Refeição</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                R$ {totalCost.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Custo Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">
                R$ {totalBudget.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Orçamento Total</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${
                savings >= 0 ? 'text-green-600' : 'text-destructive'
              }`}>
                {savings >= 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                R$ {Math.abs(savings).toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">
                {savings >= 0 ? 'Economia' : 'Excesso'}
              </div>
            </div>
          </div>

          {savingsPercentage !== 0 && (
            <div className="text-center">
              <Badge variant={savingsPercentage > 0 ? "default" : "destructive"}>
                {savingsPercentage > 0 ? 'Economia de' : 'Excesso de'} {Math.abs(savingsPercentage).toFixed(1)}%
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown por Dia */}
      <div className="grid gap-4">
        {menu.days.map((day, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{day.dia}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={day.dentro_orcamento ? "default" : "destructive"}>
                    R$ {day.custo_por_refeicao.toFixed(2)} / R$ {day.budget_per_meal.toFixed(2)}
                  </Badge>
                  {day.dentro_orcamento ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {day.itens.map((item, itemIndex) => {
                  const recipeKey = `${day.dia}-${itemIndex}`;
                  const isExpanded = expandedRecipes.has(recipeKey);
                  const hasIngredients = item.ingredientes && item.ingredientes.length > 0;
                  
                  return (
                    <div key={itemIndex} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {hasIngredients && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRecipeExpansion(recipeKey)}
                              className="h-6 w-6 p-0"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          )}
                          <Badge variant="outline" className={getSlotColor(item.slot)}>
                            {item.slot}
                          </Badge>
                          <span className={`text-sm ${item.placeholder ? 'text-muted-foreground italic' : ''}`}>
                            {item.nome}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">R$ {item.custo_total.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">
                            R$ {item.custo_por_refeicao.toFixed(2)} / porção
                          </div>
                        </div>
                      </div>
                      
                      {hasIngredients && isExpanded && (
                        <Collapsible open={isExpanded}>
                          <CollapsibleContent className="mt-3 pl-8">
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Ingredientes Detalhados:</h5>
                              {item.ingredientes!.map((ingrediente, idx) => (
                                <div key={idx} className="bg-muted/50 p-2 rounded text-xs space-y-1">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-medium">{ingrediente.nome}</div>
                                      <div className="text-muted-foreground">
                                        Precisa: {ingrediente.quantidade_necessaria} {ingrediente.unidade}
                                      </div>
                                      {ingrediente.descricao_produto && (
                                        <div className="text-muted-foreground">
                                          Produto: {ingrediente.descricao_produto}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium">R$ {ingrediente.custo_por_refeicao.toFixed(4)}</div>
                                      <div className="text-muted-foreground">por porção</div>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Embalagem:</span> {ingrediente.tamanho_embalagem} {ingrediente.unidade}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Preço:</span> R$ {ingrediente.preco_embalagem.toFixed(2)}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Fracionado:</span> {ingrediente.pode_fracionado ? 'Sim' : 'Não'}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Eficiência:</span> {(ingrediente.eficiencia_uso * 100).toFixed(1)}%
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-1">
                                    {!ingrediente.produto_encontrado && (
                                      <Badge variant="destructive" className="text-xs">Produto não encontrado</Badge>
                                    )}
                                    {ingrediente.promocao && (
                                      <Badge variant="secondary" className="text-xs">Em promoção</Badge>
                                    )}
                                    {ingrediente.eficiencia_uso < 0.3 && (
                                      <Badge variant="outline" className="text-xs text-amber-600">Baixa eficiência</Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total do Dia:</span>
                  <span className="font-bold text-lg">R$ {day.custo_total_dia.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Análise Detalhada */}
      {menu.analise_detalhada && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Análise Detalhada de Custos
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetailedAnalysis(!showDetailedAnalysis)}
              >
                {showDetailedAnalysis ? 'Ocultar' : 'Mostrar'} Análise
              </Button>
            </CardTitle>
          </CardHeader>
          {showDetailedAnalysis && (
            <CardContent className="space-y-4">
              {/* Métricas Principais */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-lg font-bold text-primary">
                    {menu.analise_detalhada.produtos_sem_base_id}
                  </div>
                  <div className="text-xs text-muted-foreground">Produtos sem ID</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-lg font-bold text-green-600">
                    {menu.analise_detalhada.produtos_em_promocao}
                  </div>
                  <div className="text-xs text-muted-foreground">Em Promoção</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-lg font-bold">
                    {(menu.analise_detalhada.eficiencia_media * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Eficiência Média</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-lg font-bold text-amber-600">
                    {menu.analise_detalhada.ingredientes_mais_caros.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Ingredientes Caros</div>
                </div>
              </div>

              {/* Ingredientes Mais Caros */}
              {menu.analise_detalhada.ingredientes_mais_caros.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Top 5 Ingredientes Mais Caros
                  </h4>
                  <div className="space-y-2">
                    {menu.analise_detalhada.ingredientes_mais_caros.slice(0, 5).map((ingrediente, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                        <div>
                          <div className="font-medium text-sm">{ingrediente.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {ingrediente.descricao_produto}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">R$ {ingrediente.custo_por_refeicao.toFixed(4)}</div>
                          <div className="text-xs text-muted-foreground">por porção</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestões de Economia */}
              {menu.analise_detalhada.sugestoes_economia.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Sugestões de Economia
                  </h4>
                  <div className="space-y-1">
                    {menu.analise_detalhada.sugestoes_economia.map((sugestao, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                        {sugestao}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Avisos do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {warnings.map((warning, index) => (
                <li key={index} className="text-sm text-amber-700 flex items-start gap-2">
                  <span className="w-1 h-1 bg-amber-600 rounded-full mt-2 flex-shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}