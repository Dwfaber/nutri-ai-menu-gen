
import { useState, useCallback } from 'react';
import { OptimizationConfig, OptimizationResult, OptimizationRequest } from '@/types/optimization';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_CONFIG: OptimizationConfig = {
  prioridade_promocao: 'alta',
  tolerancia_sobra_percentual: 10,
  preferir_produtos_integrais: false,
  maximo_tipos_embalagem_por_produto: 3,
  considerar_custo_compra: false
};

export const useOptimization = () => {
  const [config, setConfig] = useState<OptimizationConfig>(DEFAULT_CONFIG);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastResults, setLastResults] = useState<OptimizationResult[]>([]);
  const { toast } = useToast();

  const updateConfig = useCallback((newConfig: Partial<OptimizationConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    
    toast({
      title: "Configuração Atualizada",
      description: "As preferências de otimização foram salvas."
    });
  }, [toast]);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    
    toast({
      title: "Configuração Restaurada",
      description: "As configurações padrão foram restauradas."
    });
  }, [toast]);

  const optimizeRequests = useCallback(async (requests: OptimizationRequest[]): Promise<OptimizationResult[]> => {
    setIsOptimizing(true);
    
    try {
      // Por enquanto, retorna um resultado simulado
      // Será substituído pela integração com o GPT Assistant
      const results: OptimizationResult[] = requests.map(request => ({
        produto_base_id: request.produto_base_id,
        produto_base_nome: `Produto Base ${request.produto_base_id}`,
        quantidade_solicitada: request.quantidade_necessaria,
        quantidade_total_comprada: request.quantidade_necessaria,
        sobra: 0,
        custo_total: 0,
        economia_obtida: 0,
        pacotes_selecionados: [],
        justificativa: "Aguardando implementação do GPT Assistant para otimização inteligente"
      }));

      setLastResults(results);
      
      toast({
        title: "Otimização Concluída",
        description: `${results.length} produtos analisados com sucesso.`
      });

      return results;
      
    } catch (error) {
      console.error('Erro na otimização:', error);
      
      toast({
        title: "Erro na Otimização",
        description: "Não foi possível otimizar as compras. Tente novamente.",
        variant: "destructive"
      });
      
      return [];
    } finally {
      setIsOptimizing(false);
    }
  }, [toast]);

  const calculateSavings = useCallback((results: OptimizationResult[]): number => {
    return results.reduce((total, result) => total + result.economia_obtida, 0);
  }, []);

  const getPromotionCount = useCallback((results: OptimizationResult[]): number => {
    return results.reduce((count, result) => {
      const promotionPackages = result.pacotes_selecionados.filter(p => p.em_promocao);
      return count + promotionPackages.length;
    }, 0);
  }, []);

  return {
    config,
    updateConfig,
    resetConfig,
    optimizeRequests,
    isOptimizing,
    lastResults,
    calculateSavings,
    getPromotionCount
  };
};
