import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { DailyCostBreakdown, CostValidationRules } from '@/types/clientCosts';

interface CostBreakdownCardProps {
  dailyCosts: DailyCostBreakdown;
  validationRules: CostValidationRules;
  totalBranches: number;
}

const CostBreakdownCard = ({ dailyCosts, validationRules, totalBranches }: CostBreakdownCardProps) => {
  const dayNames = [
    { key: 'monday', label: 'Seg', value: dailyCosts.monday },
    { key: 'tuesday', label: 'Ter', value: dailyCosts.tuesday },
    { key: 'wednesday', label: 'Qua', value: dailyCosts.wednesday },
    { key: 'thursday', label: 'Qui', value: dailyCosts.thursday },
    { key: 'friday', label: 'Sex', value: dailyCosts.friday },
    { key: 'saturday', label: 'Sáb', value: dailyCosts.saturday },
    { key: 'sunday', label: 'Dom', value: dailyCosts.sunday }
  ];

  const getHighestCostDay = () => {
    return dayNames.reduce((max, day) => day.value > max.value ? day : max);
  };

  const getLowestCostDay = () => {
    return dayNames.reduce((min, day) => day.value < min.value ? day : min);
  };

  const highestDay = getHighestCostDay();
  const lowestDay = getLowestCostDay();

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Custos por Dia da Semana
          <Badge variant="outline" className="text-xs">
            {totalBranches} filiais
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily Cost Grid */}
        <div className="grid grid-cols-7 gap-1 text-xs">
          {dayNames.map((day) => (
            <div key={day.key} className="text-center">
              <div className="font-medium text-gray-600 mb-1">{day.label}</div>
              <div className={`p-1 rounded text-xs font-medium ${
                day.value === highestDay.value ? 'bg-red-100 text-red-700' :
                day.value === lowestDay.value ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                R$ {day.value.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Special Day Cost */}
        {dailyCosts.special > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Dias Especiais:</span>
            <Badge variant="secondary">R$ {dailyCosts.special.toFixed(2)}</Badge>
          </div>
        )}

        {/* Cost Summary */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-blue-500" />
            <div>
              <div className="text-xs text-gray-600">Média Semanal</div>
              <div className="text-sm font-semibold">R$ {dailyCosts.average.toFixed(2)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-purple-500" />
            <div>
              <div className="text-xs text-gray-600">Total Semanal</div>
              <div className="text-sm font-semibold">R$ {dailyCosts.weekTotal.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Cost Validation Rules */}
        {validationRules.useAverageValidation && (
          <div className="mt-3 p-2 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-blue-600" />
                <span className="font-medium text-blue-700">Validação Ativa</span>
              </div>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Limite: +{validationRules.maxPercentageAboveAverage}% acima da média
              (máx. R$ {validationRules.maxAllowedCost.toFixed(2)})
            </div>
          </div>
        )}

        {/* Highest/Lowest Days */}
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-red-500" />
            <span className="text-gray-600">Maior:</span>
            <span className="font-medium">{highestDay.label} (R$ {highestDay.value.toFixed(2)})</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-green-500" />
            <span className="text-gray-600">Menor:</span>
            <span className="font-medium">{lowestDay.label} (R$ {lowestDay.value.toFixed(2)})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CostBreakdownCard;