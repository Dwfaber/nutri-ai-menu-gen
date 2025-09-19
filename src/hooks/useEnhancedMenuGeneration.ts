/**
 * Enhanced menu generation hook with intelligent recipe categorization
 * Uses specialized tables and intelligent algorithms for better suggestions
 */

import { useState } from 'react';
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
  const { validateMenu, violations, classifyProtein } = useMenuBusinessRules();
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

      // Load all available recipes by category using categoria_descricao
      const [
        proteinRecipes, 
        garnishRecipes, 
        saladRecipes, 
        sobremesaRecipes,
        sucoRecipes,
        arrozRecipes,
        feijaoRecipes,
        baseRecipes
      ] = await Promise.all([
        loadRecipesByCategory(['Prato Principal 1', 'Prato Principal 2']),
        loadRecipesByCategory(['Guarnição']),
        loadRecipesByCategory(['Salada 1', 'Salada 2']),
        loadRecipesByCategory(['Sobremesa']),
        loadRecipesByCategory(['Suco 1', 'Suco 2']),
        loadRecipesByCategory(['Arroz']),
        loadRecipesByCategory(['Feijão']),
        loadRecipesByCategory(['Base'])
      ]);

      const weekDays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
      const menuDays: EnhancedMenuDay[] = [];
      const weeklyRecipes: any[] = [];

      // Generate menu for each day
      for (let dayIndex = 0; dayIndex < periodDays; dayIndex++) {
        const dayName = weekDays[dayIndex] || `Dia ${dayIndex + 1}`;
        
        console.log(`📅 Gerando cardápio para ${dayName}...`);

        // Select recipes using categoria_descricao directly with protein variety logic
        const selectedPP1 = selectRecipeByCategory(proteinRecipes, weeklyRecipes, 'Prato Principal 1');
        const selectedPP2 = selectRecipeByCategory(proteinRecipes, weeklyRecipes, 'Prato Principal 2', undefined, selectedPP1);
        const selectedGarnish = selectRecipeByCategory(garnishRecipes, weeklyRecipes, 'Guarnição');

        // Select salads with variety logic
        const selectedSalad1 = selectRecipeByCategory(saladRecipes, weeklyRecipes, 'Salada 1');
        const selectedSalad2 = selectRecipeByCategory(saladRecipes, weeklyRecipes, 'Salada 2');

        // Select juices from recipes or use defaults
        const selectedSuco1 = selectRecipeByCategory(sucoRecipes, weeklyRecipes, 'Suco 1', 
          { id: 3001, nome: 'Suco Natural Laranja', categoria: 'Suco 1', cost: 0.05 });
        const selectedSuco2 = selectRecipeByCategory(sucoRecipes, weeklyRecipes, 'Suco 2',
          { id: 3002, nome: 'Suco Natural Limão', categoria: 'Suco 2', cost: 0.06 });

        // Select dessert
        const selectedSobremesa = selectRecipeByCategory(sobremesaRecipes, [], 'Sobremesa');

        // Select arroz and feijao from recipes or use defaults
        const arroz = selectRecipeByCategory(arrozRecipes, [], 'Arroz',
          { id: 580, nome: 'Arroz Branco', categoria: 'Arroz', cost: 0.64 });
        const feijao = selectRecipeByCategory(feijaoRecipes, [], 'Feijão',
          { id: 1600, nome: 'Feijão', categoria: 'Feijão', cost: 0.12 });

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

  // Generic function to select recipes by categoria_descricao
  const selectRecipeByCategory = (availableRecipes: any[], usedRecipes: any[], targetCategory: string, fallback?: any, avoidSameProteinAs?: any) => {
    // Filter recipes by categoria_descricao directly
    let categoryRecipes = availableRecipes.filter(r => r.categoria_descricao === targetCategory);
    
    // If this is PP2 and we have PP1, avoid same protein type
    if (avoidSameProteinAs && targetCategory === 'Prato Principal 2') {
      const pp1ProteinType = classifyProtein(avoidSameProteinAs.nome).type;
      
      categoryRecipes = categoryRecipes.filter(recipe => {
        const recipeProteinType = classifyProtein(recipe.nome_receita).type;
        return recipeProteinType !== pp1ProteinType;
      });
    }
    
    if (categoryRecipes.length === 0) {
      return fallback || null;
    }

    // Prefer recipes that haven't been used this week
    const unused = categoryRecipes.filter(r => !usedRecipes.some(u => u.id === r.receita_id_legado));
    const pool = unused.length > 0 ? unused : categoryRecipes;
    
    const selected = pool[Math.floor(Math.random() * pool.length)];
    
    if (!selected) return fallback || null;

    return {
      id: selected.receita_id_legado,
      nome: selected.nome_receita,
      categoria: selected.categoria_descricao,
      cost: estimateRecipeCost(selected, targetCategory)
    };
  };


  const estimateRecipeCost = (recipe: any, categoryName: string): number => {
    // Use recipe cost if available, otherwise estimate by category
    if (recipe.custo_total && recipe.custo_total > 0) {
      return recipe.custo_total;
    }

    // Base cost estimation by category name
    const baseCosts: { [key: string]: number } = {
      'Prato Principal 1': 1.20,
      'Prato Principal 2': 1.20,
      'Guarnição': 0.90,
      'Salada 1': 0.40,
      'Salada 2': 0.40,
      'Sobremesa': 0.10,
      'Suco 1': 0.05,
      'Suco 2': 0.06,
      'Arroz': 0.64,
      'Feijão': 0.12,
      'Base': 0.30
    };

    return baseCosts[categoryName] || 1.00;
  };

  const calculateBalanceReport = (days: EnhancedMenuDay[], weeklyRecipes: any[]) => {
    // Calculate variety based on unique recipes per category
    const proteinRecipes = new Set();
    const garnishRecipes = new Set();
    const saladRecipes = new Set();
    
    weeklyRecipes.forEach(r => {
      if (r.categoria?.includes('Prato Principal')) {
        proteinRecipes.add(r.nome);
      } else if (r.categoria === 'Guarnição') {
        garnishRecipes.add(r.nome);
      } else if (r.categoria?.includes('Salada')) {
        saladRecipes.add(r.nome);
      }
    });

    // Budget compliance
    const daysWithinBudget = days.filter(d => d.withinBudget).length;
    const budgetCompliance = (daysWithinBudget / days.length) * 10;

    return {
      proteinVariety: Math.min(10, proteinRecipes.size * 2), // Max 5 recipes = 10 points
      garnishVariety: Math.min(10, garnishRecipes.size * 2.5), // Max 4 recipes = 10 points
      saladVariety: Math.min(10, saladRecipes.size * 3.33), // Max 3 recipes = 10 points
      budgetCompliance: Math.round(budgetCompliance),
      nutritionScore: 7 // Placeholder for nutrition scoring
    };
  };

  return {
    isGenerating,
    generatedMenu,
    error,
    generateEnhancedMenu,
    clearGeneratedMenu: () => setGeneratedMenu(null),
    clearError: () => setError(null)
  };
};