import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Recipe {
  id: string | number;
  name: string;
  category: string;
  cost: number;
  day?: string;
}

interface MenuDay {
  day: string;
  recipes: Recipe[];
}

interface MenuDayCarouselProps {
  menu: {
    clientName: string;
    weekPeriod: string;
    cardapio?: MenuDay[];
    recipes?: Recipe[];
  };
}

const CATEGORY_COLORS = {
  'PP1': 'bg-orange-500',
  'PP2': 'bg-orange-500', 
  'Arroz Branco': 'bg-orange-500',
  'Feijão': 'bg-orange-500',
  'Guarnição': 'bg-orange-500',
  'Salada 1': 'bg-orange-500',
  'Salada 2': 'bg-orange-500',
  'Suco 1': 'bg-orange-500',
  'Suco 2': 'bg-orange-500',
  'Sobremesa': 'bg-orange-500',
  'default': 'bg-orange-500'
};

const WEEK_DAYS = [
  'Segunda-feira',
  'Terça-feira', 
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira'
];

export function MenuDayCarousel({ menu }: MenuDayCarouselProps) {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);

  // Convert flat recipes array to daily structure if needed
  const menuDays: MenuDay[] = React.useMemo(() => {
    if (menu.cardapio) {
      return menu.cardapio;
    }
    
    // Group recipes by day
    const groupedByDay: { [key: string]: Recipe[] } = {};
    
    if (menu.recipes) {
      menu.recipes.forEach((recipe) => {
        const day = recipe.day || 'Segunda-feira';
        if (!groupedByDay[day]) {
          groupedByDay[day] = [];
        }
        groupedByDay[day].push(recipe);
      });
    }

    // Create days structure
    return WEEK_DAYS.map(day => ({
      day,
      recipes: groupedByDay[day] || []
    }));
  }, [menu]);

  const currentDay = menuDays[currentDayIndex];

  const nextDay = () => {
    setCurrentDayIndex((prev) => (prev + 1) % menuDays.length);
  };

  const prevDay = () => {
    setCurrentDayIndex((prev) => (prev - 1 + menuDays.length) % menuDays.length);
  };

  const goToDay = (index: number) => {
    setCurrentDayIndex(index);
  };

  // Group recipes by category for the current day
  const recipesByCategory = React.useMemo(() => {
    const grouped: { [key: string]: Recipe[] } = {};
    
    currentDay?.recipes?.forEach((recipe) => {
      const category = recipe.category || 'Outros';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(recipe);
    });
    
    return grouped;
  }, [currentDay]);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground">
            {menu.weekPeriod} - {menu.clientName}
          </h2>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Semana 1
          </Badge>
        </div>
      </div>

      {/* Day Navigation */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={prevDay}
          disabled={currentDayIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h3 className="text-xl font-semibold text-foreground">
          {currentDay?.day || 'Dia não encontrado'}
        </h3>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={nextDay}
          disabled={currentDayIndex === menuDays.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(recipesByCategory).map(([category, recipes]) => (
          recipes.map((recipe, idx) => (
            <Card key={`${category}-${idx}`} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <Badge 
                  className={`${CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.default} text-white text-xs font-medium`}
                >
                  {category}
                </Badge>
                
                <div className="space-y-1">
                  <h4 className="font-medium text-sm leading-tight text-foreground line-clamp-2">
                    {recipe.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    R$ {recipe.cost.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        ))}
      </div>

      {/* Empty state */}
      {(!currentDay?.recipes || currentDay.recipes.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhuma receita encontrada para {currentDay?.day}</p>
        </div>
      )}

      {/* Day Indicators */}
      <div className="flex justify-center gap-2">
        {menuDays.map((_, index) => (
          <button
            key={index}
            onClick={() => goToDay(index)}
            className={`w-3 h-3 rounded-full transition-colors ${
              index === currentDayIndex 
                ? 'bg-primary' 
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}