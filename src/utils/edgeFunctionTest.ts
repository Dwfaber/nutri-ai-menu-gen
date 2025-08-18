/**
 * Utilitário para testar conectividade com Edge Functions
 */

import { supabase } from '@/integrations/supabase/client';

export const testEdgeFunctionConnectivity = async (): Promise<{
  isConnected: boolean;
  status: string;
  timestamp?: string;
  error?: string;
}> => {
  try {
    console.log('[Test] Testando conectividade com gpt-assistant...');
    
    // Usar o endpoint GET de health check
    const { data, error } = await supabase.functions.invoke('gpt-assistant', {
      method: 'GET'
    });

    if (error) {
      console.error('[Test] Erro na chamada:', error);
      return {
        isConnected: false,
        status: 'error',
        error: error.message || String(error)
      };
    }

    console.log('[Test] Resposta do health check:', data);

    if (data?.status === 'healthy') {
      return {
        isConnected: true,
        status: 'healthy',
        timestamp: data.timestamp
      };
    }

    return {
      isConnected: false,
      status: 'unhealthy',
      error: 'Edge Function retornou status não-saudável'
    };

  } catch (error) {
    console.error('[Test] Erro inesperado:', error);
    return {
      isConnected: false,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const testMenuGeneration = async (testPayload = {
  action: 'generate_menu',
  filialIdLegado: 8,
  numDays: 1,
  refeicoesPorDia: 50,
  useDiaEspecial: false,
  baseRecipes: {
    arroz: 580,
    feijao: 1600
  }
}): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> => {
  try {
    console.log('[Test] Testando geração de cardápio...');
    console.log('[Test] Payload:', testPayload);
    
    const { data, error } = await supabase.functions.invoke('gpt-assistant', {
      body: testPayload
    });

    if (error) {
      console.error('[Test] Erro na geração:', error);
      return {
        success: false,
        error: error.message || String(error)
      };
    }

    console.log('[Test] Cardápio gerado com sucesso:', data);
    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('[Test] Erro inesperado na geração:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};