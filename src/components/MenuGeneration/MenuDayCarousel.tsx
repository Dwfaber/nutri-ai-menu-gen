import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Recipe {
  id: string | number;
  name?: string;
  nome?: string; // Portuguese version
  category?: string;
  categoria?: string; // Portuguese version
  codigo?: string; // Category code
  cost?: number;
  custo?: number; // Portuguese version
  custo_por_refeicao?: number; // Portuguese version
  day?: string;
}

interface MenuDay {
  day?: string;
  dia?: string; // Portuguese version
  recipes?: Recipe[];
  receitas?: Recipe[]; // Portuguese version
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
  'Base', 'Prato Principal 1', 'Prato Principal 2', 
  'Guarnição', 'Salada 1', 'Salada 2', 
  'SUCO1', 'SUCO2', 'Sobremesa'
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

    // Use only days that actually have recipes; fallback to default weekdays when empty
    const daysWithRecipes = Object.keys(groupedByDay);
    if (daysWithRecipes.length > 0) {
      const ordered = WEEK_DAYS;
      return daysWithRecipes
        .sort((a, b) => ordered.indexOf(a) - ordered.indexOf(b))
        .map(day => ({ day, recipes: groupedByDay[day] }));
    }

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

  // Helper functions for strong normalization and deduplication
  const stripAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const simple = (str: string) => stripAccents(str).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizeString = (str: string) => str.toUpperCase().trim();

  // Slot-based detectors for base items
  const detectSlot = (name: string) => {
    const simplified = simple(name);
    
    if (simplified.includes('ARROZ')) return 'rice';
    if (simplified.includes('FEIJAO')) return 'bean';
    if (simplified.includes('CAFE')) return 'coffee';
    if (simplified.includes('KITDESCARTAVEL') || simplified.includes('KITDESCARTAVEIS')) return 'disposable_kit';
    if (simplified.includes('KITLIMPEZA')) return 'cleaning_kit';
    if (simplified.includes('KITTEMPERO') || simplified.includes('TEMPEROMESA')) return 'seasoning_kit';
    if (simplified.includes('PAOFRANCES') || simplified.includes('MINIFILAO') || simplified.includes('MINIPAO')) return 'bread';
    
    return null;
  };

  // Group recipes by category for the current day and ensure all categories are present
  const recipesByCategory = React.useMemo(() => {
    const grouped: { [key: string]: Recipe[] } = {};
    
    // Initialize all categories
    CATEGORY_ORDER.forEach(category => {
      grouped[category] = [];
    });
    
    // Bean variations mapping (exactly as they appear in the database)
    const BEAN_VARIATIONS = {
      'FEIJÃO (SÓ CARIOCA)': ['feijão (só carioca)', 'feijao so carioca'],
      'FEIJÃO MIX (CARIOCA + BANDINHA)': ['feijão mix (carioca + bandinha)', 'feijao mix carioca bandinha'],
      'FEIJÃO MIX (CARIOCA + BANDINHA) 50%': ['feijão mix (carioca + bandinha) 50%', 'feijao mix 50%'],
      'FEIJÃO MIX COM CALABRESA (CARIOCA + BANDINHA)': ['feijão mix com calabresa', 'feijao mix calabresa'],
      'FEIJÃO MIX COM CALABRESA (CARIOCA + BANDINHA) 50%': ['feijão mix com calabresa 50%', 'feijao mix calabresa 50%']
    };
    
    // Helper function to determine if a recipe should be categorized as Base
    const isBaseProduct = (name: string, code?: string, category?: string) => {
      const normalizedName = name.toLowerCase();
      
      // Check by category first
      if (category?.toLowerCase() === 'base') return true;
      
      // Check by code
      if (code && ['ARROZ', 'FEIJAO', 'CAFE', 'KIT'].some(baseCode => code.includes(baseCode))) return true;
      
      // Check by name patterns for all base products from the legacy system
      return (
        normalizedName.includes('arroz') ||
        normalizedName.includes('feijão') ||
        normalizedName.includes('feijao') ||
        normalizedName.includes('café cortesia') ||
        normalizedName.includes('cafe cortesia') ||
        normalizedName.includes('kit descartáveis') ||
        normalizedName.includes('kit descartaveis') ||
        normalizedName.includes('kit limpeza') ||
        normalizedName.includes('kit tempero') ||
        normalizedName.includes('tempero de mesa') ||
        normalizedName.includes('mini filão') ||
        normalizedName.includes('mini filao') ||
        normalizedName.includes('acompanhamento')
      );
    };
    
    // Helper function to detect bean variant
    const detectBeanVariant = (name: string) => {
      const normalizedName = name.toLowerCase();
      for (const [variant, patterns] of Object.entries(BEAN_VARIATIONS)) {
        if (patterns.some(pattern => normalizedName.includes(pattern))) {
          return variant;
        }
      }
      return null;
    };
    
    // Detect bean variant for current day only
    const currentDayRecipes = currentDay?.receitas || currentDay?.recipes || [];
    let currentDayBeanVariant = 'FEIJÃO (SÓ CARIOCA)'; // Default
    
    // Check if current day already has a bean variant
    for (const recipe of currentDayRecipes) {
      const name = recipe.name || recipe.nome || '';
      const variant = detectBeanVariant(name);
      if (variant) {
        currentDayBeanVariant = variant;
        break; // Use the first bean found for this day
      }
    }
    
    // Group actual recipes by category
    currentDay?.receitas?.forEach((receita) => {
      const code = receita.codigo || (receita as any).codigo;
      const rawCat = receita.category || receita.categoria || 'Outros';
      const name = receita.name || receita.nome || '';
      
      let displayCat = rawCat;
      
      // Check if it's a base product first
      if (isBaseProduct(name, code, rawCat)) {
        displayCat = 'Base';
      } else if (code === 'SUCO1') {
        displayCat = 'SUCO1';
      } else if (code === 'SUCO2') {
        displayCat = 'SUCO2';
      } else if (rawCat && ['SUCO', 'Suco', 'SUCO 1'].includes(rawCat)) {
        displayCat = 'SUCO1';
      } else if (rawCat && ['SUCO 2'].includes(rawCat)) {
        displayCat = 'SUCO2';
      } else if (code) {
        // Map other category codes
        displayCat = 
          code === 'PP1' ? 'Prato Principal 1' :
          code === 'PP2' ? 'Prato Principal 2' :
          code === 'SALADA1' ? 'Salada 1' :
          code === 'SALADA2' ? 'Salada 2' :
          code === 'GUARNICAO' ? 'Guarnição' :
          code === 'SOBREMESA' ? 'Sobremesa' : rawCat;
      } else {
        // Map category names
        displayCat = 
          rawCat === 'PP1' ? 'Prato Principal 1' : 
          rawCat === 'PP2' ? 'Prato Principal 2' : rawCat;
      }

      if (!grouped[displayCat]) {
        grouped[displayCat] = [];
      }
      grouped[displayCat].push(receita);
    }) || 
    // Fallback for recipes property
    currentDay?.recipes?.forEach((recipe) => {
      const code = (recipe as any).codigo as string | undefined;
      const rawCat = recipe.category || recipe.categoria || 'Outros';
      const name = recipe.name || recipe.nome || '';
      
      let displayCat = rawCat;
      
      // Check if it's a base product first
      if (isBaseProduct(name, code, rawCat)) {
        displayCat = 'Base';
      } else if (code === 'SUCO1') {
        displayCat = 'SUCO1';
      } else if (code === 'SUCO2') {
        displayCat = 'SUCO2';
      } else if (rawCat && ['SUCO', 'Suco', 'SUCO 1'].includes(rawCat)) {
        displayCat = 'SUCO1';
      } else if (rawCat && ['SUCO 2'].includes(rawCat)) {
        displayCat = 'SUCO2';
      } else if (code) {
        // Map other category codes
        displayCat = 
          code === 'PP1' ? 'Prato Principal 1' :
          code === 'PP2' ? 'Prato Principal 2' :
          code === 'SALADA1' ? 'Salada 1' :
          code === 'SALADA2' ? 'Salada 2' :
          code === 'GUARNICAO' ? 'Guarnição' :
          code === 'SOBREMESA' ? 'Sobremesa' : rawCat;
      } else {
        // Map category names
        displayCat = 
          rawCat === 'PP1' ? 'Prato Principal 1' : 
          rawCat === 'PP2' ? 'Prato Principal 2' : rawCat;
      }

      if (!grouped[displayCat]) {
        grouped[displayCat] = [];
      }
      grouped[displayCat].push(recipe);
    });
    
    // Bean cost mapping based on variation
    const beanCostMap: { [key: string]: number } = {
      'FEIJÃO CARIOCA': 0.12,     // 0.24 ÷ 2
      'FEIJÃO PRETO': 0.15,       // 0.30 ÷ 2  
      'FEIJÃO BRANCO': 0.06,      // 0.12 ÷ 2
      'FEIJÃO FRADINHO': 0.06     // 0.12 ÷ 2
    };
    
    // Get bean cost based on current variation, default to 0.12 if not found
    const currentBeanCost = beanCostMap[currentDayBeanVariant] || 0.12;
    
    // Always complete Base category with required items using slot-based deduplication
    const baseRequired = [
      { name: 'ARROZ BRANCO', cost: 0.32, slot: 'rice' },         // 0.64 ÷ 2
      { name: currentDayBeanVariant, cost: currentBeanCost, slot: 'bean' },
      { name: 'CAFÉ COMPLEMENTAR', cost: 0.34, slot: 'coffee' },   // 0.67 ÷ 2
      { name: 'KIT DESCARTÁVEL', cost: 0.08, slot: 'disposable_kit' }, // 0.16 ÷ 2
      { name: 'KIT LIMPEZA', cost: 0.03, slot: 'cleaning_kit' },   // 0.05 ÷ 2
      { name: 'KIT TEMPEROS MESA', cost: 0.05, slot: 'seasoning_kit' }, // 0.09 ÷ 2
      { name: 'PÃO FRANCÊS MINI', cost: 0.03, slot: 'bread' }      // 0.06 ÷ 2
    ];

    // Get existing base items and deduplicate by slot
    const existingBaseItems = grouped['Base'] || [];
    const slotOccupied = new Set<string>();
    const deduplicatedBaseItems: Recipe[] = [];

    // First pass: keep only the first item of each slot
    existingBaseItems.forEach(item => {
      const name = item.name || item.nome || '';
      const slot = detectSlot(name);
      
      if (slot && !slotOccupied.has(slot)) {
        slotOccupied.add(slot);
        deduplicatedBaseItems.push(item);
      } else if (!slot) {
        // Keep items that don't match any slot
        deduplicatedBaseItems.push(item);
      }
    });

    // Second pass: inject missing base items
    baseRequired.forEach((requiredItem, index) => {
      if (!slotOccupied.has(requiredItem.slot)) {
        deduplicatedBaseItems.push({
          id: `base-injected-${index}`,
          name: requiredItem.name,
          category: 'Base',
          cost: requiredItem.cost
        });
        slotOccupied.add(requiredItem.slot);
      }
    });

    grouped['Base'] = deduplicatedBaseItems;

    // Always inject juices if missing (2 juices per day)
    const existingJuices = grouped['Sucos'] || [];
    const juiceNames = existingJuices.map(j => normalizeString(j.name || j.nome || ''));
    
    // Juice pools by preference (Pro Mix preferred)
    const juicePools = {
      proMix: ['SUCO PRO MIX LARANJA', 'SUCO PRO MIX UVA', 'SUCO PRO MIX MARACUJÁ', 'SUCO PRO MIX MANGA'],
      vita: ['SUCO VITA LARANJA', 'SUCO VITA UVA', 'SUCO VITA ABACAXI', 'SUCO VITA PÊSSEGO'],
      diet: ['SUCO DIET LARANJA', 'SUCO DIET UVA', 'SUCO DIET LIMÃO'],
      natural: ['SUCO NATURAL LARANJA', 'SUCO NATURAL LIMÃO', 'SUCO NATURAL MARACUJÁ']
    };

    // Select two distinct juices (prefer Pro Mix)
    const availableJuices = [...juicePools.proMix, ...juicePools.vita];
    
    if (existingJuices.length < 2) {
      const neededJuices = 2 - existingJuices.length;
      for (let i = 0; i < neededJuices && i < availableJuices.length; i++) {
        const juiceName = availableJuices[i];
        if (!juiceNames.includes(normalizeString(juiceName))) {
          existingJuices.push({
            id: `juice-injected-${i}`,
            name: juiceName,
            category: i === 0 ? 'SUCO1' : 'SUCO2',
            cost: 0.05
          });
        }
      }
    }

    grouped['Sucos'] = existingJuices;
    
    return grouped;
  }, [currentDay]);

  // Calculate costs separately for Base (fixed) and Variable Menu
  const { baseCost, variableCost, totalCost } = React.useMemo(() => {
    // Include injected base items in cost calculation
    const baseItems = recipesByCategory['Base'] || [];
    const base = baseItems.reduce((sum, recipe) => sum + (recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0), 0);
    
    const allVariableRecipes = CATEGORY_ORDER
      .filter(cat => cat !== 'Base')
      .flatMap(cat => recipesByCategory[cat] || []);
    
    const variable = allVariableRecipes.reduce((sum, recipe) => sum + (recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0), 0);
    
    return {
      baseCost: base,
      variableCost: variable,
      totalCost: base + variable
    };
  }, [recipesByCategory]);

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
          {currentDay?.day || currentDay?.dia || 'Dia não encontrado'}
        </h3>
      </div>

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-3 gap-4">
        {CATEGORY_ORDER.map((category) => {
          const recipes = recipesByCategory[category] || [];
          const categoryTotal = recipes.reduce((sum, recipe) => sum + (recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0), 0);
          const isBaseCategory = category === 'Base';
          
          return (
            <Card key={category} className={`${isBaseCategory ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'} hover:shadow-md transition-shadow`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-orange-600 uppercase tracking-wide">
                    {category}
                  </div>
                  {isBaseCategory && (
                    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                      Obrigatório
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-1">
                  {recipes.length > 0 ? (
                    recipes.map((recipe) => (
                      <div key={recipe.id} className="space-y-1">
                        <h4 className="font-medium text-base text-gray-800 leading-tight">
                          {recipe.name || recipe.nome || 'Nome não definido'}
                        </h4>
                        <p className="text-base font-semibold text-green-600">
                          R$ {(recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0).toFixed(2)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-1">
                      <h4 className="font-medium text-base text-gray-500 leading-tight">
                        Não definido
                      </h4>
                      <p className="text-base font-semibold text-gray-400">
                        R$ 0,00
                      </p>
                    </div>
                  )}
                  
                  {recipes.length > 1 && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs font-semibold text-blue-600">
                        Total: R$ {categoryTotal.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Budget Summary */}
      {currentDay && (
        <div className="bg-white rounded-lg p-4 border border-gray-200 mt-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-amber-700 font-medium">Base (obrigatório):</span>
              <span className="text-amber-700 font-semibold">R$ {baseCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Menu variável:</span>
              <span className="text-gray-600">R$ {variableCost.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="text-sm text-gray-600">Custo total da refeição:</span>
              <span className="font-semibold text-lg text-green-600">
                R$ {totalCost.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Orçamento por refeição:</span>
              <span className="text-sm text-gray-500">R$ 6,50</span>
            </div>
          </div>
        </div>
      )}

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