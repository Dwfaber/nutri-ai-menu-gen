/**
 * Enhanced menu generation hook with intelligent recipe categorization
 * Uses specialized tables and intelligent algorithms for better suggestions
 */

import { useState } from 'react';
import { useIntelligentCategorization } from './useIntelligentCategorization';
import { useMenuBusinessRules } from './useMenuBusinessRules';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';

export interface EnhancedMenuDay {
  day: string;
  dayIndex: number;
  recipes: {
    pp1: any;
    pp2: any;
    arroz: any;
    feijao: any;
    guarnicao: any;
    salada1: any;
    salada2: any;
    suco1: any;
    suco2: any;
    sobremesa: any;
  };
  totalCost: number;
  withinBudget: boolean;
  warnings: string[];
}

export interface EnhancedGeneratedMenu {
  id: string;
  clientId: string;
  clientName: string;
  weekPeriod: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  totalCost: number;
  costPerMeal: number;
  totalRecipes: number;
  mealsPerDay: number;
  days: EnhancedMenuDay[];
  suggestions: any[];
  balanceReport: {
    proteinVariety: number;
    garnishVariety: number;
    saladVariety: number;
    budgetCompliance: number;
    nutritionScore: number;
  };
  createdAt: string;
  warnings: string[];
}

export const useEnhancedMenuGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState<EnhancedGeneratedMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { selectedClient } = useSelectedClient();
  const { validateMenu, violations } = useMenuBusinessRules();
  const { 
    proteinMappings, 
    garnishMappings, 
    saladMappings, 
    juiceMappings,
    generateRecipeSuggestions,
    isLoading: categorizationLoading 
  } = useIntelligentCategorization();
  const { toast } = useToast();

  // Generate intelligent weekly menu
  const generateEnhancedMenu = async (
    clientData: any,
    period: string,
    mealQuantity: number,
    budgetPerMeal: number,
    periodDays: number = 5,
    juiceConfig?: any,
    restrictions: string[] = [],
    preferences: string[] = []
  ): Promise<EnhancedGeneratedMenu | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const clientToUse = clientData || selectedClient;
      if (!clientToUse) {
        throw new Error('Nenhum cliente selecionado');
      }

      console.log('🎯 Iniciando geração inteligente de cardápio...', {
        client: clientToUse.nome_fantasia,
        mealQuantity,
        budgetPerMeal,
        periodDays
      });

      // Load all available recipes by category
      const [proteinRecipes, garnishRecipes, saladRecipes, sobremesaRecipes] = await Promise.all([
        loadRecipesByCategory(['Prato Principal 1', 'Prato Principal 2']),
        loadRecipesByCategory(['Guarnição']),
        loadRecipesByCategory(['Salada 1', 'Salada 2']),
        loadRecipesByCategory(['Sobremesa'])
      ]);

      const weekDays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
      const menuDays: EnhancedMenuDay[] = [];
      const weeklyRecipes: any[] = [];

      // Generate menu for each day
      for (let dayIndex = 0; dayIndex < periodDays; dayIndex++) {
        const dayName = weekDays[dayIndex] || `Dia ${dayIndex + 1}`;
        
        console.log(`📅 Gerando cardápio para ${dayName}...`);

        // Generate suggestions for each category using intelligent scoring
        const pp1Suggestions = generateRecipeSuggestions(
          weeklyRecipes, 'Prato Principal 1', budgetPerMeal, dayIndex, dayName
        );
        const pp2Suggestions = generateRecipeSuggestions(
          weeklyRecipes, 'Prato Principal 2', budgetPerMeal, dayIndex, dayName
        );
        const garnishSuggestions = generateRecipeSuggestions(
          weeklyRecipes, 'Guarnição', budgetPerMeal, dayIndex, dayName
        );

        // Select best recipes based on suggestions and business rules
        const selectedPP1 = selectOptimalRecipe(pp1Suggestions, proteinRecipes, weeklyRecipes, 'PP1');
        const selectedPP2 = selectOptimalRecipe(pp2Suggestions, proteinRecipes, weeklyRecipes, 'PP2');
        const selectedGarnish = selectOptimalRecipe(garnishSuggestions, garnishRecipes, weeklyRecipes, 'GUARNICAO');

        // Select salads with variety logic
        const selectedSalad1 = selectSaladWithVariety(saladRecipes, weeklyRecipes, 'Salada 1');
        const selectedSalad2 = selectSaladWithVariety(saladRecipes, weeklyRecipes, 'Salada 2');

        // Select juices based on configuration
        const [selectedSuco1, selectedSuco2] = selectJuicesForDay(juiceConfig);

        // Select dessert
        const selectedSobremesa = selectRandomFromCategory(sobremesaRecipes);

        // Fixed recipes
        const arroz = { id: 580, nome: 'Arroz Branco', categoria: 'Arroz Branco', cost: 0.64 };
        const feijao = { id: 1600, nome: 'Feijão', categoria: 'Feijão', cost: 0.12 };

        const dayRecipes = {
          pp1: selectedPP1,
          pp2: selectedPP2,
          arroz,
          feijao,
          guarnicao: selectedGarnish,
          salada1: selectedSalad1,
          salada2: selectedSalad2,
          suco1: selectedSuco1,
          suco2: selectedSuco2,
          sobremesa: selectedSobremesa
        };

        // Calculate day costs and warnings
        const totalCost = Object.values(dayRecipes).reduce((sum: number, recipe: any) => sum + (recipe?.cost || 0), 0);
        const withinBudget = totalCost <= budgetPerMeal;
        const warnings: string[] = [];

        if (!withinBudget) {
          warnings.push(`Custo R$ ${totalCost.toFixed(2)} excede orçamento R$ ${budgetPerMeal.toFixed(2)}`);
        }

        // Check business rules for this day
        const dayRecipeList = Object.values(dayRecipes).filter(Boolean);
        dayRecipeList.forEach(recipe => {
          if (recipe) {
            const enhancedRecipe = { ...recipe, day: dayName };
            weeklyRecipes.push(enhancedRecipe);
          }
        });

        menuDays.push({
          day: dayName,
          dayIndex,
          recipes: dayRecipes,
          totalCost,
          withinBudget,
          warnings
        });

        console.log(`✅ ${dayName} concluído: R$ ${totalCost.toFixed(2)} (${withinBudget ? 'OK' : 'EXCEDE ORÇAMENTO'})`);
      }

      // Calculate balance report
      const balanceReport = calculateBalanceReport(menuDays, weeklyRecipes);

      // Validate complete menu against business rules
      const businessRules = validateMenu(weeklyRecipes);
      const menuWarnings = violations.map(v => v.message);

      const enhancedMenu: EnhancedGeneratedMenu = {
        id: crypto.randomUUID(),
        clientId: clientToUse.id,
        clientName: clientToUse.nome_fantasia || clientToUse.nome_empresa,
        weekPeriod: period || `${format(new Date(), 'dd/MM/yyyy')} - ${format(addDays(new Date(), periodDays - 1), 'dd/MM/yyyy')}`,
        status: 'pending_approval',
        totalCost: menuDays.reduce((sum, day) => sum + day.totalCost, 0) * mealQuantity,
        costPerMeal: menuDays.reduce((sum, day) => sum + day.totalCost, 0) / periodDays,
        totalRecipes: weeklyRecipes.length,
        mealsPerDay: mealQuantity,
        days: menuDays,
        suggestions: [], // To be populated with alternatives
        balanceReport,
        createdAt: new Date().toISOString(),
        warnings: menuWarnings
      };

      setGeneratedMenu(enhancedMenu);

      toast({
        title: "Cardápio Inteligente Gerado!",
        description: `${weeklyRecipes.length} receitas selecionadas com IA. Score de variedade: ${balanceReport.proteinVariety}/10`,
      });

      return enhancedMenu;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);

      toast({
        title: "Erro na geração inteligente",
        description: errorMessage,
        variant: "destructive"
      });

      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper functions
  const loadRecipesByCategory = async (categories: string[]) => {
    const { data: recipes } = await supabase
      .from('receitas_legado')
      .select('receita_id_legado, nome_receita, categoria_descricao, custo_total')
      .in('categoria_descricao', categories)
      .eq('inativa', false);

    return recipes || [];
  };

  const selectOptimalRecipe = (suggestions: any[], availableRecipes: any[], usedRecipes: any[], code: string) => {
    if (suggestions.length === 0) {
      // Fallback to random selection
      const filtered = availableRecipes.filter(r => !usedRecipes.some(u => u.id === r.receita_id_legado));
      const selected = filtered[Math.floor(Math.random() * filtered.length)] || availableRecipes[0];
      return selected ? {
        id: selected.receita_id_legado,
        nome: selected.nome_receita,
        categoria: selected.categoria_descricao,
        codigo: code,
        cost: estimateRecipeCost(selected, code)
      } : null;
    }

    // Select top suggestion that's available
    const topSuggestion = suggestions[0];
    const recipeData = availableRecipes.find(r => r.receita_id_legado === topSuggestion.receita_id);
    
    if (!recipeData) return null;

    const estimatedCost = estimateRecipeCost(recipeData, code);

    return {
      id: recipeData.receita_id_legado,
      nome: recipeData.nome_receita,
      categoria: recipeData.categoria_descricao,
      codigo: code,
      cost: estimatedCost,
      score: topSuggestion.score
    };
  };

  const selectSaladWithVariety = (saladRecipes: any[], usedRecipes: any[], targetCategory: string) => {
    // Filter salads by categoria_descricao directly
    const preferredSalads = saladRecipes.filter(s => s.categoria_descricao === targetCategory);

    const unused = preferredSalads.filter(s => !usedRecipes.some(u => u.id === s.receita_id_legado));
    const selected = unused[Math.floor(Math.random() * unused.length)] || 
                    preferredSalads[Math.floor(Math.random() * preferredSalads.length)] ||
                    saladRecipes[Math.floor(Math.random() * saladRecipes.length)];

    return selected ? {
      id: selected.receita_id_legado,
      nome: selected.nome_receita,
      categoria: selected.categoria_descricao,
      cost: 0.4
    } : null;
  };

  const selectJuicesForDay = (juiceConfig: any) => {
    const availableJuices = juiceMappings.filter(j => j.ativo);
    
    if (availableJuices.length === 0) {
      return [
        { id: 3001, nome: 'Suco Natural Laranja', cost: 0.05 },
        { id: 3002, nome: 'Suco Natural Limão', cost: 0.06 }
      ];
    }

    // Apply juice configuration logic
    let filteredJuices = availableJuices;
    
    if (juiceConfig) {
      filteredJuices = availableJuices.filter(j => {
        if (juiceConfig.use_pro_mix && j.tipo === 'pro_mix') return true;
        if (juiceConfig.use_vita_suco && j.tipo === 'vita_suco') return true;
        if (juiceConfig.use_suco_diet && j.tipo === 'diet') return true;
        if (juiceConfig.use_suco_natural && j.tipo === 'natural') return true;
        return false;
      });
    }

    if (filteredJuices.length === 0) {
      filteredJuices = availableJuices.filter(j => j.tipo === 'natural');
    }

    // Select two different juices
    const shuffled = [...filteredJuices].sort(() => 0.5 - Math.random());
    const suco1 = shuffled[0];
    const suco2 = shuffled.length > 1 ? shuffled[1] : shuffled[0];

    return [
      { id: suco1.produto_base_id, nome: suco1.nome, cost: 0.05 },
      { id: suco2.produto_base_id, nome: suco2.nome, cost: 0.06 }
    ];
  };

  const selectRandomFromCategory = (recipes: any[]) => {
    if (recipes.length === 0) return null;

    // Evitar qualquer sobremesa "Fruta da Estação" (com ou sem acentos)
    const isSeasonalFruit = (text: string) => {
      const n = (text || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
      return n.includes('fruta da estacao') || n.includes('frutas da estacao');
    };

    const filtered = recipes.filter(r => !isSeasonalFruit(r.nome_receita || r.nome));
    const pool = filtered.length > 0 ? filtered : recipes; // fallback seguro

    const selected = pool[Math.floor(Math.random() * pool.length)];
    return {
      id: selected.receita_id_legado,
      nome: selected.nome_receita,
      categoria: 'Sobremesa',
      cost: 0.10
    };
  };
  const estimateRecipeCost = (recipe: any, code: string): number => {
    // Base cost estimation by category
    const baseCosts = {
      'PP1': 1.20,
      'PP2': 1.20,
      'GUARNICAO': 0.90,
      'SALADA1': 0.40,
      'SALADA2': 0.40,
      'SOBREMESA': 0.10
    };

    return baseCosts[code as keyof typeof baseCosts] || 1.00;
  };

  const calculateBalanceReport = (days: EnhancedMenuDay[], weeklyRecipes: any[]) => {
    // Protein variety score
    const proteinTypes = new Set();
    weeklyRecipes.filter(r => ['PP1', 'PP2'].includes(r.codigo)).forEach(r => {
      const mapping = proteinMappings.find(p => p.receita_id === r.id);
      if (mapping) proteinTypes.add(mapping.tipo);
    });

    // Garnish variety score
    const garnishTypes = new Set();
    weeklyRecipes.filter(r => r.codigo === 'GUARNICAO').forEach(r => {
      const mapping = garnishMappings.find(g => g.receita_id === r.id);
      if (mapping) garnishTypes.add(mapping.tipo);
    });

    // Salad variety score
    const saladTypes = new Set();
    weeklyRecipes.filter(r => ['SALADA1', 'SALADA2'].includes(r.codigo)).forEach(r => {
      const mapping = saladMappings.find(s => s.receita_id === r.id);
      if (mapping) saladTypes.add(mapping.tipo);
    });

    // Budget compliance
    const daysWithinBudget = days.filter(d => d.withinBudget).length;
    const budgetCompliance = (daysWithinBudget / days.length) * 10;

    return {
      proteinVariety: Math.min(10, proteinTypes.size * 2), // Max 5 types = 10 points
      garnishVariety: Math.min(10, garnishTypes.size * 2.5), // Max 4 types = 10 points
      saladVariety: Math.min(10, saladTypes.size * 3.33), // Max 3 types = 10 points
      budgetCompliance: Math.round(budgetCompliance),
      nutritionScore: 7 // Placeholder for nutrition scoring
    };
  };

  return {
    isGenerating: isGenerating || categorizationLoading,
    generatedMenu,
    error,
    generateEnhancedMenu,
    clearGeneratedMenu: () => setGeneratedMenu(null),
    clearError: () => setError(null)
  };
};