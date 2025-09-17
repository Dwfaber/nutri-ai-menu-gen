/**
 * Hook para categorização inteligente de receitas baseado nas tabelas especializadas
 * Melhora assertividade das sugestões conectando receitas com dados disponíveis
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProteinMapping {
  receita_id: string;
  nome: string;
  tipo: 'carne_bovina' | 'carne_suina' | 'frango' | 'peixe' | 'vegetariana' | 'outras';
  subcategoria: string;
  isRedMeat: boolean;
  prioridade: number;
}

export interface GarnishMapping {
  receita_id: string;
  nome: string;
  tipo: 'batatas' | 'cereais' | 'massas' | 'legumes' | 'raizes';
  prioridade: number;
}

export interface SaladMapping {
  receita_id: string;
  nome: string;
  tipo: 'verduras_folhas' | 'legumes' | 'mista';
  prioridade: number;
}

export interface JuiceMapping {
  produto_base_id: number;
  nome: string;
  tipo: 'pro_mix' | 'vita_suco' | 'diet' | 'natural';
  ativo: boolean;
}

export interface RecipeSuggestionScore {
  receita_id: string;
  nome: string;
  categoria: string;
  score: number;
  factors: {
    variety: number;    // Variedade na semana (0-10)
    cost: number;       // Adequação ao orçamento (0-10)
    season: number;     // Sazonalidade (0-10)
    preparation: number; // Facilidade de preparo (0-10)
    nutrition: number;   // Valor nutricional (0-10)
    business_rules: number; // Conformidade regras negócio (0-10)
  };
}

export const useIntelligentCategorization = () => {
  const [proteinMappings, setProteinMappings] = useState<ProteinMapping[]>([]);
  const [garnishMappings, setGarnishMappings] = useState<GarnishMapping[]>([]);
  const [saladMappings, setSaladMappings] = useState<SaladMapping[]>([]);
  const [juiceMappings, setJuiceMappings] = useState<JuiceMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mapear receitas de proteína com dados especializados
  const mapProteinRecipes = async () => {
    const { data: receitas } = await supabase
      .from('receitas_legado')
      .select('receita_id_legado, nome_receita')
      .in('categoria_descricao', ['Prato Principal 1', 'Prato Principal 2'])
      .eq('inativa', false);

    const { data: proteinasEspecializadas } = await supabase
      .from('proteinas_disponiveis')
      .select('*')
      .eq('ativo', true);

    if (!receitas || !proteinasEspecializadas) return [];

    const mappings: ProteinMapping[] = receitas.map(receita => {
      const nome = receita.nome_receita.toLowerCase();
      
      // Classificação inteligente baseada em palavras-chave expandidas
      let tipo: ProteinMapping['tipo'] = 'outras';
      let subcategoria = '';
      let isRedMeat = false;
      let prioridade = 1;

      // Buscar correspondência nas proteínas especializadas
      const proteinaEspecializada = proteinasEspecializadas.find(p => 
        nome.includes(p.nome.toLowerCase()) || 
        p.nome.toLowerCase().includes(nome.split(' ')[0])
      );

      if (proteinaEspecializada) {
        tipo = proteinaEspecializada.tipo as ProteinMapping['tipo'];
        subcategoria = proteinaEspecializada.subcategoria || '';
        prioridade = proteinaEspecializada.prioridade || 1;
        isRedMeat = ['carne_bovina', 'carne_suina'].includes(tipo);
      } else {
        // Classificação por palavras-chave se não encontrar correspondência
        if (nome.includes('frango') || nome.includes('galinha') || nome.includes('ave')) {
          tipo = 'frango';
          subcategoria = 'aves';
        } else if (nome.includes('boi') || nome.includes('carne') || nome.includes('bife') || nome.includes('acém')) {
          tipo = 'carne_bovina';
          subcategoria = 'bovinos';
          isRedMeat = true;
        } else if (nome.includes('porco') || nome.includes('suín') || nome.includes('lombo')) {
          tipo = 'carne_suina';
          subcategoria = 'suínos';
          isRedMeat = true;
        } else if (nome.includes('peixe') || nome.includes('tilápia') || nome.includes('salmão')) {
          tipo = 'peixe';
          subcategoria = 'peixes';
        } else if (nome.includes('soja') || nome.includes('vegetal') || nome.includes('grão')) {
          tipo = 'vegetariana';
          subcategoria = 'vegetais';
        }
      }

      return {
        receita_id: receita.receita_id_legado,
        nome: receita.nome_receita,
        tipo,
        subcategoria,
        isRedMeat,
        prioridade: prioridade || 1
      };
    });

    setProteinMappings(mappings);
    return mappings;
  };

  // Mapear receitas de guarnição
  const mapGarnishRecipes = async () => {
    const { data: receitas } = await supabase
      .from('receitas_legado')
      .select('receita_id_legado, nome_receita')
      .eq('categoria_descricao', 'Guarnição')
      .eq('inativa', false);

    const { data: guarnicoesEspecializadas } = await supabase
      .from('guarnicoes_disponiveis')
      .select('*')
      .eq('ativo', true);

    if (!receitas || !guarnicoesEspecializadas) return [];

    const mappings: GarnishMapping[] = receitas.map(receita => {
      const nome = receita.nome_receita.toLowerCase();
      let tipo: GarnishMapping['tipo'] = 'legumes';
      let prioridade = 1;

      const guarnicaoEspecializada = guarnicoesEspecializadas.find(g => 
        nome.includes(g.nome.toLowerCase()) || 
        g.nome.toLowerCase().includes(nome.split(' ')[0])
      );

      if (guarnicaoEspecializada) {
        tipo = guarnicaoEspecializada.tipo as GarnishMapping['tipo'];
        prioridade = guarnicaoEspecializada.prioridade || 1;
      } else {
        // Classificação por palavras-chave
        if (nome.includes('batata') || nome.includes('purê')) {
          tipo = 'batatas';
        } else if (nome.includes('arroz') || nome.includes('quinoa') || nome.includes('aveia')) {
          tipo = 'cereais';
        } else if (nome.includes('macarrão') || nome.includes('massa') || nome.includes('lasanha')) {
          tipo = 'massas';
        } else if (nome.includes('mandioca') || nome.includes('inhame') || nome.includes('mandioquinha')) {
          tipo = 'raizes';
        }
      }

      return {
        receita_id: receita.receita_id_legado,
        nome: receita.nome_receita,
        tipo,
        prioridade: prioridade || 1
      };
    });

    setGarnishMappings(mappings);
    return mappings;
  };

  // Mapear receitas de salada
  const mapSaladRecipes = async () => {
    const { data: receitas } = await supabase
      .from('receitas_legado')
      .select('receita_id_legado, nome_receita')
      .eq('categoria_descricao', 'Salada')
      .eq('inativa', false);

    const { data: saladasEspecializadas } = await supabase
      .from('saladas_disponiveis')
      .select('*')
      .eq('ativo', true);

    if (!receitas || !saladasEspecializadas) return [];

    const mappings: SaladMapping[] = receitas.map(receita => {
      const nome = receita.nome_receita.toLowerCase();
      let tipo: SaladMapping['tipo'] = 'mista';
      let prioridade = 1;

      const saladaEspecializada = saladasEspecializadas.find(s => 
        nome.includes(s.nome.toLowerCase()) || 
        s.nome.toLowerCase().includes(nome.split(' ')[0])
      );

      if (saladaEspecializada) {
        tipo = saladaEspecializada.tipo as SaladMapping['tipo'];
        prioridade = saladaEspecializada.prioridade || 1;
      } else {
        // Lógica de classificação inteligente
        const verdurasFolhas = ['alface', 'rúcula', 'agrião', 'espinafre', 'couve', 'acelga'];
        const legumes = ['tomate', 'cenoura', 'beterraba', 'abobrinha', 'pepino', 'pimentão'];
        
        const hasVerduras = verdurasFolhas.some(v => nome.includes(v));
        const hasLegumes = legumes.some(l => nome.includes(l));
        
        if (hasVerduras && hasLegumes) {
          tipo = 'mista';
        } else if (hasVerduras) {
          tipo = 'verduras_folhas';
        } else if (hasLegumes) {
          tipo = 'legumes';
        }
      }

      return {
        receita_id: receita.receita_id_legado,
        nome: receita.nome_receita,
        tipo,
        prioridade: prioridade || 1
      };
    });

    setSaladMappings(mappings);
    return mappings;
  };

  // Carregar sucos disponíveis
  const loadJuiceMappings = async () => {
    const { data: sucos } = await supabase
      .from('sucos_disponiveis')
      .select('*')
      .eq('ativo', true);

    if (sucos) {
      const mappedJuices: JuiceMapping[] = sucos.map(suco => ({
        produto_base_id: suco.produto_base_id,
        nome: suco.nome,
        tipo: suco.tipo as 'pro_mix' | 'vita_suco' | 'diet' | 'natural',
        ativo: suco.ativo ?? true
      }));
      setJuiceMappings(mappedJuices);
      return mappedJuices;
    }
    return [];
  };

  // Algoritmo de sugestão inteligente com pontuação
  const generateRecipeSuggestions = (
    weeklyRecipes: any[],
    targetCategory: string,
    budgetPerMeal: number,
    dayIndex: number,
    weekDay: string
  ): RecipeSuggestionScore[] => {
    let relevantMappings: any[] = [];
    
    // Selecionar pool baseado na categoria
    switch (targetCategory) {
      case 'Prato Principal 1':
      case 'Prato Principal 2':
        relevantMappings = proteinMappings.filter(p => p.tipo !== 'outras');
        break;
      case 'Guarnição':
        relevantMappings = garnishMappings;
        break;
      case 'Salada':
        relevantMappings = saladMappings;
        break;
      default:
        return [];
    }

    // Calcular pontuação para cada receita
    const suggestions: RecipeSuggestionScore[] = relevantMappings.map(recipe => {
      const factors = {
        variety: calculateVarietyScore(recipe, weeklyRecipes, targetCategory),
        cost: calculateCostScore(recipe, budgetPerMeal),
        season: calculateSeasonScore(recipe),
        preparation: calculatePreparationScore(recipe, weekDay, dayIndex),
        nutrition: calculateNutritionScore(recipe),
        business_rules: calculateBusinessRulesScore(recipe, weeklyRecipes, dayIndex)
      };

      const score = Object.values(factors).reduce((sum, score) => sum + score, 0) / 6;

      return {
        receita_id: recipe.receita_id,
        nome: recipe.nome,
        categoria: targetCategory,
        score: Math.round(score * 100) / 100,
        factors
      };
    });

    // Ordenar por pontuação decrescente
    return suggestions.sort((a, b) => b.score - a.score);
  };

  // Funções de cálculo de pontuação
  const calculateVarietyScore = (recipe: any, weeklyRecipes: any[], category: string): number => {
    // Penalizar se mesmo tipo já foi usado
    const usedTypes = weeklyRecipes
      .filter(r => r.categoria === category)
      .map(r => r.tipo || '');

    if (recipe.tipo && usedTypes.includes(recipe.tipo)) {
      return 3; // Penalizar repetição
    }
    return 8; // Bonus por variedade
  };

  const calculateCostScore = (recipe: any, budgetPerMeal: number): number => {
    // Assumir custo base por categoria (será refinado com dados reais)
    const estimatedCost = recipe.tipo === 'carne_bovina' ? 2.5 : 
                         recipe.tipo === 'frango' ? 2.0 : 
                         recipe.tipo === 'peixe' ? 3.0 : 1.5;
    
    const ratio = estimatedCost / budgetPerMeal;
    if (ratio <= 0.3) return 9; // Excelente custo-benefício
    if (ratio <= 0.5) return 7; // Bom custo-benefício
    if (ratio <= 0.8) return 5; // Adequado
    return 2; // Caro
  };

  const calculateSeasonScore = (recipe: any): number => {
    // Lógica de sazonalidade básica (a ser expandida)
    const currentMonth = new Date().getMonth() + 1;
    
    // Exemplo: preferir peixes no verão, carnes mais pesadas no inverno
    if (recipe.tipo === 'peixe' && [12, 1, 2, 3].includes(currentMonth)) return 8;
    if (recipe.tipo === 'carne_bovina' && [6, 7, 8].includes(currentMonth)) return 6;
    
    return 7; // Score neutro
  };

  const calculatePreparationScore = (recipe: any, weekDay: string, dayIndex: number): number => {
    // Segunda-feira: preferir receitas simples
    if (weekDay === 'Segunda-feira') {
      const simple = ['frango', 'ovo', 'vegetariana'].includes(recipe.tipo);
      return simple ? 9 : 4;
    }
    
    // Sexta-feira: permitir receitas mais elaboradas
    if (weekDay === 'Sexta-feira') {
      const elaborate = ['peixe', 'carne_bovina'].includes(recipe.tipo);
      return elaborate ? 8 : 6;
    }
    
    return 7; // Score neutro
  };

  const calculateNutritionScore = (recipe: any): number => {
    // Pontuação nutricional básica por tipo
    const nutritionScores = {
      'peixe': 9,       // Ômega 3, proteína magra
      'frango': 8,      // Proteína magra
      'vegetariana': 7, // Fibras, vitaminas
      'carne_bovina': 6, // Ferro, mas mais gordura
      'carne_suina': 5   // Mais gordura saturada
    };
    
    return nutritionScores[recipe.tipo as keyof typeof nutritionScores] || 6;
  };

  const calculateBusinessRulesScore = (recipe: any, weeklyRecipes: any[], dayIndex: number): number => {
    let score = 8;
    
    // Penalizar se violaria regra de carnes vermelhas consecutivas
    if (recipe.isRedMeat && dayIndex > 0) {
      const previousDay = weeklyRecipes.filter(r => r.dayIndex === dayIndex - 1);
      const hasRedMeatYesterday = previousDay.some(r => 
        proteinMappings.find(p => p.receita_id === r.receita_id)?.isRedMeat
      );
      if (hasRedMeatYesterday) score -= 4;
    }
    
    // Bonus por conformidade com prioridades
    score += (recipe.prioridade || 1) * 0.5;
    
    return Math.max(1, Math.min(10, score));
  };

  // Inicializar todos os mapeamentos
  useEffect(() => {
    const initializeMappings = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          mapProteinRecipes(),
          mapGarnishRecipes(),
          mapSaladRecipes(),
          loadJuiceMappings()
        ]);
      } catch (error) {
        console.error('Erro ao inicializar mapeamentos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeMappings();
  }, []);

  return {
    proteinMappings,
    garnishMappings,
    saladMappings,
    juiceMappings,
    isLoading,
    generateRecipeSuggestions,
    mapProteinRecipes,
    mapGarnishRecipes,
    mapSaladRecipes,
    loadJuiceMappings
  };
};