
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Percent, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Zap
} from 'lucide-react';

interface OptimizationSummary {
  enabled: boolean;
  products_optimized: number;
  total_savings: number;
  promotions_used: number;
  products_with_surplus: number;
}

interface OptimizationResultsProps {
  summary: OptimizationSummary;
  budgetStatus: {
    predicted: number;
    actual: number;
    withinBudget: boolean;
    difference: number;
  };
  className?: string;
}

const OptimizationResults: React.FC<OptimizationResultsProps> = ({ 
  summary, 
  budgetStatus,
  className 
}) => {
  if (!summary.enabled) {
    return null;
  }

  const savingsPercentage = budgetStatus.predicted > 0 
    ? (summary.total_savings / budgetStatus.predicted) * 100 
    : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header com Badge de Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold">Otimização Aplicada</h3>
        </div>
        <Badge className="bg-purple-100 text-purple-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ativa
        </Badge>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Economia Total</p>
                <p className="text-xl font-bold text-green-600">
                  R$ {summary.total_savings.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  {savingsPercentage.toFixed(1)}% do orçamento
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Produtos Otimizados</p>
                <p className="text-xl font-bold">{summary.products_optimized}</p>
                <p className="text-xs text-gray-500">
                  com algoritmo aplicado
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Promoções Usadas</p>
                <p className="text-xl font-bold">{summary.promotions_used}</p>
                <p className="text-xs text-gray-500">
                  aproveitamento máximo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              {summary.products_with_surplus > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-600">Sobras</p>
                <p className="text-xl font-bold">{summary.products_with_surplus}</p>
                <p className="text-xs text-gray-500">
                  produtos com sobra
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparativo Orçamento */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50">
        <CardHeader>
          <CardTitle className="text-green-800 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Impacto no Orçamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Orçamento Previsto</p>
              <p className="text-2xl font-bold text-gray-800">
                R$ {budgetStatus.predicted.toFixed(2)}
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">Custo com Otimização</p>
              <p className="text-2xl font-bold text-blue-600">
                R$ {budgetStatus.actual.toFixed(2)}
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                {budgetStatus.withinBudget ? 'Economia Adicional' : 'Excesso'}
              </p>
              <p className={`text-2xl font-bold ${
                budgetStatus.withinBudget ? 'text-green-600' : 'text-red-600'
              }`}>
                R$ {Math.abs(budgetStatus.difference).toFixed(2)}
              </p>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="text-center">
            <Badge 
              className={`px-4 py-2 text-sm ${
                budgetStatus.withinBudget 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {budgetStatus.withinBudget 
                ? `✅ Dentro do Orçamento - Economia de R$ ${summary.total_savings.toFixed(2)}` 
                : `⚠️ Orçamento Excedido em R$ ${Math.abs(budgetStatus.difference).toFixed(2)}`
              }
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OptimizationResults;
