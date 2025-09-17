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

const CATEGORY_ORDER = [
  'PP1', 'PP2', 'Arroz Branco',
  'Feijão', 'Guarnição', 'Salada 1', 
  'Salada 2', 'Suco 1', 'Suco 2', 'Sobremesa'
];

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

  // Group recipes by category for the current day and ensure all categories are present
  const recipesByCategory = React.useMemo(() => {
    const grouped: { [key: string]: Recipe } = {};
    
    // Initialize all categories
    CATEGORY_ORDER.forEach(category => {
      grouped[category] = {
        id: `empty-${category}`,
        name: 'Não definido',
        category,
        cost: 0,
        day: currentDay?.day || 'Segunda-feira'
      };
    });
    
    // Override with actual recipes
    currentDay?.recipes?.forEach((recipe) => {
      const category = recipe.category || 'Outros';
      if (CATEGORY_ORDER.includes(category)) {
        grouped[category] = recipe;
      }
    });
    
    return grouped;
  }, [currentDay]);

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-sm border p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="text-xl font-medium text-gray-600">
          Semana 1 - {menu.clientName}
        </h2>
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1">
          Semana 1
        </Badge>
      </div>

      {/* Day Title */}
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-gray-800">
          {currentDay?.day || 'Dia não encontrado'}
        </h3>
      </div>

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-3 gap-4">
        {CATEGORY_ORDER.map((category) => {
          const recipe = recipesByCategory[category];
          return (
            <Card key={category} className="bg-gray-50 border border-gray-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-medium text-orange-600 uppercase tracking-wide">
                  {category}
                </div>
                
                <div className="space-y-1">
                  <h4 className="font-medium text-sm text-gray-800 leading-tight min-h-[2.5rem] flex items-center">
                    {recipe.name}
                  </h4>
                  <p className="text-sm font-semibold text-gray-700">
                    R$ {recipe.cost.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center gap-2 pt-4">
        {menuDays.map((_, index) => (
          <button
            key={index}
            onClick={() => goToDay(index)}
            className={`w-3 h-3 rounded-full transition-colors ${
              index === currentDayIndex 
                ? 'bg-orange-500' 
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>

      {/* Navigation Arrows (hidden on mobile, shown on larger screens) */}
      <div className="hidden md:flex absolute inset-y-0 left-0 right-0 items-center justify-between pointer-events-none">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={prevDay}
          disabled={currentDayIndex === 0}
          className="pointer-events-auto ml-4"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={nextDay}
          disabled={currentDayIndex === menuDays.length - 1}
          className="pointer-events-auto mr-4"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}