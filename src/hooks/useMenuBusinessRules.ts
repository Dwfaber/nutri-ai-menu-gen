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
  type: 'protein_consecutive' | 'red_meat_limit' | 'protein_duplicate_same_day' | 'monday_processing' | 'structure_incomplete' | 'ingredient_missing' | 'ingredient_substituted' | 'ingredient_zero_cost';
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

  // Função utilitária para normalizar os dias
  const normalizarDia = (dia: string): string => {
    const mapeamento: Record<string, string> = {
      'Segunda': 'Segunda-feira',
      'Terça': 'Terça-feira',
      'Quarta': 'Quarta-feira',
      'Quinta': 'Quinta-feira',
      'Sexta': 'Sexta-feira',
      // Mapeamento reverso caso seja necessário
      'Segunda-feira': 'Segunda-feira',
      'Terça-feira': 'Terça-feira',
      'Quarta-feira': 'Quarta-feira',
      'Quinta-feira': 'Quinta-feira',
      'Sexta-feira': 'Sexta-feira'
    };
    return mapeamento[dia] || dia;
  };

  // Enhanced protein classification with expanded keywords and patterns
  const classifyProtein = (recipeName: string): ProteinClassification => {
    const name = recipeName.toLowerCase();
    
    // Frango/Aves - Expanded keywords
    const frangoKeywords = ['frango', 'ave', 'galinha', 'peito', 'coxa', 'asa', 'chester', 'escondidinho de frango', 'strogonoff de frango'];
    if (frangoKeywords.some(keyword => name.includes(keyword))) {
      return { type: 'frango', isRedMeat: false };
    }
    
    // Carne Bovina - Expanded keywords
    const bovinaKeywords = ['boi', 'bife', 'carne', 'acém', 'músculo', 'alcatra', 'patinho', 'coxão', 'maminha', 'picanha', 'costela', 'cupim', 'rabada', 'cozido', 'panelada', 'strogonoff de carne', 'iscas', 'bifão', 'moída'];
    if (bovinaKeywords.some(keyword => name.includes(keyword))) {
      return { type: 'bovina', isRedMeat: true };
    }
    
    // Carne Suína - Expanded keywords
    const suinaKeywords = ['porco', 'lombo', 'copa', 'suíno', 'pernil', 'bisteca', 'costela de porco', 'bacon', 'linguiça', 'salsicha', 'presunto'];
    if (suinaKeywords.some(keyword => name.includes(keyword))) {
      return { type: 'suina', isRedMeat: true };
    }
    
    // Peixe - Expanded keywords
    const peixeKeywords = ['peixe', 'tilápia', 'salmão', 'bacalhau', 'sardinha', 'pescada', 'merluza', 'cação', 'dourado', 'robalo', 'corvina', 'filé de peixe'];
    if (peixeKeywords.some(keyword => name.includes(keyword))) {
      return { type: 'peixe', isRedMeat: false };
    }
    
    // Vegetariana - Expanded keywords
    const vegetarianaKeywords = ['vegetal', 'soja', 'tofu', 'grão', 'lentilha', 'grão-de-bico', 'ervilha', 'quinoa', 'proteína de soja', 'hambúrguer de soja', 'vegetariano', 'vegano'];
    if (vegetarianaKeywords.some(keyword => name.includes(keyword))) {
      return { type: 'vegetariana', isRedMeat: false };
    }
    
    // Ovos - New category
    const ovoKeywords = ['ovo', 'omelete', 'fritada', 'mexido', 'ovo cozido', 'ovo frito'];
    if (ovoKeywords.some(keyword => name.includes(keyword))) {
      return { type: 'outras', isRedMeat: false }; // Could be expanded to 'ovo' type if needed
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

  // Enhanced salad categorization with better ingredient mapping
  const categorizeSalad = (recipeName: string): 'verduras_folhas' | 'legumes' | 'mista' => {
    const name = recipeName.toLowerCase();
    
    // Verduras de folhas - Expanded with seasonal varieties
    const folhosas = [
      'alface', 'rúcula', 'agrião', 'espinafre', 'couve', 'acelga', 
      'almeirão', 'chicória', 'endívia', 'mostarda', 'taioba', 'repolho',
      'escarola', 'catalonha', 'bertalha', 'ora-pro-nóbis', 'folhas verdes'
    ];
    
    // Legumes cozidos e crus - Better categorization
    const legumesCrus = [
      'tomate', 'pepino', 'rabanete', 'cebola roxa', 'pimentão cru'
    ];
    
    const legumesCozidos = [
      'cenoura', 'beterraba', 'abobrinha', 'chuchu', 'quiabo', 'berinjela',
      'abóbora', 'brócolis', 'couve-flor', 'vagem', 'ervilha torta'
    ];
    
    // Raízes e tubérculos
    const raizes = [
      'mandioca', 'batata', 'batata doce', 'inhame', 'mandioquinha',
      'nabo', 'rabanete', 'beterraba'
    ];
    
    // Aromáticas e temperos frescos
    const aromaticas = [
      'salsa', 'cebolinha', 'coentro', 'manjericão', 'orégano', 'tomilho',
      'hortelã', 'alecrim', 'salsão', 'aipo'
    ];
    
    // Identificar componentes
    const hasFolhosas = folhosas.some(item => name.includes(item));
    const hasLegumesCrus = legumesCrus.some(item => name.includes(item));
    const hasLegumesCozidos = legumesCozidos.some(item => name.includes(item));
    const hasRaizes = raizes.some(item => name.includes(item));
    const hasAromaticas = aromaticas.some(item => name.includes(item));
    
    // Padrões específicos de saladas identificados
    if (name.includes('salada verde') || name.includes('mix de folhas')) return 'verduras_folhas';
    if (name.includes('legumes refogados') || name.includes('legumes cozidos')) return 'legumes';
    if (name.includes('salada mista') || name.includes('salada completa')) return 'mista';
    
    // Lógica melhorada de categorização
    const componentCount = [hasFolhosas, hasLegumesCrus, hasLegumesCozidos, hasRaizes].filter(Boolean).length;
    
    if (componentCount >= 2 || (hasFolhosas && (hasLegumesCrus || hasLegumesCozidos))) {
      return 'mista'; // Salada com múltiplos componentes
    }
    
    if (hasFolhosas || hasAromaticas) {
      return 'verduras_folhas'; // Predominantemente folhas verdes
    }
    
    if (hasLegumesCrus || hasLegumesCozidos || hasRaizes) {
      return 'legumes'; // Predominantemente legumes/raízes
    }
    
    // Default inteligente baseado no nome
    if (name.includes('verde') || name.includes('folha')) return 'verduras_folhas';
    if (name.includes('cozid') || name.includes('refogad')) return 'legumes';
    
    return 'mista'; // Default mais conservador
  };

  // Validate protein variety rules
  const validateProteinVariety = (recipes: any[]): MenuViolation[] => {
    const violations: MenuViolation[] = [];
    const orderedDays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
    
    // Group recipes by day
    const recipesByDay: { [key: string]: any[] } = {};
    recipes.forEach(recipe => {
      const day = normalizarDia(recipe.day || recipe.dia || '');
      if (!recipesByDay[day]) recipesByDay[day] = [];
      recipesByDay[day].push(recipe);
    });

    // Consider only days that actually have recipes
    const days = orderedDays.filter(d => (recipesByDay[d] && recipesByDay[d].length));

    const isPrincipal = (r: any) => {
      const raw = (r.codigo || r.categoria || r.category || '').toString();
      const upper = raw.toUpperCase();
      return upper === 'PP1' || upper === 'PP2' || raw === 'Prato Principal 1' || raw === 'Prato Principal 2';
    };

    // Check consecutive days for same protein
    for (let i = 0; i < Math.max(0, days.length - 1); i++) {
      const today = days[i];
      const tomorrow = days[i + 1];
      
      const todayProteins = (recipesByDay[today] || [])
        .filter(r => isPrincipal(r))
        .map(r => classifyProtein(r.nome || r.name));
      
      const tomorrowProteins = (recipesByDay[tomorrow] || [])
        .filter(r => isPrincipal(r))
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
        .filter(r => isPrincipal(r))
        .map(r => classifyProtein(r.nome || r.name))
        .filter(p => p.isRedMeat).length;

      if (redMeatCount > 1) {
        violations.push({
          type: 'red_meat_limit',
          message: `Mais de uma carne vermelha no mesmo dia: ${day}`,
          day,
          recipes: dayRecipes
            .filter(r => isPrincipal(r) && classifyProtein(r.nome || r.name).isRedMeat)
            .map(r => r.nome || r.name)
        });
      }
    });

    // Check for duplicate protein types on the same day
    days.forEach(day => {
      const dayRecipes = recipesByDay[day] || [];
      const mainDishes = dayRecipes.filter(r => isPrincipal(r));
      
      if (mainDishes.length >= 2) {
        const proteinTypes = mainDishes.map(r => classifyProtein(r.nome || r.name).type);
        const proteinCounts: { [key: string]: number } = {};
        
        proteinTypes.forEach(type => {
          proteinCounts[type] = (proteinCounts[type] || 0) + 1;
        });
        
        Object.entries(proteinCounts).forEach(([type, count]) => {
          if (count > 1) {
            violations.push({
              type: 'protein_duplicate_same_day',
              message: `Proteína duplicada no mesmo dia (${type}): ${day}`,
              day,
              recipes: mainDishes
                .filter(r => classifyProtein(r.nome || r.name).type === type)
                .map(r => r.nome || r.name)
            });
          }
        });
      }
    });

    return violations;
  };

  // Validate Monday processing rules
  const validateMondayProcessing = (recipes: any[]): MenuViolation[] => {
    const violations: MenuViolation[] = [];
    const mondayRecipes = recipes.filter(r => normalizarDia(r.day || r.dia || '') === 'Segunda-feira');
    
    mondayRecipes.forEach(recipe => {
      if (requiresAdvancePreparation(recipe.nome || recipe.name)) {
        violations.push({
          type: 'monday_processing',
          message: `Receita com preparo antecipado na segunda-feira: ${recipe.nome || recipe.name}`,
          day: 'Segunda-feira',
          recipes: [recipe.nome || recipe.name]
        });
      }
    });

    return violations;
  };

  // Validate menu structure
  const validateMenuStructure = (recipes: any[]): MenuViolation[] => {
    const violations: MenuViolation[] = [];
    const orderedDays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
    // Usar códigos fixos, iguais ao backend (removidos sucos pois não são gerados)
    const requiredCodes = ['PP1','PP2','ARROZ','FEIJAO','SALADA1','SALADA2'];
    
    // Group recipes by day
    const recipesByDay: { [key: string]: any[] } = {};
    recipes.forEach(recipe => {
      const day = normalizarDia(recipe.day || recipe.dia || '');
      if (!recipesByDay[day]) recipesByDay[day] = [];
      recipesByDay[day].push(recipe);
    });

    // Validate only days that actually have recipes
    const days = orderedDays.filter(d => (recipesByDay[d] && recipesByDay[d].length));

    days.forEach(day => {
      const dayRecipes = recipesByDay[day] || [];
      // Priorizar código, fallback para categoria
      const codesPresent = dayRecipes.map(r => (r.codigo || r.categoria || r.category || '').toString().toUpperCase());
      
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
      proteinVariety: !allViolations.some(v => v.type === 'protein_consecutive' || v.type === 'red_meat_limit' || v.type === 'protein_duplicate_same_day'),
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
      proteinVariety: !allViolations.some(v => v.type === 'protein_consecutive' || v.type === 'red_meat_limit' || v.type === 'protein_duplicate_same_day'),
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
    if (normalizarDia(day) === 'Segunda-feira') {
      filtered = filtered.filter(recipe => !requiresAdvancePreparation(recipe.nome_receita));
    }

    // Protein variety: avoid same protein as previous day
    if (previousDayRecipes.length > 0) {
      const isPrincipal = (r: any) => {
        const raw = (r.codigo || r.categoria || r.category || '').toString();
        const upper = raw.toUpperCase();
        return upper === 'PP1' || upper === 'PP2' || raw === 'Prato Principal 1' || raw === 'Prato Principal 2';
      };

      const previousProteins = previousDayRecipes
        .filter(r => isPrincipal(r))
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