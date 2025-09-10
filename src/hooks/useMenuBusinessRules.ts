import { useState } from 'react';

export interface ProteinClassification {
  type: 'frango' | 'bovina' | 'suina' | 'peixe' | 'vegetariana' | 'outras';
  isRedMeat: boolean;
}

export interface MenuBusinessRules {
  proteinVariety: boolean; // No same protein on consecutive days
  redMeatLimit: boolean; // No two red meats same day
  mondayProcessing: boolean; // No advance prep on Mondays
  requiredStructure: boolean; // PP1, PP2, Rice, Beans, Salad1, Salad2, Juice1, Juice2
}

export interface MenuViolation {
  type: 'protein_consecutive' | 'red_meat_limit' | 'monday_processing' | 'structure_incomplete' | 'ingredient_missing' | 'ingredient_substituted' | 'ingredient_zero_cost';
  message: string;
  day?: string;
  recipes?: string[];
  ingredientId?: number;
  ingredientName?: string;
  substituteName?: string;
  cost?: number;
}

export const useMenuBusinessRules = () => {
  const [violations, setViolations] = useState<MenuViolation[]>([]);

  // Classify protein type from recipe name
  const classifyProtein = (recipeName: string): ProteinClassification => {
    const name = recipeName.toLowerCase();
    
    if (name.includes('frango') || name.includes('ave') || name.includes('galinha')) {
      return { type: 'frango', isRedMeat: false };
    }
    
    if (name.includes('boi') || name.includes('bife') || name.includes('carne') || name.includes('acém') || name.includes('músculo')) {
      return { type: 'bovina', isRedMeat: true };
    }
    
    if (name.includes('porco') || name.includes('lombo') || name.includes('copa') || name.includes('suíno')) {
      return { type: 'suina', isRedMeat: true };
    }
    
    if (name.includes('peixe') || name.includes('tilápia') || name.includes('salmão') || name.includes('bacalhau')) {
      return { type: 'peixe', isRedMeat: false };
    }
    
    if (name.includes('vegetal') || name.includes('soja') || name.includes('tofu') || name.includes('grão')) {
      return { type: 'vegetariana', isRedMeat: false };
    }
    
    return { type: 'outras', isRedMeat: false };
  };

  // Check if recipe requires advance preparation
  const requiresAdvancePreparation = (recipeName: string): boolean => {
    const name = recipeName.toLowerCase();
    const advanceKeywords = [
      'marinado', 'marinada', 'temperado overnight', 'dia anterior',
      'descongelamento', 'dessalgue', 'demolho', 'fermentado'
    ];
    
    return advanceKeywords.some(keyword => name.includes(keyword));
  };

  // Categorize salad type with enhanced intelligence based on available vegetables
  const categorizeSalad = (recipeName: string): 'verduras_folhas' | 'legumes' | 'mista' => {
    const name = recipeName.toLowerCase();
    
    // Verduras de folhas (expandido com base nos produtos disponíveis)
    const folhosas = [
      'alface', 'rúcula', 'agrião', 'espinafre', 'couve', 'acelga', 
      'almeirão', 'chicória', 'endívia', 'mostarda', 'taioba', 'repolho'
    ];
    
    // Legumes (expandido com produtos identificados)
    const legumes = [
      'tomate', 'cenoura', 'beterraba', 'abobrinha', 'pepino', 'cebola',
      'pimentão', 'rabanete', 'nabo', 'chuchu', 'quiabo', 'berinjela',
      'abóbora', 'mandioca', 'batata', 'inhame', 'mandioquinha', 'brócolis'
    ];
    
    // Aromáticas e temperos
    const aromaticas = [
      'salsa', 'cebolinha', 'coentro', 'manjericão', 'orégano', 'tomilho'
    ];
    
    const hasFolhosas = folhosas.some(item => name.includes(item));
    const hasLegumes = legumes.some(item => name.includes(item));
    const hasAromaticas = aromaticas.some(item => name.includes(item));
    
    // Lógica melhorada de categorização
    if (hasFolhosas && hasLegumes) return 'mista';
    if (hasFolhosas || hasAromaticas) return 'verduras_folhas';
    if (hasLegumes) return 'legumes';
    
    // Padrões específicos para saladas
    if (name.includes('salada verde') || name.includes('folhas')) return 'verduras_folhas';
    if (name.includes('legumes') || name.includes('raízes')) return 'legumes';
    
    // Default para mista se não conseguir classificar especificamente
    return 'mista';
  };

  // Validate protein variety rules
  const validateProteinVariety = (recipes: any[]): MenuViolation[] => {
    const violations: MenuViolation[] = [];
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    
    // Group recipes by day
    const recipesByDay: { [key: string]: any[] } = {};
    recipes.forEach(recipe => {
      const day = recipe.day || '';
      if (!recipesByDay[day]) recipesByDay[day] = [];
      recipesByDay[day].push(recipe);
    });

    // Check consecutive days for same protein
    for (let i = 0; i < days.length - 1; i++) {
      const today = days[i];
      const tomorrow = days[i + 1];
      
      const todayProteins = (recipesByDay[today] || [])
        .filter(r => (r.categoria || r.category) === 'Prato Principal 1' || (r.categoria || r.category) === 'Prato Principal 2')
        .map(r => classifyProtein(r.nome || r.name));
      
      const tomorrowProteins = (recipesByDay[tomorrow] || [])
        .filter(r => (r.categoria || r.category) === 'Prato Principal 1' || (r.categoria || r.category) === 'Prato Principal 2')
        .map(r => classifyProtein(r.nome || r.name));

      // Check for consecutive same protein
      todayProteins.forEach(todayProtein => {
        tomorrowProteins.forEach(tomorrowProtein => {
          if (todayProtein.type === tomorrowProtein.type) {
            violations.push({
              type: 'protein_consecutive',
              message: `Mesma proteína (${todayProtein.type}) em dias consecutivos: ${today} e ${tomorrow}`,
              day: tomorrow
            });
          }
        });
      });
    }

    // Check red meat limit per day
    days.forEach(day => {
      const dayRecipes = recipesByDay[day] || [];
      const redMeatCount = dayRecipes
        .filter(r => (r.categoria || r.category) === 'Prato Principal 1' || (r.categoria || r.category) === 'Prato Principal 2')
        .map(r => classifyProtein(r.nome || r.name))
        .filter(p => p.isRedMeat).length;

      if (redMeatCount > 1) {
        violations.push({
          type: 'red_meat_limit',
          message: `Mais de uma carne vermelha no mesmo dia: ${day}`,
          day,
          recipes: dayRecipes
            .filter(r => ((r.categoria || r.category) === 'Prato Principal 1' || (r.categoria || r.category) === 'Prato Principal 2') && classifyProtein(r.nome || r.name).isRedMeat)
            .map(r => r.nome || r.name)
        });
      }
    });

    return violations;
  };

  // Validate Monday processing rules
  const validateMondayProcessing = (recipes: any[]): MenuViolation[] => {
    const violations: MenuViolation[] = [];
    const mondayRecipes = recipes.filter(r => r.day === 'Segunda');
    
    mondayRecipes.forEach(recipe => {
      if (requiresAdvancePreparation(recipe.nome || recipe.name)) {
        violations.push({
          type: 'monday_processing',
          message: `Receita com preparo antecipado na segunda-feira: ${recipe.nome || recipe.name}`,
          day: 'Segunda',
          recipes: [recipe.nome || recipe.name]
        });
      }
    });

    return violations;
  };

  // Validate menu structure
  const validateMenuStructure = (recipes: any[]): MenuViolation[] => {
    const violations: MenuViolation[] = [];
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    // Usar códigos fixos, iguais ao backend
    const requiredCodes = ['PP1','PP2','ARROZ','FEIJAO','SALADA1','SALADA2','SUCO1','SUCO2'];
    
    // Group recipes by day
    const recipesByDay: { [key: string]: any[] } = {};
    recipes.forEach(recipe => {
      const day = recipe.day || recipe.dia || '';
      if (!recipesByDay[day]) recipesByDay[day] = [];
      recipesByDay[day].push(recipe);
    });

    days.forEach(day => {
      const dayRecipes = recipesByDay[day] || [];
      // Priorizar código, fallback para categoria
      const codesPresent = dayRecipes.map(r => r.codigo || r.categoria || r.category);
      
      const missing = requiredCodes.filter(cod => !codesPresent.includes(cod));
      
      if (missing.length > 0) {
        violations.push({
          type: 'structure_incomplete',
          message: `Estrutura incompleta em ${day}. Faltam: ${missing.join(', ')}`,
          day,
          recipes: missing
        });
      }
    });

    return violations;
  };

  // Main validation function (pure function - no side effects)
  const validateMenu = (recipes: any[]): MenuBusinessRules => {
    const allViolations: MenuViolation[] = [
      ...validateProteinVariety(recipes),
      ...validateMondayProcessing(recipes),
      ...validateMenuStructure(recipes)
    ];

    return {
      proteinVariety: !allViolations.some(v => v.type === 'protein_consecutive' || v.type === 'red_meat_limit'),
      redMeatLimit: !allViolations.some(v => v.type === 'red_meat_limit'),
      mondayProcessing: !allViolations.some(v => v.type === 'monday_processing'),
      requiredStructure: !allViolations.some(v => v.type === 'structure_incomplete')
    };
  };

  // Function to validate menu and update violations state
  const validateMenuAndSetViolations = (recipes: any[]): MenuBusinessRules => {
    const allViolations: MenuViolation[] = [
      ...validateProteinVariety(recipes),
      ...validateMondayProcessing(recipes),
      ...validateMenuStructure(recipes)
    ];

    setViolations(allViolations);

    return {
      proteinVariety: !allViolations.some(v => v.type === 'protein_consecutive' || v.type === 'red_meat_limit'),
      redMeatLimit: !allViolations.some(v => v.type === 'red_meat_limit'),
      mondayProcessing: !allViolations.some(v => v.type === 'monday_processing'),
      requiredStructure: !allViolations.some(v => v.type === 'structure_incomplete')
    };
  };

  // Filter recipes based on business rules
  const filterRecipesForDay = (
    availableRecipes: any[],
    day: string,
    dayIndex: number,
    previousDayRecipes: any[] = []
  ): any[] => {
    let filtered = [...availableRecipes];

    // Monday: filter out advance preparation recipes
    if (day === 'Segunda') {
      filtered = filtered.filter(recipe => !requiresAdvancePreparation(recipe.nome_receita));
    }

    // Protein variety: avoid same protein as previous day
    if (previousDayRecipes.length > 0) {
      const previousProteins = previousDayRecipes
        .filter(r => (r.categoria || r.category) === 'Prato Principal 1' || (r.categoria || r.category) === 'Prato Principal 2')
        .map(r => classifyProtein(r.nome || r.name));

      filtered = filtered.filter(recipe => {
        const currentProtein = classifyProtein(recipe.nome_receita || recipe.nome || recipe.name);
        return !previousProteins.some(prev => prev.type === currentProtein.type);
      });
    }

    return filtered;
  };

  return {
    violations,
    validateMenu,
    validateMenuAndSetViolations,
    filterRecipesForDay,
    classifyProtein,
    requiresAdvancePreparation,
    categorizeSalad,
    validateProteinVariety,
    validateMondayProcessing,
    validateMenuStructure
  };
};