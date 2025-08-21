/**
 * Teste rápido para verificar se o erro 503 foi corrigido
 */

import { supabase } from '@/integrations/supabase/client';

export const testEdgeFunctionFix = async () => {
  try {
    console.log('🔍 Testando correção da Edge Function...');
    
    // Teste 1: Health check
    const { data, error } = await supabase.functions.invoke('gpt-assistant', {
      method: 'GET'
    });

    if (error) {
      console.error('❌ Erro no health check:', error);
      return {
        success: false,
        error: error.message,
        step: 'health_check'
      };
    }

    console.log('✅ Health check passou:', data);

    // Teste 2: Verificar se aceita OPTIONS (CORS)
    try {
      const corsTest = await fetch(`https://wzbhhioegxdpegirglbq.supabase.co/functions/v1/gpt-assistant`, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type'
        }
      });
      
      console.log('✅ CORS test status:', corsTest.status);
      
      if (corsTest.status === 200) {
        return {
          success: true,
          message: 'Edge Function corrigida com sucesso!',
          healthCheck: data,
          corsWorking: true
        };
      }
    } catch (corsError) {
      console.warn('⚠️ CORS test falhou, mas health check passou');
    }

    return {
      success: true,
      message: 'Edge Function funcionando (health check passou)',
      healthCheck: data,
      corsWorking: false
    };

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      step: 'general_error'
    };
  }
};