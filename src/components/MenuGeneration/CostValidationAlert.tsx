import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface CostValidationAlertProps {
  adjustedRecipes: number;
  totalRecipes: number;
  totalCostAdjustment: number;
}

export function CostValidationAlert({ 
  adjustedRecipes, 
  totalRecipes, 
  totalCostAdjustment 
}: CostValidationAlertProps) {
  if (adjustedRecipes === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Todos os custos das receitas foram calculados com sucesso. ✅
        </AlertDescription>
      </Alert>
    );
  }

  const percentage = ((adjustedRecipes / totalRecipes) * 100).toFixed(1);
  
  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800">
        <strong>Atenção:</strong> {adjustedRecipes} de {totalRecipes} receitas ({percentage}%) 
        tiveram custos ajustados para valores mais realistas.
        {totalCostAdjustment !== 0 && (
          <> Ajuste total: {totalCostAdjustment > 0 ? '+' : ''}R$ {totalCostAdjustment.toFixed(2)}</>
        )}
        <br />
        <span className="text-sm">
          Isso pode indicar problemas na base de dados ou falhas na API de cálculo.
        </span>
      </AlertDescription>
    </Alert>
  );
}