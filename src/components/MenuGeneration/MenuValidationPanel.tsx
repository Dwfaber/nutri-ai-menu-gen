import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { MenuBusinessRules, MenuViolation } from '@/hooks/useMenuBusinessRules';

interface MenuValidationPanelProps {
  rules: MenuBusinessRules;
  violations: MenuViolation[];
  marketAvailability: {
    totalIngredients: number;
    availableIngredients: number;
    missingIngredients: string[];
  };
}

const MenuValidationPanel: React.FC<MenuValidationPanelProps> = ({
  rules,
  violations,
  marketAvailability
}) => {
  const getRuleIcon = (isValid: boolean) => {
    return isValid ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    );
  };

  const getRuleBadge = (isValid: boolean) => {
    return (
      <Badge variant={isValid ? "default" : "destructive"} className="text-xs">
        {isValid ? "OK" : "VIOLAÇÃO"}
      </Badge>
    );
  };

  const availabilityPercentage = marketAvailability.totalIngredients > 0 
    ? (marketAvailability.availableIngredients / marketAvailability.totalIngredients) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Validação de Regras de Negócio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Market Availability */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Disponibilidade de Ingredientes no Mercado
          </h4>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {marketAvailability.availableIngredients} de {marketAvailability.totalIngredients} ingredientes disponíveis
            </span>
            <Badge 
              variant={availabilityPercentage >= 80 ? "default" : "destructive"}
              className="text-xs"
            >
              {availabilityPercentage.toFixed(1)}%
            </Badge>
          </div>
          {marketAvailability.missingIngredients.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-blue-700 mb-1">Ingredientes não disponíveis:</p>
              <div className="flex flex-wrap gap-1">
                {marketAvailability.missingIngredients.slice(0, 5).map((ingredient, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {ingredient}
                  </Badge>
                ))}
                {marketAvailability.missingIngredients.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{marketAvailability.missingIngredients.length - 5} mais
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Business Rules */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Regras de Negócio:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {getRuleIcon(rules.proteinVariety)}
                <span className="text-sm">Variedade de Proteínas</span>
              </div>
              {getRuleBadge(rules.proteinVariety)}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {getRuleIcon(rules.redMeatLimit)}
                <span className="text-sm">Limite Carnes Vermelhas</span>
              </div>
              {getRuleBadge(rules.redMeatLimit)}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {getRuleIcon(rules.mondayProcessing)}
                <span className="text-sm">Processos Segunda-feira</span>
              </div>
              {getRuleBadge(rules.mondayProcessing)}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {getRuleIcon(rules.requiredStructure)}
                <span className="text-sm">Estrutura Completa</span>
              </div>
              {getRuleBadge(rules.requiredStructure)}
            </div>
          </div>
        </div>

        {/* Violations */}
        {violations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-red-900">Violações Encontradas:</h4>
            {violations.map((violation, index) => (
              <Alert key={index} variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{violation.day ? `${violation.day}: ` : ''}</strong>
                  {violation.message}
                  {violation.recipes && violation.recipes.length > 0 && (
                    <div className="mt-1 text-xs">
                      Receitas: {violation.recipes.join(', ')}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Success Message */}
        {violations.length === 0 && Object.values(rules).every(rule => rule) && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Todas as regras de negócio foram atendidas! O cardápio está aprovado para geração.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default MenuValidationPanel;