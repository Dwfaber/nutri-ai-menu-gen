import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Download, Copy, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Ingredient {
  name: string;
  quantity?: number;
  unit?: string;
}

interface MenuRecipe {
  id: string;
  name: string;
  category: string;
  day: string;
  cost: number;
  servings: number;
  ingredients?: Ingredient[];
  placeholder?: boolean;
  observacao?: string;
}

interface WeekData {
  weekPeriod: string;
  recipes: MenuRecipe[];
  totalCost: number;
  startDate: Date;
  endDate: Date;
}

interface WeeklyMenuViewProps {
  title: string;
  recipes: MenuRecipe[];
  gramWeight?: string;
  onEdit?: (recipeId: string) => void;
  onExport?: () => void;
  onCopy?: () => void;
}

const NEW_MENU_CATEGORIES = [
  'PP1',
  'PP2', 
  'Arroz Branco',
  'Feijão',
  'Salada 1',
  'Salada 2',
  'Suco 1',
  'Suco 2'
];

const CATEGORY_DISPLAY_NAMES = {
  'PP1': 'PRATO PRINCIPAL 1',
  'PP2': 'PRATO PRINCIPAL 2',
  'Arroz Branco': 'ARROZ BRANCO',
  'Feijão': 'FEIJÃO',
  'Salada 1': 'SALADA 1 (VERDURAS)',
  'Salada 2': 'SALADA 2 (LEGUMES)',
  'Suco 1': 'SUCO 1',
  'Suco 2': 'SUCO 2',
};

const CATEGORY_COLORS = {
  'PP1': 'bg-blue-100 text-blue-800 border-blue-200',
  'PP2': 'bg-purple-100 text-purple-800 border-purple-200',
  'Arroz Branco': 'bg-amber-100 text-amber-800 border-amber-200',
  'Feijão': 'bg-green-100 text-green-800 border-green-200',
  'Salada 1': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Salada 2': 'bg-teal-100 text-teal-800 border-teal-200',
  'Suco 1': 'bg-orange-100 text-orange-800 border-orange-200',
  'Suco 2': 'bg-red-100 text-red-800 border-red-200',
};

const WeeklyMenuView: React.FC<WeeklyMenuViewProps> = ({
  title,
  recipes,
  gramWeight = "PADRÃO (90 GRAMAS/PORÇÃO)",
  onEdit,
  onExport,
  onCopy
}) => {
  const weekGroups = useMemo(() => {
    if (!recipes || recipes.length === 0) return [];

    // Agrupa receitas por semana
    const recipesByWeek = new Map<string, MenuRecipe[]>();
    
    recipes.forEach(recipe => {
      if (!recipe.day) return;
      
      try {
        // Tenta encontrar uma data no campo day
        const dateMatch = recipe.day.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        let recipeDate: Date;
        
        if (dateMatch) {
          // Se tem data, usa ela
          const [day, month, year] = dateMatch[1].split('/');
          recipeDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          // Se não tem data, usa a data atual
          recipeDate = new Date();
        }
        
        if (!isValid(recipeDate)) {
          recipeDate = new Date();
        }
        
        const weekStart = startOfWeek(recipeDate, { weekStartsOn: 1 }); // Segunda-feira
        const weekEnd = endOfWeek(recipeDate, { weekStartsOn: 1 }); // Domingo
        
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        if (!recipesByWeek.has(weekKey)) {
          recipesByWeek.set(weekKey, []);
        }
        
        recipesByWeek.get(weekKey)!.push(recipe);
      } catch (error) {
        console.warn('Erro ao processar data da receita:', recipe.day, error);
        // Fallback para semana atual
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        if (!recipesByWeek.has(weekKey)) {
          recipesByWeek.set(weekKey, []);
        }
        
        recipesByWeek.get(weekKey)!.push(recipe);
      }
    });

    // Converte para array e ordena por data
    const weekData: WeekData[] = Array.from(recipesByWeek.entries()).map(([weekKey, weekRecipes]) => {
      const startDate = parseISO(weekKey);
      const endDate = endOfWeek(startDate, { weekStartsOn: 1 });
      const totalCost = weekRecipes.reduce((sum, recipe) => sum + (recipe.cost || 0), 0);
      
      return {
        weekPeriod: `${format(startDate, 'dd/MM', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`,
        recipes: weekRecipes,
        totalCost,
        startDate,
        endDate
      };
    }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    return weekData;
  }, [recipes]);

  const getDaysFromWeek = (weekRecipes: MenuRecipe[]) => {
    const dayMap = new Map<string, MenuRecipe[]>();
    
    weekRecipes.forEach(recipe => {
      const day = recipe.day || 'Sem data';
      if (!dayMap.has(day)) {
        dayMap.set(day, []);
      }
      dayMap.get(day)!.push(recipe);
    });
    
    // Ordena os dias
    const sortedDays = Array.from(dayMap.keys()).sort();
    return sortedDays.map(day => ({
      dayName: day,
      recipes: dayMap.get(day)!
    }));
  };

  const getDayCost = (dayRecipes: MenuRecipe[]) => {
    return dayRecipes.reduce((sum, recipe) => sum + (recipe.cost || 0), 0);
  };

  const totalCost = recipes.reduce((sum, recipe) => sum + (recipe.cost || 0), 0);
  const totalRecipes = recipes.length;
  const totalServings = recipes.reduce((sum, recipe) => sum + (recipe.servings || 0), 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold">CARDÁPIO</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">GRAMAGEM: {gramWeight}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 font-medium">
              Total: R$ {totalCost.toFixed(2)}
            </Badge>
            <div className="flex gap-1">
              {onEdit && (
                <Button size="sm" variant="outline" onClick={() => onEdit('')}>
                  <Edit className="w-3 h-3" />
                </Button>
              )}
              {onExport && (
                <Button size="sm" variant="outline" onClick={onExport}>
                  <Download className="w-3 h-3" />
                </Button>
              )}
              {onCopy && (
                <Button size="sm" variant="outline" onClick={onCopy}>
                  <Copy className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {weekGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma receita encontrada</p>
          </div>
        ) : (
          weekGroups.map((week, weekIndex) => {
            const days = getDaysFromWeek(week.recipes);
            
            return (
              <Collapsible key={week.weekPeriod} defaultOpen={weekIndex === 0}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between p-4 h-auto hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <p className="font-semibold">Semana de {week.weekPeriod}</p>
                        <p className="text-sm text-muted-foreground">
                          {week.recipes.length} receitas • R$ {week.totalCost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-4 mt-4">
                  {days.map((day) => {
                    const dayCost = getDayCost(day.recipes);
                    
                    return (
                      <div key={day.dayName} className="border rounded-lg p-4 bg-background">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-lg">{day.dayName.toUpperCase()}</h4>
                          <Badge variant="secondary" className="font-medium">
                            R$ {dayCost.toFixed(2)}
                          </Badge>
                        </div>
                        
                         <div className="space-y-3">
                           {NEW_MENU_CATEGORIES.map((category) => {
                             const categoryRecipes = day.recipes.filter(recipe => recipe.category === category);
                             
                             // SEMPRE MOSTRAR ARROZ E FEIJÃO, mesmo sem receitas
                             if (categoryRecipes.length === 0 && !['ARROZ BRANCO', 'FEIJÃO'].includes(category)) return null;
                            
                             return (
                               <div key={category} className="space-y-2">
                                 {/* Se há receitas, mostrar normalmente */}
                                 {categoryRecipes.length > 0 ? (
                                   categoryRecipes.map((recipe, index) => (
                                     <div key={`${recipe.id}-${index}`} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                       <div className="flex items-center gap-3 flex-1">
                                         <Badge 
                                           variant="outline" 
                                           className={cn(
                                             "shrink-0 font-medium", 
                                             recipe.placeholder ? 'bg-amber-100 text-amber-800 border-amber-300' : 
                                             CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-800'
                                           )}
                                         >
                                           {CATEGORY_DISPLAY_NAMES[category] || category}
                                         </Badge>
                                         
                                         <div className="flex-1">
                                           <p className="font-medium leading-tight">
                                             {recipe.name}
                                             {recipe.placeholder && <span className="ml-2 text-xs text-amber-600">(Placeholder)</span>}
                                           </p>
                                           <p className="text-sm text-muted-foreground">
                                             {recipe.servings} porções
                                           </p>
                                           
                                           {recipe.observacao && (
                                             <p className="text-xs text-amber-600 mt-1">
                                               ⚠️ {recipe.observacao}
                                             </p>
                                           )}
                                           
                                           {recipe.ingredients && recipe.ingredients.length > 0 && (
                                             <div className="mt-1">
                                               <p className="text-xs text-muted-foreground">
                                                 {recipe.ingredients.slice(0, 2).map(ing => ing.name).join(', ')}
                                                 {recipe.ingredients.length > 2 && ` +${recipe.ingredients.length - 2}`}
                                               </p>
                                             </div>
                                           )}
                                         </div>
                                       </div>
                                       
                                       <div className="text-right">
                                         <p className={cn(
                                           "font-bold text-lg",
                                           recipe.cost > 0 ? "text-green-600" : "text-amber-600"
                                         )}>
                                           R$ {recipe.cost.toFixed(2)}
                                         </p>
                                       </div>
                                     </div>
                                   ))
                                 ) : (
                                   /* Placeholder para ARROZ E FEIJÃO quando não há receitas */
                                   ['ARROZ BRANCO', 'FEIJÃO'].includes(category) && (
                                     <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 border-amber-200">
                                       <div className="flex items-center gap-3 flex-1">
                                         <Badge 
                                           variant="outline" 
                                           className="shrink-0 font-medium bg-amber-100 text-amber-800 border-amber-300"
                                         >
                                           {CATEGORY_DISPLAY_NAMES[category] || category}
                                         </Badge>
                                         
                                         <div className="flex-1">
                                           <p className="font-medium leading-tight text-amber-800">
                                             {category === 'ARROZ BRANCO' ? 'ARROZ BRANCO' : 'FEIJÃO MIX - CARIOCA + BANDINHA 50%'}
                                             <span className="ml-2 text-xs">(Receita não encontrada)</span>
                                           </p>
                                           <p className="text-sm text-amber-600">
                                             ⚠️ Aguardando configuração de receita
                                           </p>
                                         </div>
                                       </div>
                                       
                                       <div className="text-right">
                                         <p className="font-bold text-lg text-amber-600">
                                           R$ 0,00
                                         </p>
                                       </div>
                                     </div>
                                   )
                                 )}
                               </div>
                             );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
        
        {/* Summary */}
        <div className="mt-6 p-4 bg-primary/5 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-primary">Total de Receitas:</span>
              <span className="ml-2 font-bold">{totalRecipes}</span>
            </div>
            <div>
              <span className="font-medium text-primary">Custo por Porção:</span>
              <span className="ml-2 font-bold">R$ {(totalCost / (totalServings || 1)).toFixed(2)}</span>
            </div>
            <div>
              <span className="font-medium text-primary">Porções Totais:</span>
              <span className="ml-2 font-bold">{totalServings}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyMenuView;