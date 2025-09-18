import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRealTimeCosts } from '@/hooks/useRealTimeCosts';
import { useJuiceConfiguration } from '@/hooks/useJuiceConfiguration';
import { useSelectedClient } from '@/contexts/SelectedClientContext';

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
  produto_base_id?: number; // Base product ID for cost calculation
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
  const { calculateRecipeCost, getCachedCost } = useRealTimeCosts();
  const { availableJuices } = useJuiceConfiguration();
  const { selectedClient } = useSelectedClient();

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
      { name: 'ARROZ BRANCO', slot: 'rice' },
      { name: currentDayBeanVariant, slot: 'bean' },
      { name: 'CAFÉ COMPLEMENTAR', slot: 'coffee' },
      { name: 'KIT DESCARTÁVEL', slot: 'disposable_kit' },
      { name: 'KIT LIMPEZA', slot: 'cleaning_kit' },
      { name: 'KIT TEMPEROS MESA', slot: 'seasoning_kit' },
      { name: 'PÃO FRANCÊS MINI', slot: 'bread' }
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
          category: 'Base'
        });
        slotOccupied.add(requiredItem.slot);
      }
    });

    grouped['Base'] = deduplicatedBaseItems;

    // Smart juice injection based on client configuration and business rules
    const existingSuco1 = grouped['SUCO1'] || [];
    const existingSuco2 = grouped['SUCO2'] || [];
    const allExistingJuices = [...existingSuco1, ...existingSuco2];
    const juiceNames = allExistingJuices.map(j => normalizeString(j.name || j.nome || ''));
    
    // Group available juices by type from database
    const juicesByType = useMemo(() => {
      const types: { [key: string]: typeof availableJuices } = {
        pro_mix: [],
        vita_suco: [],
        diet: [],
        natural: []
      };
      
      availableJuices.forEach(juice => {
        if (types[juice.tipo]) {
          types[juice.tipo].push(juice);
        }
      });
      
      return types;
    }, [availableJuices]);
    
    // Get client juice configuration
    const clientJuiceConfig = selectedClient ? {
      use_pro_mix: selectedClient.use_pro_mix || false,
      use_pro_vita: selectedClient.use_pro_vita || false,
      use_suco_diet: selectedClient.use_suco_diet || false,
      use_suco_natural: selectedClient.use_suco_natural || false
    } : {
      // Default configuration if no client selected
      use_pro_mix: false,
      use_pro_vita: false,
      use_suco_diet: false,
      use_suco_natural: true
    };
    
    // Select juices based on configuration and business rules
    const selectJuices = () => {
      const selectedJuices: { suco1?: any, suco2?: any } = {};
      
      // BUSINESS RULE: If diet is enabled, one juice must be diet and other non-diet
      if (clientJuiceConfig.use_suco_diet && juicesByType.diet.length > 0) {
        // SUCO1 = Diet juice
        const dietJuices = juicesByType.diet.filter(j => !juiceNames.includes(normalizeString(j.nome)));
        if (dietJuices.length > 0) {
          const randomDiet = dietJuices[Math.floor(Math.random() * dietJuices.length)];
          selectedJuices.suco1 = randomDiet;
        }
        
        // SUCO2 = Non-diet juice (priority: Pro Mix > Vita > Natural)
        const nonDietTypes = ['pro_mix', 'vita_suco', 'natural'];
        for (const type of nonDietTypes) {
          if (
            (type === 'pro_mix' && clientJuiceConfig.use_pro_mix) ||
            (type === 'vita_suco' && clientJuiceConfig.use_pro_vita) ||
            (type === 'natural' && clientJuiceConfig.use_suco_natural)
          ) {
            const typeJuices = juicesByType[type].filter(j => !juiceNames.includes(normalizeString(j.nome)));
            if (typeJuices.length > 0) {
              const randomJuice = typeJuices[Math.floor(Math.random() * typeJuices.length)];
              selectedJuices.suco2 = randomJuice;
              break;
            }
          }
        }
        
        // Fallback: if no non-diet found, use natural as default
        if (!selectedJuices.suco2 && juicesByType.natural.length > 0) {
          const naturalJuices = juicesByType.natural.filter(j => !juiceNames.includes(normalizeString(j.nome)));
          if (naturalJuices.length > 0) {
            selectedJuices.suco2 = naturalJuices[0];
          }
        }
      } else {
        // Normal selection (no diet restriction)
        const enabledTypes = [];
        if (clientJuiceConfig.use_pro_mix) enabledTypes.push('pro_mix');
        if (clientJuiceConfig.use_pro_vita) enabledTypes.push('vita_suco');
        if (clientJuiceConfig.use_suco_natural) enabledTypes.push('natural');
        
        // If no types enabled, use natural as default
        if (enabledTypes.length === 0) {
          enabledTypes.push('natural');
        }
        
        // Collect all available juices from enabled types
        const allEnabledJuices = enabledTypes.flatMap(type => juicesByType[type])
          .filter(j => !juiceNames.includes(normalizeString(j.nome)));
        
        // Select two different juices
        if (allEnabledJuices.length >= 2) {
          const shuffled = [...allEnabledJuices].sort(() => Math.random() - 0.5);
          selectedJuices.suco1 = shuffled[0];
          selectedJuices.suco2 = shuffled[1];
        } else if (allEnabledJuices.length === 1) {
          selectedJuices.suco1 = allEnabledJuices[0];
          // Find a different juice as fallback
          const fallbackJuices = availableJuices.filter(j => 
            j.produto_base_id !== selectedJuices.suco1.produto_base_id &&
            !juiceNames.includes(normalizeString(j.nome))
          );
          if (fallbackJuices.length > 0) {
            selectedJuices.suco2 = fallbackJuices[0];
          }
        }
      }
      
      return selectedJuices;
    };
    
    const selectedJuices = selectJuices();
    
    // Inject SUCO1 if missing
    if (existingSuco1.length === 0 && selectedJuices.suco1) {
      grouped['SUCO1'] = [{
        id: `juice-${selectedJuices.suco1.produto_base_id}`,
        name: selectedJuices.suco1.nome,
        category: 'SUCO1',
        produto_base_id: selectedJuices.suco1.produto_base_id
      }];
    }
    
    // Inject SUCO2 if missing
    if (existingSuco2.length === 0 && selectedJuices.suco2) {
      grouped['SUCO2'] = [{
        id: `juice-${selectedJuices.suco2.produto_base_id}`,
        name: selectedJuices.suco2.nome,
        category: 'SUCO2',
        produto_base_id: selectedJuices.suco2.produto_base_id
      }];
    }
    
    return grouped;
  }, [currentDay]);

  // Calculate real-time costs for recipes
  const [realCosts, setRealCosts] = useState<Record<string, number>>({});
  
  // Load real costs for visible recipes
  useEffect(() => {
    const loadCosts = async () => {
      const allRecipes = Object.values(recipesByCategory).flat();
      const mealsPerDay = 50; // Default, could be from menu config
      
      for (const recipe of allRecipes) {
        const recipeId = recipe.id?.toString() || '';
        const produtoBaseId = recipe.produto_base_id?.toString() || '';
        
        // For injected juices, use produto_base_id; for regular recipes, use recipe ID
        const idToUse = produtoBaseId || recipeId;
        
        if (idToUse && !realCosts[idToUse]) {
          // First try cache
          const cachedCost = getCachedCost(idToUse, mealsPerDay);
          if (cachedCost !== null) {
            setRealCosts(prev => ({ ...prev, [idToUse]: cachedCost }));
          } else {
            // Calculate if not cached
            const result = await calculateRecipeCost(idToUse, mealsPerDay);
            if (result) {
              setRealCosts(prev => ({ ...prev, [idToUse]: result.custo_por_porcao }));
            }
          }
        }
      }
    };
    
    loadCosts();
  }, [recipesByCategory, calculateRecipeCost, getCachedCost, realCosts]);

  // Get real cost for a recipe
  const getRealCost = (recipe: any): number => {
    const recipeId = recipe.id?.toString() || '';
    const produtoBaseId = recipe.produto_base_id?.toString() || '';
    
    // Try recipe ID first, then produto_base_id
    const realCost = realCosts[recipeId] || realCosts[produtoBaseId];
    
    if (realCost !== undefined) {
      return realCost;
    }
    
    // Fallback to original cost logic
    return recipe.cost || recipe.custo || recipe.custo_por_refeicao || 0;
  };

  // Calculate costs separately for Base (fixed) and Variable Menu
  const { baseCost, variableCost, totalCost } = useMemo(() => {
    // Include injected base items in cost calculation
    const baseItems = recipesByCategory['Base'] || [];
    const base = baseItems.reduce((sum, recipe) => sum + getRealCost(recipe), 0);
    
    const allVariableRecipes = CATEGORY_ORDER
      .filter(cat => cat !== 'Base')
      .flatMap(cat => recipesByCategory[cat] || []);
    
    const variable = allVariableRecipes.reduce((sum, recipe) => sum + getRealCost(recipe), 0);
    
    return {
      baseCost: base,
      variableCost: variable,
      totalCost: base + variable
    };
  }, [recipesByCategory, realCosts]);

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
          const categoryTotal = recipes.reduce((sum, recipe) => sum + getRealCost(recipe), 0);
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
                          R$ {getRealCost(recipe).toFixed(2)}
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