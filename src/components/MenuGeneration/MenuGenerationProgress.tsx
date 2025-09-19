import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChefHat, Calculator, Utensils, CheckCircle } from 'lucide-react';

interface MenuGenerationProgressProps {
  stage: 'fetching' | 'calculating' | 'processing' | 'finalizing' | 'complete';
  message?: string;
  progress?: number;
}

const stageConfig = {
  fetching: {
    icon: ChefHat,
    title: 'Buscando Receitas',
    description: 'Encontrando receitas disponíveis no mercado...',
    color: 'bg-blue-500',
    progress: 25
  },
  calculating: {
    icon: Calculator,
    title: 'Calculando Custos',
    description: 'Analisando preços e custos das receitas...',
    color: 'bg-yellow-500',
    progress: 50
  },
  processing: {
    icon: Utensils,
    title: 'Montando Cardápio',
    description: 'Aplicando regras de negócio e variedade...',
    color: 'bg-purple-500',
    progress: 75
  },
  finalizing: {
    icon: Loader2,
    title: 'Finalizando',
    description: 'Últimos ajustes e validações...',
    color: 'bg-green-500',
    progress: 90
  },
  complete: {
    icon: CheckCircle,
    title: 'Concluído',
    description: 'Cardápio gerado com sucesso!',
    color: 'bg-green-600',
    progress: 100
  }
};

export const MenuGenerationProgress: React.FC<MenuGenerationProgressProps> = ({
  stage,
  message,
  progress
}) => {
  const config = stageConfig[stage];
  const IconComponent = config.icon;
  const currentProgress = progress ?? config.progress;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          {stage === 'finalizing' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <IconComponent className="w-5 h-5" />
          )}
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="px-3 py-1">
              {config.description}
            </Badge>
            <span className="text-sm text-muted-foreground font-medium">
              {currentProgress}%
            </span>
          </div>
          
          <Progress value={currentProgress} className="w-full h-2" />
          
          {message && (
            <p className="text-sm text-center text-muted-foreground mt-2">
              {message}
            </p>
          )}
        </div>
        
        <div className="flex justify-center">
          <div 
            className={`w-3 h-3 rounded-full ${config.color} ${
              stage !== 'complete' ? 'animate-pulse' : ''
            }`}
          />
        </div>

        {stage !== 'complete' && (
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              ⏰ <strong>Tempo estimado:</strong> Até 1 minuto
            </p>
            <p className="text-xs text-blue-600 mt-1">
              O processamento pode demorar devido ao cálculo detalhado de custos
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};