import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface MenuCostBreakdownProps {
  menu: {
    days: Array<{
      dia: string;
      budget_per_meal: number;
      custo_por_refeicao: number;
      custo_total_dia: number;
      dentro_orcamento: boolean;
      itens: Array<{
        slot: string;
        nome: string;
        custo_total: number;
        custo_por_refeicao: number;
        placeholder?: boolean;
      }>;
    }>;
    total_cost: number;
    average_cost_per_meal: number;
    portions_total: number;
  };
  warnings?: string[];
}

export function MenuCostBreakdown({ menu, warnings = [] }: MenuCostBreakdownProps) {
  const totalBudget = menu.days.reduce((sum, day) => sum + (day.budget_per_meal * menu.portions_total / menu.days.length), 0);
  const totalCost = menu.total_cost;
  const isOverBudget = totalCost > totalBudget;
  const savings = totalBudget - totalCost;
  const savingsPercentage = totalBudget > 0 ? (savings / totalBudget) * 100 : 0;

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
                {day.itens.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
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
                ))}
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