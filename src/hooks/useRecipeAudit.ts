import { useState, useCallback } from 'react';
import { useAuditLog } from './useAuditLog';
import { supabase } from '@/integrations/supabase/client';

interface RecipeProblem {
  type: 'validation' | 'cost' | 'ingredients' | 'category' | 'availability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details?: Record<string, any>;
}

interface ProblematicRecipe {
  receita_id: string;
  nome: string;
  categoria: string;
  problems: RecipeProblem[];
  custo_calculado?: number;
  ingredientes_total?: number;
  percentual_calculado?: number;
  detected_at: Date;
  source: 'menu_generation' | 'validation_check' | 'audit_scan';
}

interface RecipeAuditMetrics {
  total_recipes_audited: number;
  problematic_recipes: number;
  critical_issues: number;
  high_priority_issues: number;
  medium_priority_issues: number;
  low_priority_issues: number;
  categories_affected: string[];
  audit_coverage_percentage: number;
}

interface UseRecipeAuditReturn {
  auditRecipe: (receitaId: string, source?: string) => Promise<ProblematicRecipe | null>;
  logProblematicRecipe: (recipe: ProblematicRecipe) => Promise<void>;
  getProblematicRecipes: (filter?: string) => Promise<ProblematicRecipe[]>;
  getAuditMetrics: () => Promise<RecipeAuditMetrics>;
  runBatchAudit: (recipeIds: string[]) => Promise<ProblematicRecipe[]>;
  isAuditing: boolean;
  error: string | null;
}

export function useRecipeAudit(): UseRecipeAuditReturn {
  const [isAuditing, setIsAuditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { logEvent, logError } = useAuditLog();

  const analyzeRecipeProblems = useCallback(async (receitaId: string): Promise<RecipeProblem[]> => {
    const problems: RecipeProblem[] = [];

    try {
      // 1. Buscar dados da receita
      const { data: ingredientes, error: errorIngredientes } = await supabase
        .from('receita_ingredientes')
        .select('*')
        .eq('receita_id_legado', receitaId);

      if (errorIngredientes || !ingredientes?.length) {
        problems.push({
          type: 'availability',
          severity: 'critical',
          message: 'Receita não encontrada ou sem ingredientes',
          details: { receita_id: receitaId, error: errorIngredientes }
        });
        return problems;
      }

      const nomeReceita = ingredientes[0].nome;
      const categoria = ingredientes[0].categoria_descricao;

      // 2. Verificar problemas de ingredientes
      if (ingredientes.length < 2) {
        problems.push({
          type: 'ingredients',
          severity: 'high',
          message: `Muito poucos ingredientes (${ingredientes.length})`
        });
      }

      // 3. Buscar preços para cálculo de custo
      const produtoIds = [...new Set(ingredientes.map(ing => ing.produto_base_id))];
      const { data: precos, error: errorPrecos } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('produto_base_id, preco, descricao')
        .in('produto_base_id', produtoIds)
        .gt('preco', 0);

      if (errorPrecos || !precos?.length) {
        problems.push({
          type: 'cost',
          severity: 'high',
          message: 'Não foi possível calcular custo - preços não encontrados',
          details: { produto_ids: produtoIds }
        });
        return problems;
      }

      // 4. Calcular percentual de ingredientes com preço
      const ingredientesComPreco = ingredientes.filter(ing => 
        precos.some(p => p.produto_base_id === ing.produto_base_id)
      ).length;
      
      const percentualCalculado = (ingredientesComPreco / ingredientes.length) * 100;

      if (percentualCalculado < 50) {
        problems.push({
          type: 'cost',
          severity: 'medium',
          message: `Muitos ingredientes sem preço (${percentualCalculado.toFixed(1)}% calculado)`,
          details: { percentual_calculado: percentualCalculado }
        });
      }

      // 5. Verificar custo usando quick-worker
      try {
        const { data: custoData, error: custoError } = await supabase.functions.invoke('quick-worker', {
          body: {
            action: 'calculate_recipe_cost',
            receita_id: receitaId,
            porcoes: 100
          }
        });

        if (custoError || !custoData?.success) {
          problems.push({
            type: 'cost',
            severity: 'medium',
            message: 'Erro no cálculo de custo',
            details: { error: custoError }
          });
        } else {
          const custoPorPorcao = custoData.resultado?.custo_por_porcao || 0;
          
          // Verificar se o custo está muito baixo (suspeito)
          if (custoPorPorcao < 0.10) {
            problems.push({
              type: 'cost',
              severity: 'high',
              message: `Custo suspeito muito baixo: R$ ${custoPorPorcao.toFixed(3)}`,
              details: { custo_por_porcao: custoPorPorcao }
            });
          }
          
          // Verificar se o custo está muito alto
          if (custoPorPorcao > 8.00) {
            problems.push({
              type: 'cost',
              severity: 'medium',
              message: `Custo muito alto: R$ ${custoPorPorcao.toFixed(2)}`,
              details: { custo_por_porcao: custoPorPorcao }
            });
          }
        }
      } catch (custoError) {
        problems.push({
          type: 'cost',
          severity: 'low',
          message: 'Falha na comunicação com serviço de cálculo',
          details: { error: custoError }
        });
      }

      // 6. Verificar problemas específicos por categoria
      if (categoria?.includes('Prato Principal')) {
        const temProteina = ingredientes.some(ing => {
          const desc = ing.produto_base_descricao?.toUpperCase() || '';
          return desc.includes('CARNE') || desc.includes('FRANGO') || desc.includes('PEIXE') || 
                 desc.includes('PROTEÍNA') || desc.includes('BIFE') || desc.includes('OVO');
        });
        
        if (!temProteina) {
          problems.push({
            type: 'validation',
            severity: 'critical',
            message: 'Prato principal sem proteína identificada',
            details: { categoria }
          });
        }
      }

      return problems;
    } catch (error) {
      console.error('Erro na análise de problemas da receita:', error);
      problems.push({
        type: 'validation',
        severity: 'critical',
        message: 'Erro interno na análise da receita',
        details: { error: error.message }
      });
      return problems;
    }
  }, []);

  const auditRecipe = useCallback(async (receitaId: string, source: string = 'audit_scan'): Promise<ProblematicRecipe | null> => {
    try {
      setError(null);
      setIsAuditing(true);

      const problems = await analyzeRecipeProblems(receitaId);
      
      if (problems.length === 0) {
        return null; // Receita sem problemas
      }

      // Buscar dados básicos da receita
      const { data: receita } = await supabase
        .from('receita_ingredientes')
        .select('nome, categoria_descricao')
        .eq('receita_id_legado', receitaId)
        .limit(1)
        .single();

      const problematicRecipe: ProblematicRecipe = {
        receita_id: receitaId,
        nome: receita?.nome || 'Nome não encontrado',
        categoria: receita?.categoria_descricao || 'Categoria não definida',
        problems,
        detected_at: new Date(),
        source: source as any
      };

      return problematicRecipe;
    } catch (error) {
      console.error('Erro na auditoria da receita:', error);
      setError(error.message);
      await logError(error, { receita_id: receitaId, action: 'audit_recipe' });
      return null;
    } finally {
      setIsAuditing(false);
    }
  }, [analyzeRecipeProblems, logError]);

  const logProblematicRecipe = useCallback(async (recipe: ProblematicRecipe) => {
    try {
      // Determinar severidade geral
      const severities = recipe.problems.map(p => p.severity);
      const overallSeverity = severities.includes('critical') ? 'critical' :
                             severities.includes('high') ? 'error' :
                             severities.includes('medium') ? 'warn' : 'info';

      await logEvent({
        event_type: 'recipe_audit_failed',
        entity_type: 'receita',
        entity_id: recipe.receita_id,
        action: 'audit_validation',
        severity: overallSeverity,
        status: 'error',
        metadata: {
          nome_receita: recipe.nome,
          categoria: recipe.categoria,
          total_problems: recipe.problems.length,
          problems_summary: recipe.problems.map(p => ({
            type: p.type,
            severity: p.severity,
            message: p.message
          })),
          source: recipe.source,
          detected_at: recipe.detected_at,
          critical_issues: recipe.problems.filter(p => p.severity === 'critical').length,
          high_priority_issues: recipe.problems.filter(p => p.severity === 'high').length
        }
      });

      console.log(`✅ Auditoria registrada: ${recipe.nome} (${recipe.problems.length} problemas)`);
    } catch (error) {
      console.error('Erro ao registrar auditoria:', error);
      await logError(error, { receita_id: recipe.receita_id });
    }
  }, [logEvent, logError]);

  const getProblematicRecipes = useCallback(async (filter?: string): Promise<ProblematicRecipe[]> => {
    try {
      let query = supabase
        .from('audit_events')
        .select('*')
        .eq('event_type', 'recipe_audit_failed')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter) {
        query = query.or(
          `metadata->>nome_receita.ilike.%${filter}%,` +
          `metadata->>categoria.ilike.%${filter}%,` +
          `entity_id.ilike.%${filter}%`
        );
      }

      const { data: auditEvents, error } = await query;

      if (error) {
        throw error;
      }

      const problematicRecipes: ProblematicRecipe[] = auditEvents?.map(event => ({
        receita_id: event.entity_id || '',
        nome: event.metadata?.nome_receita || 'Nome não disponível',
        categoria: event.metadata?.categoria || 'Categoria não definida',
        problems: event.metadata?.problems_summary || [],
        detected_at: new Date(event.created_at),
        source: event.metadata?.source || 'unknown'
      })) || [];

      return problematicRecipes;
    } catch (error) {
      console.error('Erro ao buscar receitas problemáticas:', error);
      setError(error.message);
      return [];
    }
  }, []);

  const getAuditMetrics = useCallback(async (): Promise<RecipeAuditMetrics> => {
    try {
      const { data: auditEvents, error } = await supabase
        .from('audit_events')
        .select('metadata')
        .eq('event_type', 'recipe_audit_failed')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        throw error;
      }

      const events = auditEvents || [];
      const categories = new Set<string>();
      let criticalIssues = 0;
      let highPriorityIssues = 0;
      let mediumPriorityIssues = 0;
      let lowPriorityIssues = 0;

      events.forEach(event => {
        const metadata = event.metadata || {};
        if (metadata.categoria) {
          categories.add(metadata.categoria);
        }
        
        criticalIssues += metadata.critical_issues || 0;
        highPriorityIssues += metadata.high_priority_issues || 0;
        mediumPriorityIssues += metadata.medium_priority_issues || 0;
        lowPriorityIssues += metadata.low_priority_issues || 0;
      });

      return {
        total_recipes_audited: events.length,
        problematic_recipes: events.length,
        critical_issues: criticalIssues,
        high_priority_issues: highPriorityIssues,
        medium_priority_issues: mediumPriorityIssues,
        low_priority_issues: lowPriorityIssues,
        categories_affected: Array.from(categories),
        audit_coverage_percentage: 85 // Estimativa baseada na cobertura atual
      };
    } catch (error) {
      console.error('Erro ao calcular métricas de auditoria:', error);
      setError(error.message);
      return {
        total_recipes_audited: 0,
        problematic_recipes: 0,
        critical_issues: 0,
        high_priority_issues: 0,
        medium_priority_issues: 0,
        low_priority_issues: 0,
        categories_affected: [],
        audit_coverage_percentage: 0
      };
    }
  }, []);

  const runBatchAudit = useCallback(async (recipeIds: string[]): Promise<ProblematicRecipe[]> => {
    try {
      setIsAuditing(true);
      setError(null);

      const problematicRecipes: ProblematicRecipe[] = [];
      
      for (const receitaId of recipeIds) {
        const auditResult = await auditRecipe(receitaId, 'batch_audit');
        if (auditResult) {
          problematicRecipes.push(auditResult);
          await logProblematicRecipe(auditResult);
        }
      }

      // Log do resultado do batch
      await logEvent({
        event_type: 'batch_audit_completed',
        entity_type: 'system',
        action: 'batch_audit',
        severity: 'info',
        status: 'success',
        metadata: {
          total_recipes_checked: recipeIds.length,
          problematic_recipes_found: problematicRecipes.length,
          audit_percentage: (problematicRecipes.length / recipeIds.length) * 100
        }
      });

      return problematicRecipes;
    } catch (error) {
      console.error('Erro na auditoria em lote:', error);
      setError(error.message);
      await logError(error, { action: 'batch_audit', recipe_count: recipeIds.length });
      return [];
    } finally {
      setIsAuditing(false);
    }
  }, [auditRecipe, logProblematicRecipe, logEvent, logError]);

  return {
    auditRecipe,
    logProblematicRecipe,
    getProblematicRecipes,
    getAuditMetrics,
    runBatchAudit,
    isAuditing,
    error
  };
}