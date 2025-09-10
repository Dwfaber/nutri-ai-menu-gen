import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeekNavigatorProps {
  currentWeek: number;
  totalWeeks: number;
  onWeekChange: (week: number) => void;
  className?: string;
}

export const WeekNavigator: React.FC<WeekNavigatorProps> = ({
  currentWeek,
  totalWeeks,
  onWeekChange,
  className
}) => {
  const goToPreviousWeek = () => {
    if (currentWeek > 1) {
      onWeekChange(currentWeek - 1);
    }
  };
  
  const goToNextWeek = () => {
    if (currentWeek < totalWeeks) {
      onWeekChange(currentWeek + 1);
    }
  };
  
  const canGoPrevious = currentWeek > 1;
  const canGoNext = currentWeek < totalWeeks;
  
  // Se só há uma semana, não mostra navegação
  if (totalWeeks <= 1) {
    return null;
  }
  
  return (
    <div className={cn("flex items-center justify-center gap-4 mb-6", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={goToPreviousWeek}
        disabled={!canGoPrevious}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Semana Anterior
      </Button>
      
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Semana {currentWeek} de {totalWeeks}
        </span>
        
        <div className="flex gap-1">
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((week) => (
            <Button
              key={week}
              variant={week === currentWeek ? "default" : "outline"}
              size="sm"
              onClick={() => onWeekChange(week)}
              className={cn(
                "h-8 w-8 p-0 text-xs",
                week === currentWeek && "bg-primary text-primary-foreground"
              )}
            >
              {week}
            </Button>
          ))}
        </div>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={goToNextWeek}
        disabled={!canGoNext}
        className="flex items-center gap-2"
      >
        Próxima Semana
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};