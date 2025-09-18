import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';

interface MenuCostSummaryProps {
  totalCost: number;
  baseCost: number;
  variableCost: number;
  mealsPerDay: number;
  adjustedRecipes: number;
  budgetPerMeal?: number;
}

export function MenuCostSummary({ 
  totalCost, 
  baseCost, 
  variableCost, 
  mealsPerDay,
  adjustedRecipes,
  budgetPerMeal 
}: MenuCostSummaryProps) {
  const costPerMeal = totalCost / mealsPerDay;
  const isOverBudget = budgetPerMeal && costPerMeal > budgetPerMeal;
  const budgetUsage = budgetPerMeal ? (costPerMeal / budgetPerMeal) * 100 : null;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Resumo de Custos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Cost */}
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <span className="font-medium">Custo Total do Dia:</span>
          <span className="text-xl font-bold text-blue-600">
            R$ {totalCost.toFixed(2)}
          </span>
        </div>

        {/* Cost per meal */}
        <div className="flex justify-between items-center">
          <span>Custo por Refeição:</span>
          <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
            R$ {costPerMeal.toFixed(2)}
          </span>
        </div>

        {/* Budget comparison */}
        {budgetPerMeal && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span>Orçamento por Refeição:</span>
              <span>R$ {budgetPerMeal.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Uso do Orçamento:</span>
              <Badge variant={isOverBudget ? "destructive" : "default"}>
                {budgetUsage?.toFixed(1)}%
              </Badge>
              {isOverBudget && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
          </div>
        )}

        {/* Cost breakdown */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="text-center">
            <div className="text-sm text-gray-600">Custos Base</div>
            <div className="font-semibold">R$ {baseCost.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Variáveis</div>
            <div className="font-semibold">R$ {variableCost.toFixed(2)}</div>
          </div>
        </div>

        {/* Adjustments warning */}
        {adjustedRecipes > 0 && (
          <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-800">
              {adjustedRecipes} receitas com custos ajustados
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}