/**
 * Sistema inteligente de categorização de verduras e legumes
 */

export interface VegetableInfo {
  id: number;
  name: string;
  category: VegetableCategory;
  subCategory: VegetableSubCategory;
  nutritionalValue: NutritionalProfile;
  seasonality: SeasonalityInfo;
  preparationTime: PreparationLevel;
  storageLife: number; // days
  priceCategory: 'budget' | 'medium' | 'premium';
}

export type VegetableCategory = 
  | 'folhosas' 
  | 'raizes_tuberculos' 
  | 'frutos' 
  | 'bulbos' 
  | 'aromaticas' 
  | 'brassicas'
  | 'leguminosas';

export type VegetableSubCategory = 
  | 'verduras_folhas' 
  | 'legumes' 
  | 'temperos' 
  | 'frutas_legumes';

export interface NutritionalProfile {
  vitamins: string[];
  minerals: string[];
  fiber: 'low' | 'medium' | 'high';
  antioxidants: 'low' | 'medium' | 'high';
  waterContent: 'low' | 'medium' | 'high';
}

export interface SeasonalityInfo {
  peak: string[]; // meses
  available: string[]; // meses disponíveis
  imported: boolean;
}

export type PreparationLevel = 'minimal' | 'medium' | 'advanced';

/**
 * Base de conhecimento de verduras e legumes
 */
export const VEGETABLES_DATABASE: Record<string, Partial<VegetableInfo>> = {
  // Folhosas
  'ALFACE': {
    category: 'folhosas',
    subCategory: 'verduras_folhas',
    nutritionalValue: {
      vitamins: ['A', 'K', 'Folato'],
      minerals: ['Ferro', 'Potássio'],
      fiber: 'medium',
      antioxidants: 'medium',
      waterContent: 'high'
    },
    seasonality: { peak: ['mar', 'abr', 'mai', 'set', 'out'], available: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], imported: false },
    preparationTime: 'minimal',
    storageLife: 7,
    priceCategory: 'budget'
  },
  
  'COUVE': {
    category: 'brassicas',
    subCategory: 'verduras_folhas',
    nutritionalValue: {
      vitamins: ['A', 'C', 'K', 'Folato'],
      minerals: ['Cálcio', 'Ferro', 'Magnésio'],
      fiber: 'high',
      antioxidants: 'high',
      waterContent: 'medium'
    },
    seasonality: { peak: ['mai', 'jun', 'jul', 'ago'], available: ['mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out'], imported: false },
    preparationTime: 'medium',
    storageLife: 5,
    priceCategory: 'budget'
  },

  'ESPINAFRE': {
    category: 'folhosas',
    subCategory: 'verduras_folhas',
    nutritionalValue: {
      vitamins: ['A', 'C', 'K', 'Folato'],
      minerals: ['Ferro', 'Magnésio', 'Potássio'],
      fiber: 'medium',
      antioxidants: 'high',
      waterContent: 'high'
    },
    seasonality: { peak: ['abr', 'mai', 'jun', 'jul', 'ago'], available: ['mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'], imported: false },
    preparationTime: 'minimal',
    storageLife: 3,
    priceCategory: 'medium'
  },

  // Raízes e Tubérculos  
  'CENOURA': {
    category: 'raizes_tuberculos',
    subCategory: 'legumes',
    nutritionalValue: {
      vitamins: ['A', 'Beta-caroteno', 'K'],
      minerals: ['Potássio', 'Manganês'],
      fiber: 'medium',
      antioxidants: 'high',
      waterContent: 'medium'
    },
    seasonality: { peak: ['mai', 'jun', 'jul', 'ago', 'set'], available: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], imported: false },
    preparationTime: 'minimal',
    storageLife: 14,
    priceCategory: 'budget'
  },

  'BETERRABA': {
    category: 'raizes_tuberculos',
    subCategory: 'legumes',
    nutritionalValue: {
      vitamins: ['Folato', 'C'],
      minerals: ['Potássio', 'Manganês', 'Ferro'],
      fiber: 'medium',
      antioxidants: 'high',
      waterContent: 'medium'
    },
    seasonality: { peak: ['mai', 'jun', 'jul', 'ago'], available: ['abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out'], imported: false },
    preparationTime: 'medium',
    storageLife: 10,
    priceCategory: 'medium'
  },

  // Frutos
  'TOMATE': {
    category: 'frutos',
    subCategory: 'frutas_legumes',
    nutritionalValue: {
      vitamins: ['C', 'A', 'K'],
      minerals: ['Potássio', 'Fósforo'],
      fiber: 'medium',
      antioxidants: 'high',
      waterContent: 'high'
    },
    seasonality: { peak: ['dez', 'jan', 'fev', 'mar'], available: ['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai'], imported: true },
    preparationTime: 'minimal',
    storageLife: 7,
    priceCategory: 'medium'
  },

  'ABOBRINHA': {
    category: 'frutos',
    subCategory: 'legumes',
    nutritionalValue: {
      vitamins: ['A', 'C', 'Folato'],
      minerals: ['Potássio', 'Manganês'],
      fiber: 'medium',
      antioxidants: 'medium',
      waterContent: 'high'
    },
    seasonality: { peak: ['fev', 'mar', 'abr', 'mai'], available: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul'], imported: false },
    preparationTime: 'minimal',
    storageLife: 5,
    priceCategory: 'medium'
  },

  // Bulbos
  'CEBOLA': {
    category: 'bulbos',
    subCategory: 'temperos',
    nutritionalValue: {
      vitamins: ['C', 'B6'],
      minerals: ['Potássio', 'Fósforo'],
      fiber: 'medium',
      antioxidants: 'medium',
      waterContent: 'medium'
    },
    seasonality: { peak: ['set', 'out', 'nov', 'dez'], available: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], imported: false },
    preparationTime: 'minimal',
    storageLife: 30,
    priceCategory: 'budget'
  },

  // Aromáticas
  'SALSA': {
    category: 'aromaticas',
    subCategory: 'temperos',
    nutritionalValue: {
      vitamins: ['A', 'C', 'K'],
      minerals: ['Ferro', 'Potássio'],
      fiber: 'medium',
      antioxidants: 'high',
      waterContent: 'medium'
    },
    seasonality: { peak: ['mar', 'abr', 'mai', 'set', 'out'], available: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], imported: false },
    preparationTime: 'minimal',
    storageLife: 5,
    priceCategory: 'budget'
  }
};

/**
 * Normaliza nome de produto para busca
 */
export const normalizeProductName = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Classifica produto como verdura/legume
 */
export const categorizeVegetable = (productName: string): VegetableInfo | null => {
  const normalized = normalizeProductName(productName);
  
  // Busca exata primeiro
  if (VEGETABLES_DATABASE[normalized]) {
    return {
      id: 0,
      name: productName,
      ...VEGETABLES_DATABASE[normalized]
    } as VegetableInfo;
  }
  
  // Busca por similaridade
  for (const [key, info] of Object.entries(VEGETABLES_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        id: 0,
        name: productName,
        ...info
      } as VegetableInfo;
    }
  }
  
  return null;
};

/**
 * Sugere combinações balanceadas
 */
export const suggestBalancedCombination = (
  availableVegetables: VegetableInfo[],
  targetNutrients: string[] = ['A', 'C', 'Ferro', 'Folato']
): VegetableInfo[] => {
  const selected: VegetableInfo[] = [];
  const categoriesUsed = new Set<VegetableCategory>();
  const nutrientsGained = new Set<string>();
  
  // Priorizar variedade de categorias e nutrientes
  for (const vegetable of availableVegetables) {
    if (selected.length >= 4) break;
    
    // Evitar repetir categorias se possível
    if (categoriesUsed.has(vegetable.category) && categoriesUsed.size < 3) {
      continue;
    }
    
    // Priorizar nutrientes-alvo que ainda não temos
    const hasTargetNutrient = targetNutrients.some(nutrient => 
      vegetable.nutritionalValue.vitamins.includes(nutrient) ||
      vegetable.nutritionalValue.minerals.includes(nutrient)
    );
    
    if (hasTargetNutrient || nutrientsGained.size < targetNutrients.length) {
      selected.push(vegetable);
      categoriesUsed.add(vegetable.category);
      
      vegetable.nutritionalValue.vitamins.forEach(v => nutrientsGained.add(v));
      vegetable.nutritionalValue.minerals.forEach(m => nutrientsGained.add(m));
    }
  }
  
  return selected;
};

/**
 * Otimiza seleção por custo e sazonalidade
 */
export const optimizeBySeasonAndPrice = (
  vegetables: VegetableInfo[],
  currentMonth: string,
  budget: 'low' | 'medium' | 'high' = 'medium'
): VegetableInfo[] => {
  const priceMapping = {
    low: ['budget'],
    medium: ['budget', 'medium'],
    high: ['budget', 'medium', 'premium']
  };
  
  return vegetables
    .filter(v => priceMapping[budget].includes(v.priceCategory))
    .sort((a, b) => {
      // Priorizar produtos da época
      const aInSeason = a.seasonality.peak.includes(currentMonth);
      const bInSeason = b.seasonality.peak.includes(currentMonth);
      
      if (aInSeason && !bInSeason) return -1;
      if (!aInSeason && bInSeason) return 1;
      
      // Depois por preço
      const priceOrder = { budget: 0, medium: 1, premium: 2 };
      return priceOrder[a.priceCategory] - priceOrder[b.priceCategory];
    });
};

/**
 * Gera rotatividade semanal inteligente
 */
export const generateWeeklyRotation = (
  availableVegetables: VegetableInfo[],
  usedThisWeek: string[] = []
): Record<string, VegetableInfo[]> => {
  const currentMonth = new Date().toLocaleString('pt-BR', { month: 'short' });
  const unusedVegetables = availableVegetables.filter(v => 
    !usedThisWeek.includes(v.name)
  );
  
  const rotation: Record<string, VegetableInfo[]> = {};
  const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
  
  days.forEach((day, index) => {
    const dayVegetables = optimizeBySeasonAndPrice(unusedVegetables, currentMonth)
      .slice(index * 2, (index * 2) + 3); // 2-3 verduras por dia
    
    rotation[day] = suggestBalancedCombination(dayVegetables);
  });
  
  return rotation;
};