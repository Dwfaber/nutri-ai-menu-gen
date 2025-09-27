import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Calendar, Clock, Users } from 'lucide-react';

export type PeriodType = 'week' | 'fortnight' | 'month' | 'custom';

export interface PeriodOption {
  id: string;
  type: PeriodType;
  label: string;
  description: string;
  businessDays: number;
  totalDays: number;
  includeWeekends: boolean;
}

export interface SelectedPeriod {
  option: PeriodOption;
  mealsPerDay: number;
  totalMeals: number;
  totalDays: number;
}

interface PeriodSelectorProps {
  value: SelectedPeriod | null;
  onChange: (period: SelectedPeriod) => void;
  mealsPerDay: number;
  onMealsPerDayChange: (meals: number) => void;
  className?: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  {
    id: 'week-business',
    type: 'week',
    label: '1 Semana (Dias Úteis)',
    description: 'Segunda a Sexta - 5 dias',
    businessDays: 5,
    totalDays: 5,
    includeWeekends: false
  },
  {
    id: 'week-full',
    type: 'week',
    label: '1 Semana Completa',
    description: 'Segunda a Domingo - 7 dias',
    businessDays: 5,
    totalDays: 7,
    includeWeekends: true
  },
  {
    id: 'fortnight-business',
    type: 'fortnight',
    label: '2 Semanas (Dias Úteis)',
    description: 'Segunda a Sexta - 10 dias',
    businessDays: 10,
    totalDays: 10,
    includeWeekends: false
  },
  {
    id: 'fortnight-full',
    type: 'fortnight',
    label: '2 Semanas Completas',
    description: 'Segunda a Domingo - 14 dias',
    businessDays: 10,
    totalDays: 14,
    includeWeekends: true
  },
  {
    id: 'month-business',
    type: 'month',
    label: '1 Mês (Dias Úteis)',
    description: 'Segunda a Sexta - 20 dias',
    businessDays: 20,
    totalDays: 20,
    includeWeekends: false
  },
  {
    id: 'month-full',
    type: 'month',
    label: '1 Mês Completo',
    description: 'Segunda a Domingo - 30 dias',
    businessDays: 20,
    totalDays: 30,
    includeWeekends: true
  }
];

export function PeriodSelector({
  value,
  onChange,
  mealsPerDay,
  onMealsPerDayChange,
  className
}: PeriodSelectorProps) {
  const handlePeriodChange = (optionId: string) => {
    const option = PERIOD_OPTIONS.find(opt => opt.id === optionId);
    if (option) {
      const selectedPeriod: SelectedPeriod = {
        option,
        mealsPerDay,
        totalMeals: option.totalDays * mealsPerDay,
        totalDays: option.totalDays
      };
      onChange(selectedPeriod);
    }
  };

  const handleMealsChange = (meals: number) => {
    onMealsPerDayChange(meals);
    if (value?.option) {
      const updatedPeriod: SelectedPeriod = {
        ...value,
        mealsPerDay: meals,
        totalMeals: value.option.totalDays * meals
      };
      onChange(updatedPeriod);
    }
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" />
            Período do Cardápio
          </Label>
          <Select 
            value={value?.option.id || ''} 
            onValueChange={handlePeriodChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o período para o cardápio" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {option.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="mealsPerDay" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Refeições por Dia
            </Label>
            <Select 
              value={mealsPerDay.toString()} 
              onValueChange={(value) => handleMealsChange(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 refeições/dia</SelectItem>
                <SelectItem value="50">50 refeições/dia</SelectItem>
                <SelectItem value="75">75 refeições/dia</SelectItem>
                <SelectItem value="100">100 refeições/dia</SelectItem>
                <SelectItem value="150">150 refeições/dia</SelectItem>
                <SelectItem value="200">200 refeições/dia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {value && (
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Total de Refeições
              </Label>
              <div className="mt-2 p-3 bg-muted rounded-md">
                <div className="text-2xl font-bold text-primary">
                  {value.totalMeals.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  {value.totalDays} dia{value.totalDays !== 1 ? 's' : ''}
                  {value.option.includeWeekends ? ' (com fins de semana)' : ' (dias úteis)'}
                </div>
              </div>
            </div>
          )}
        </div>

        {value && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <div className="font-medium">{value.option.label}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Dias úteis:</span>
                <div className="font-medium">{value.option.businessDays}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Total de dias:</span>
                <div className="font-medium">{value.option.totalDays}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Fins de semana:</span>
                <div className="font-medium">
                  {value.option.includeWeekends ? 'Incluídos' : 'Excluídos'}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export { PERIOD_OPTIONS };