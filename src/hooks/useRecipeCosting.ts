import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RecipeStats {
  total_recipes: number;
  recipes_without_cost: number;
  recipes_with_cost: number;
  last_calculation: string | null;
}

export const useRecipeCosting = () => {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [stats, setStats] = useState<RecipeStats | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchRecipeStats = async () => {
    try {
      const { data, error } = await supabase
        .from('receitas_legado')
        .select('custo_total, sync_at')
        .eq('inativa', false);

      if (error) throw error;

      const totalRecipes = data.length;
      const recipesWithoutCost = data.filter(r => !r.custo_total || r.custo_total === 0).length;
      const recipesWithCost = totalRecipes - recipesWithoutCost;
      const lastCalculation = data
        .filter(r => r.custo_total && r.custo_total > 0)
        .sort((a, b) => new Date(b.sync_at).getTime() - new Date(a.sync_at).getTime())[0]?.sync_at;

      setStats({
        total_recipes: totalRecipes,
        recipes_without_cost: recipesWithoutCost,
        recipes_with_cost: recipesWithCost,
        last_calculation: lastCalculation
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('tabela_destino', 'receitas_legado')
        .eq('operacao', 'recalculate_costs')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    }
  };

  const triggerRecalculation = async () => {
    setIsRecalculating(true);
    
    try {
      toast({
        title: "Iniciando Recálculo",
        description: "Disparando recálculo de custos das receitas...",
      });

      const { data, error } = await supabase.functions.invoke('recalculate-recipe-costs', {
        body: { manual_trigger: true }
      });

      if (error) throw error;

      toast({
        title: "Recálculo Iniciado",
        description: "Processo de recálculo foi iniciado com sucesso!",
      });

      // Atualizar estatísticas e logs
      await Promise.all([fetchRecipeStats(), fetchRecentLogs()]);

      return data;
    } catch (error) {
      console.error('Erro ao disparar recálculo:', error);
      toast({
        title: "Erro no Recálculo",
        description: (error as Error)?.message || "Falha ao iniciar o recálculo de custos",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsRecalculating(false);
    }
  };

  useEffect(() => {
    fetchRecipeStats();
    fetchRecentLogs();
  }, []);

  return {
    isRecalculating,
    stats,
    logs,
    triggerRecalculation,
    fetchRecipeStats,
    fetchRecentLogs
  };
};