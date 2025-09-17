import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ViewInfo {
  name: string;
  description: string;
  status: 'pending' | 'synced' | 'error';
  lastSync?: string;
  recordCount?: number;
}

interface LegacyViews {
  vwCoSolicitacaoFilialCusto: ViewInfo;
  vwCoSolicitacaoProdutoListagem: ViewInfo;
  vwCpReceita: ViewInfo;
  vwCpReceitaProduto: ViewInfo;
  vwEstProdutoBase: ViewInfo;
  vwOrFiliaisAtiva: ViewInfo;
}

interface SyncProgress {
  currentView: string;
  totalViews: number;
  completedViews: number;
  isProcessing: boolean;
}

// Environment configuration for testing vs production
const IS_TEST_MODE = import.meta.env.DEV; // Use dev mode as indicator for testing

export const useLegacyAdaptation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [viewsStatus, setViewsStatus] = useState<LegacyViews>({
    vwCoSolicitacaoFilialCusto: {
      name: 'Custos por Filial',
      description: 'Dados de custos e orçamento por filial (agora processa dados reais do n8n)',
      status: 'pending'
    },
    vwCoSolicitacaoProdutoListagem: {
      name: 'Produtos Solicitados',
      description: 'Lista de produtos e solicitações (agora processa dados reais do n8n)',
      status: 'pending'
    },
    vwCpReceita: {
      name: 'Receitas',
      description: 'Receitas e preparações cadastradas - agora processa lotes completos do n8n (não mais apenas 4 receitas)',
      status: 'pending'
    },
    vwCpReceitaProduto: {
      name: 'Ingredientes das Receitas',
      description: 'Produtos utilizados em cada receita (agora processa dados reais do n8n)',
      status: 'pending'
    },
    vwEstProdutoBase: {
      name: 'Produtos Base',
      description: 'Estoque e informações básicas dos produtos (agora processa dados reais do n8n)',
      status: 'pending'
    },
    vwOrFiliaisAtiva: {
      name: 'Filiais Ativas',
      description: 'Filiais ativas e suas configurações (agora processa dados reais do n8n)',
      status: 'pending'
    }
  });

  // Calculate totalViews dynamically
  const totalViews = Object.keys(viewsStatus).length;
  
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    currentView: '',
    totalViews,
    completedViews: 0,
    isProcessing: false
  });

  const { toast } = useToast();

  const syncSpecificView = async (viewName: string): Promise<boolean> => {
    try {
      console.log(`Sincronizando view: ${viewName} - processando dados do n8n`);
      
      setSyncProgress(prev => ({
        ...prev,
        currentView: viewName,
        isProcessing: true,
        totalViews // Update with current totalViews
      }));

      // Usar edge function específica para vwCpReceita
      const functionName = viewName === 'vwCpReceita' ? 'sync-legacy-receitas' : 'sync-legacy-views';
      
      // Control test data based on environment
      const requestBody = viewName === 'vwCpReceita' ? {} : { 
        viewName,
        data: IS_TEST_MODE ? [] : undefined // Send empty array only in test mode
      };

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: requestBody
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro na sincronização');
      }

      // Atualizar status da view
      setViewsStatus(prev => ({
        ...prev,
        [viewName]: {
          ...prev[viewName as keyof LegacyViews],
          status: 'synced',
          lastSync: new Date().toISOString(),
          recordCount: data.recordCount || data.lote_tamanho || 0
        }
      }));

      setSyncProgress(prev => ({
        ...prev,
        completedViews: prev.completedViews + 1,
        totalViews // Update with current totalViews
      }));

      return true;

    } catch (err) {
      console.error(`Erro ao sincronizar ${viewName}:`, err);
      
      setViewsStatus(prev => ({
        ...prev,
        [viewName]: {
          ...prev[viewName as keyof LegacyViews],
          status: 'error'
        }
      }));

      const errorMessage = err instanceof Error ? err.message : 'Erro na sincronização';
      toast({
        title: `Erro em ${viewName}`,
        description: errorMessage,
        variant: "destructive"
      });

      return false;
    }
  };

  const syncAllViews = async (): Promise<boolean> => {
    setIsProcessing(true);
    setSyncProgress({
      currentView: '',
      totalViews,
      completedViews: 0,
      isProcessing: true
    });

    const viewNames = Object.keys(viewsStatus);
    let allSuccess = true;

    for (const viewName of viewNames) {
      const success = await syncSpecificView(viewName);
      if (!success) {
        allSuccess = false;
      }
    }

    setSyncProgress(prev => ({
      ...prev,
      isProcessing: false,
      currentView: '',
      totalViews
    }));

    setIsProcessing(false);

    if (allSuccess) {
      toast({
        title: "Sincronização Completa!",
        description: `Todas as ${totalViews} views foram sincronizadas com sucesso`,
      });
    } else {
      toast({
        title: "Sincronização com Erros",
        description: "Algumas views apresentaram problemas",
        variant: "destructive"
      });
    }

    return allSuccess;
  };

  const checkViewsAvailability = async (): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-legacy-views', {
        body: { action: 'checkViews' }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro na verificação');
      }

      // Atualizar status das views baseado na verificação
      const updatedViews = { ...viewsStatus };
      Object.keys(updatedViews).forEach(viewName => {
        const isAvailable = data.availableViews.includes(viewName);
        updatedViews[viewName as keyof LegacyViews].status = isAvailable ? 'pending' : 'error';
      });

      setViewsStatus(updatedViews);

      toast({
        title: "Verificação Concluída",
        description: `${data.availableViews.length} views disponíveis - processando dados reais`,
      });

      return true;

    } catch (err) {
      console.error('Erro na verificação:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro na verificação';
      
      toast({
        title: "Erro na Verificação",
        description: errorMessage,
        variant: "destructive"
      });

      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    syncSpecificView,
    syncAllViews,
    checkViewsAvailability,
    isProcessing,
    viewsStatus,
    syncProgress
  };
};
