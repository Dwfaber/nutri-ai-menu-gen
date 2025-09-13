import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayNavigatorProps {
  currentDay: string;
  availableDays: string[];
  onDayChange: (day: string) => void;
  className?: string;
}

const DAYS_ORDER = [
  'Segunda-feira',
  'Terça-feira', 
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo'
];

const DAY_LABELS: Record<string, string> = {
  'Segunda-feira': 'SEG',
  'Terça-feira': 'TER',
  'Quarta-feira': 'QUA', 
  'Quinta-feira': 'QUI',
  'Sexta-feira': 'SEX',
  'Sábado': 'SÁB',
  'Domingo': 'DOM'
};

export const DayNavigator: React.FC<DayNavigatorProps> = ({
  currentDay,
  availableDays,
  onDayChange,
  className
}) => {
  const sortedDays = DAYS_ORDER.filter(day => availableDays.includes(day));
  const currentIndex = sortedDays.indexOf(currentDay);
  
  const goToPreviousDay = () => {
    if (currentIndex > 0) {
      onDayChange(sortedDays[currentIndex - 1]);
    }
  };
  
  const goToNextDay = () => {
    if (currentIndex < sortedDays.length - 1) {
      onDayChange(sortedDays[currentIndex + 1]);
    }
  };
  
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < sortedDays.length - 1;
  
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={goToPreviousDay}
        disabled={!canGoPrevious}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex gap-1">
        {sortedDays.map((day) => (
          <Button
            key={day}
            variant={day === currentDay ? "default" : "outline"}
            size="sm"
            onClick={() => onDayChange(day)}
            className={cn(
              "h-8 px-3 text-xs font-medium",
              day === currentDay && "bg-primary text-primary-foreground"
            )}
          >
            {(DAY_LABELS as Record<string, string>)[day] || day.slice(0, 3).toUpperCase()}
          </Button>
        ))}
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={goToNextDay}
        disabled={!canGoNext}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};