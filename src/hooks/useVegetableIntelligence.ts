import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  categorizeVegetable, 
  suggestBalancedCombination,
  optimizeBySeasonAndPrice,
  generateWeeklyRotation,
  type VegetableInfo 
} from '@/utils/vegetablesCategorization';

export interface VegetableAnalysis {
  totalVegetables: number;
  byCategory: Record<string, number>;
  byPriceRange: Record<string, number>;
  seasonal: VegetableInfo[];
  outOfSeason: VegetableInfo[];
  nutritionalCoverage: string[];
}

export interface VegetableRecommendation {
  recommended: VegetableInfo[];
  alternatives: VegetableInfo[];
  weeklyRotation: Record<string, VegetableInfo[]>;
  costOptimized: VegetableInfo[];
  reasoning: string;
}

export const useVegetableIntelligence = () => {
  const [marketVegetables, setMarketVegetables] = useState<VegetableInfo[]>([]);
  const [analysis, setAnalysis] = useState<VegetableAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar e categorizar produtos do mercado
  useEffect(() => {
    const loadMarketVegetables = async () => {
      try {
        setIsLoading(true);
        
        const { data: products, error: dbError } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('produto_id, descricao, preco, unidade, grupo, categoria_descricao')
          .not('descricao', 'is', null)
          .order('descricao');

        if (dbError) throw dbError;

        // Filtrar e categorizar apenas verduras/legumes
        const vegetables: VegetableInfo[] = [];
        
        for (const product of products || []) {
          const categorized = categorizeVegetable(product.descricao);
          if (categorized) {
            vegetables.push({
              ...categorized,
              id: product.produto_id,
              name: product.descricao,
              // Determinar categoria de preço baseada no valor
              priceCategory: product.preco <= 300 ? 'budget' : 
                           product.preco <= 800 ? 'medium' : 'premium'
            });
          }
        }

        setMarketVegetables(vegetables);
        
        // Gerar análise
        generateAnalysis(vegetables);
        
      } catch (err) {
        console.error('Erro ao carregar verduras do mercado:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    };

    loadMarketVegetables();
  }, []);

  // Gerar análise completa
  const generateAnalysis = (vegetables: VegetableInfo[]) => {
    const currentMonth = new Date().toLocaleString('pt-BR', { month: 'short' });
    
    const byCategory: Record<string, number> = {};
    const byPriceRange: Record<string, number> = {};
    const nutritionalCoverage = new Set<string>();
    
    vegetables.forEach(veg => {
      // Contar por categoria
      byCategory[veg.category] = (byCategory[veg.category] || 0) + 1;
      
      // Contar por faixa de preço  
      byPriceRange[veg.priceCategory] = (byPriceRange[veg.priceCategory] || 0) + 1;
      
      // Coletar nutrientes
      veg.nutritionalValue.vitamins.forEach(v => nutritionalCoverage.add(v));
      veg.nutritionalValue.minerals.forEach(m => nutritionalCoverage.add(m));
    });

    const seasonal = vegetables.filter(v => 
      v.seasonality.peak.includes(currentMonth)
    );
    
    const outOfSeason = vegetables.filter(v => 
      !v.seasonality.available.includes(currentMonth)
    );

    setAnalysis({
      totalVegetables: vegetables.length,
      byCategory,
      byPriceRange,
      seasonal,
      outOfSeason,
      nutritionalCoverage: Array.from(nutritionalCoverage)
    });
  };

  // Gerar recomendações inteligentes
  const generateRecommendations = (
    targetNutrients: string[] = ['A', 'C', 'Ferro', 'Folato'],
    budget: 'low' | 'medium' | 'high' = 'medium',
    usedThisWeek: string[] = []
  ): VegetableRecommendation => {
    const currentMonth = new Date().toLocaleString('pt-BR', { month: 'short' });
    
    // Otimizar por sazonalidade e preço
    const optimized = optimizeBySeasonAndPrice(marketVegetables, currentMonth, budget);
    
    // Sugerir combinação balanceada
    const recommended = suggestBalancedCombination(optimized, targetNutrients);
    
    // Alternativas (próximas melhores opções)
    const alternatives = optimized
      .filter(v => !recommended.includes(v))
      .slice(0, 6);
    
    // Rotatividade semanal
    const weeklyRotation = generateWeeklyRotation(marketVegetables, usedThisWeek);
    
    // Apenas os mais baratos da época
    const costOptimized = optimized
      .filter(v => v.priceCategory === 'budget' && v.seasonality.peak.includes(currentMonth))
      .slice(0, 8);

    // Gerar justificativa
    const reasoning = generateRecommendationReasoning(recommended, currentMonth, budget);

    return {
      recommended,
      alternatives,
      weeklyRotation,
      costOptimized,
      reasoning
    };
  };

  // Gerar justificativa das recomendações
  const generateRecommendationReasoning = (
    recommended: VegetableInfo[],
    currentMonth: string,
    budget: 'low' | 'medium' | 'high'
  ): string => {
    const reasons: string[] = [];
    
    const seasonalCount = recommended.filter(v => v.seasonality.peak.includes(currentMonth)).length;
    if (seasonalCount > 0) {
      reasons.push(`${seasonalCount} produto(s) da época (${currentMonth})`);
    }
    
    const budgetCount = recommended.filter(v => v.priceCategory === 'budget').length;
    if (budgetCount > 0) {
      reasons.push(`${budgetCount} opção(ões) econômica(s)`);
    }
    
    const categories = new Set(recommended.map(v => v.category));
    if (categories.size > 1) {
      reasons.push(`variedade nutricional (${categories.size} categorias)`);
    }
    
    const highAntioxidants = recommended.filter(v => v.nutritionalValue.antioxidants === 'high').length;
    if (highAntioxidants > 0) {
      reasons.push(`${highAntioxidants} rico(s) em antioxidantes`);
    }

    return `Seleção baseada em: ${reasons.join(', ')}.`;
  };

  // Buscar produtos por categoria
  const getVegetablesByCategory = (category: string) => {
    return marketVegetables.filter(v => 
      v.category === category || v.subCategory === category
    );
  };

  // Verificar disponibilidade sazonal
  const checkSeasonality = (vegetableName: string): 'peak' | 'available' | 'out_of_season' => {
    const currentMonth = new Date().toLocaleString('pt-BR', { month: 'short' });
    const vegetable = marketVegetables.find(v => v.name === vegetableName);
    
    if (!vegetable) return 'out_of_season';
    
    if (vegetable.seasonality.peak.includes(currentMonth)) return 'peak';
    if (vegetable.seasonality.available.includes(currentMonth)) return 'available';
    return 'out_of_season';
  };

  // Sugerir substituições
  const suggestSubstitutions = (originalVegetable: string): VegetableInfo[] => {
    const original = marketVegetables.find(v => v.name === originalVegetable);
    if (!original) return [];
    
    return marketVegetables
      .filter(v => 
        v.name !== originalVegetable &&
        (v.category === original.category || v.subCategory === original.subCategory)
      )
      .sort((a, b) => {
        // Priorizar produtos da época e baratos
        const currentMonth = new Date().toLocaleString('pt-BR', { month: 'short' });
        const aScore = (a.seasonality.peak.includes(currentMonth) ? 2 : 0) + 
                      (a.priceCategory === 'budget' ? 1 : 0);
        const bScore = (b.seasonality.peak.includes(currentMonth) ? 2 : 0) + 
                      (b.priceCategory === 'budget' ? 1 : 0);
        return bScore - aScore;
      })
      .slice(0, 3);
  };

  return {
    marketVegetables,
    analysis,
    isLoading,
    error,
    generateRecommendations,
    getVegetablesByCategory,
    checkSeasonality,
    suggestSubstitutions
  };
};