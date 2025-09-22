import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Recipe {
  id: string;
  receita_id_legado: string;
  nome_receita: string;
  categoria_descricao: string | null;
  categoria_receita: string | null;
  custo_total: number | null;
  porcoes: number | null;
  tempo_preparo: number | null;
  inativa: boolean;
  modo_preparo: string | null;
  usuario: string | null;
  sync_at: string;
  created_at: string;
  ingredientes: any;
}

interface RecipeProblem {
  type: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  action: string;
  icon: string;
}

interface DetailedDiagnosis {
  recipe: Recipe;
  problems: RecipeProblem[];
  qualityScore: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  businessImpact: string;
  estimatedFixTime: string;
  canBeUsed: boolean;
}

interface DiagnosisMetrics {
  totalRecipes: number;
  averageQualityScore: number;
  criticalProblems: number;
  highProblems: number;
  mediumProblems: number;
  lowProblems: number;
  blockedRecipes: number;
  usableRecipes: number;
  problemsByCategory: Record<string, number>;
}

export const useDetailedRecipeDiagnosis = () => {
  const [diagnoses, setDiagnoses] = useState<DetailedDiagnosis[]>([]);
  const [metrics, setMetrics] = useState<DiagnosisMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const diagnoseProblem = (recipe: Recipe): RecipeProblem[] => {
    const problems: RecipeProblem[] = [];
    const ingredientesArray = Array.isArray(recipe.ingredientes) ? recipe.ingredientes : [];

    // 🔴 CRÍTICO: Sem ingredientes cadastrados
    if (ingredientesArray.length === 0) {
      problems.push({
        type: 'critical',
        category: 'Ingredientes',
        description: 'Nenhum ingrediente cadastrado - Receita não pode ser produzida',
        action: 'Cadastrar ingredientes imediatamente',
        icon: '🔴'
      });
    }

    // 🟠 ALTO: Sem custo calculado
    if (recipe.custo_total === null || recipe.custo_total === 0) {
      problems.push({
        type: 'high',
        category: 'Custo',
        description: `Custo ${recipe.custo_total === null ? 'não calculado' : 'zerado'} - Impossível precificar`,
        action: 'Recalcular custo baseado nos ingredientes',
        icon: '🟠'
      });
    }

    // 🔴 CRÍTICO: Receita inativa
    if (recipe.inativa) {
      problems.push({
        type: 'critical',
        category: 'Status',
        description: 'Receita marcada como inativa - Não disponível para produção',
        action: 'Revisar e reativar se necessário',
        icon: '🔴'
      });
    }

    // 🟡 MÉDIO: Sem categoria definida
    if (!recipe.categoria_descricao && !recipe.categoria_receita) {
      problems.push({
        type: 'medium',
        category: 'Categoria',
        description: 'Categoria não especificada - Dificulta organização',
        action: 'Definir categoria apropriada',
        icon: '🟡'
      });
    }

    // 🟡 MÉDIO: Sem porções definidas
    if (!recipe.porcoes || recipe.porcoes <= 0) {
      problems.push({
        type: 'medium',
        category: 'Porções',
        description: 'Número de porções não definido corretamente',
        action: 'Definir quantidade de porções',
        icon: '🟡'
      });
    }

    // 🟢 BAIXO: Sem modo de preparo
    if (!recipe.modo_preparo || recipe.modo_preparo.trim().length === 0) {
      problems.push({
        type: 'low',
        category: 'Preparo',
        description: 'Instruções de preparo ausentes',
        action: 'Adicionar modo de preparo detalhado',
        icon: '🟢'
      });
    }

    // 🟢 BAIXO: Tempo de preparo não definido
    if (!recipe.tempo_preparo || recipe.tempo_preparo <= 0) {
      problems.push({
        type: 'low',
        category: 'Tempo',
        description: 'Tempo de preparo não informado',
        action: 'Estimar e cadastrar tempo de preparo',
        icon: '🟢'
      });
    }

    // 🟠 ALTO: Custo muito alto (possível erro)
    if (recipe.custo_total && recipe.custo_total > 1000) {
      problems.push({
        type: 'high',
        category: 'Custo',
        description: `Custo muito alto (R$ ${recipe.custo_total.toFixed(2)}) - Possível erro`,
        action: 'Revisar cálculo de custo e ingredientes',
        icon: '🟠'
      });
    }

    return problems;
  };

  const calculateQualityScore = (problems: RecipeProblem[]): number => {
    let score = 100;
    
    problems.forEach(problem => {
      switch (problem.type) {
        case 'critical':
          score -= 30;
          break;
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    });

    return Math.max(0, score);
  };

  const getSeverity = (problems: RecipeProblem[]): 'critical' | 'high' | 'medium' | 'low' => {
    if (problems.some(p => p.type === 'critical')) return 'critical';
    if (problems.some(p => p.type === 'high')) return 'high';
    if (problems.some(p => p.type === 'medium')) return 'medium';
    return 'low';
  };

  const getBusinessImpact = (problems: RecipeProblem[], recipe: Recipe): string => {
    const criticalProblems = problems.filter(p => p.type === 'critical').length;
    const highProblems = problems.filter(p => p.type === 'high').length;

    if (criticalProblems > 0) {
      return 'BLOQUEADA - Não pode ser usada na produção';
    }
    if (highProblems > 0) {
      return 'LIMITADA - Pode ser usada mas sem controle de custo';
    }
    if (problems.length > 0) {
      return 'FUNCIONAL - Operacional mas com melhorias necessárias';
    }
    return 'PERFEITA - Pronta para produção sem restrições';
  };

  const getEstimatedFixTime = (problems: RecipeProblem[]): string => {
    const criticalProblems = problems.filter(p => p.type === 'critical').length;
    const highProblems = problems.filter(p => p.type === 'high').length;
    const mediumProblems = problems.filter(p => p.type === 'medium').length;

    const totalMinutes = criticalProblems * 30 + highProblems * 15 + mediumProblems * 5;
    
    if (totalMinutes >= 60) {
      return `~${Math.ceil(totalMinutes / 60)}h`;
    }
    return `~${totalMinutes}min`;
  };

  const canRecipeBeUsed = (problems: RecipeProblem[]): boolean => {
    return !problems.some(p => p.type === 'critical');
  };

  const fetchAndAnalyze = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar receitas e ingredientes
      const { data: recipesData, error: fetchError } = await supabase
        .from('receitas_legado')
        .select('*')
        .order('nome_receita');

      if (fetchError) {
        throw fetchError;
      }

      // Buscar ingredientes separadamente
      const { data: ingredientsData } = await supabase
        .from('receita_ingredientes')
        .select('receita_id_legado, produto_base_id, quantidade, unidade');

      // Agrupar ingredientes por receita
      const ingredientsByRecipe = (ingredientsData || []).reduce((acc, ingredient) => {
        if (!acc[ingredient.receita_id_legado]) {
          acc[ingredient.receita_id_legado] = [];
        }
        acc[ingredient.receita_id_legado].push(ingredient);
        return acc;
      }, {} as Record<string, any[]>);

      const detailedDiagnoses: DetailedDiagnosis[] = (recipesData || []).map(recipe => {
        // Usar ingredientes da tabela separada se disponível
        const recipeWithIngredients = {
          ...recipe,
          ingredientes: ingredientsByRecipe[recipe.receita_id_legado] || recipe.ingredientes || []
        };
        
        const problems = diagnoseProblem(recipeWithIngredients);
        const qualityScore = calculateQualityScore(problems);
        const severity = getSeverity(problems);
        const businessImpact = getBusinessImpact(problems, recipeWithIngredients);
        const estimatedFixTime = getEstimatedFixTime(problems);
        const canBeUsed = canRecipeBeUsed(problems);

        return {
          recipe: recipeWithIngredients,
          problems,
          qualityScore,
          severity,
          businessImpact,
          estimatedFixTime,
          canBeUsed
        };
      });

      setDiagnoses(detailedDiagnoses);

      // Calcular métricas agregadas
      const totalRecipes = detailedDiagnoses.length;
      const averageQualityScore = detailedDiagnoses.reduce((sum, d) => sum + d.qualityScore, 0) / totalRecipes;
      const criticalProblems = detailedDiagnoses.filter(d => d.severity === 'critical').length;
      const highProblems = detailedDiagnoses.filter(d => d.severity === 'high').length;
      const mediumProblems = detailedDiagnoses.filter(d => d.severity === 'medium').length;
      const lowProblems = detailedDiagnoses.filter(d => d.severity === 'low').length;
      const blockedRecipes = detailedDiagnoses.filter(d => !d.canBeUsed).length;
      const usableRecipes = detailedDiagnoses.filter(d => d.canBeUsed).length;

      const problemsByCategory: Record<string, number> = {};
      detailedDiagnoses.forEach(diagnosis => {
        diagnosis.problems.forEach(problem => {
          problemsByCategory[problem.category] = (problemsByCategory[problem.category] || 0) + 1;
        });
      });

      const calculatedMetrics: DiagnosisMetrics = {
        totalRecipes,
        averageQualityScore,
        criticalProblems,
        highProblems,
        mediumProblems,
        lowProblems,
        blockedRecipes,
        usableRecipes,
        problemsByCategory
      };

      setMetrics(calculatedMetrics);
    } catch (err) {
      console.error('Erro ao analisar receitas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndAnalyze();
  }, []);

  const getDiagnosesByFilter = (filter: string) => {
    switch (filter) {
      case 'critical':
        return diagnoses.filter(d => d.severity === 'critical');
      case 'high':
        return diagnoses.filter(d => d.severity === 'high');
      case 'medium':
        return diagnoses.filter(d => d.severity === 'medium');
      case 'low':
        return diagnoses.filter(d => d.severity === 'low');
      case 'blocked':
        return diagnoses.filter(d => !d.canBeUsed);
      case 'usable':
        return diagnoses.filter(d => d.canBeUsed);
      case 'no_ingredients':
        return diagnoses.filter(d => d.problems.some(p => p.category === 'Ingredientes'));
      case 'no_cost':
        return diagnoses.filter(d => d.problems.some(p => p.category === 'Custo'));
      case 'high_quality':
        return diagnoses.filter(d => d.qualityScore >= 80);
      case 'low_quality':
        return diagnoses.filter(d => d.qualityScore < 50);
      default:
        return diagnoses;
    }
  };

  const refetch = () => {
    setDiagnoses([]);
    setMetrics(null);
    setLoading(true);
    setError(null);
    
    // Trigger the useEffect to run again
    fetchAndAnalyze();
  };

  return {
    diagnoses,
    metrics,
    loading,
    error,
    getDiagnosesByFilter,
    diagnoseProblem,
    calculateQualityScore,
    refetch
  };
};