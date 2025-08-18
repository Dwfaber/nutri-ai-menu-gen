/**
 * Progress indicator for menu calculations
 */

import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type MenuCalculationProgress } from '@/hooks/useMenuCalculation';

interface MenuCalculationProgressProps {
  progress: MenuCalculationProgress;
}

const stageMessages = {
  fetching_products: 'Carregando produtos do mercado',
  calculating_costs: 'Calculando custos das receitas',
  processing_recipes: 'Processando receitas',
  finalizing: 'Finalizando cálculos'
};

const stageColors = {
  fetching_products: 'bg-blue-500',
  calculating_costs: 'bg-yellow-500',
  processing_recipes: 'bg-purple-500',
  finalizing: 'bg-green-500'
} as const;

export function MenuCalculationProgress({ progress }: MenuCalculationProgressProps) {
  const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  
  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="px-3 py-1">
              {stageMessages[progress.stage]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {progress.current}/{progress.total}
            </span>
          </div>
          
          <div className="space-y-2">
            <Progress value={percentage} className="w-full" />
            <p className="text-sm text-center text-muted-foreground">
              {progress.message}
            </p>
          </div>
          
          <div className="flex justify-center">
            <div 
              className={`w-3 h-3 rounded-full ${stageColors[progress.stage]} animate-pulse`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}