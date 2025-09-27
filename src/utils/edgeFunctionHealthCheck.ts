import { supabase } from '../integrations/supabase/client';
import { withRetry } from './connectionUtils';

export interface HealthCheckResult {
  isHealthy: boolean;
  status: string;
  responseTime: number;
  timestamp: string;
  error?: string;
  version?: string;
  environment?: string;
}

export const checkEdgeFunctionHealth = async (
  functionName: string = 'gpt-assistant'
): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    console.log(`[Health Check] Verificando saúde da Edge Function: ${functionName}`);
    
    const result = await withRetry(
      async () => {
        const { data, error } = await supabase.functions.invoke(functionName, {
          method: 'GET'
        });
        
        if (error) throw error;
        return data;
      },
      {
        maxRetries: 2,
        initialDelay: 500,
        maxDelay: 3000,
        backoffFactor: 2
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    console.log(`[Health Check] Edge Function saudável em ${responseTime}ms:`, result);
    
    return {
      isHealthy: true,
      status: result.status || 'healthy',
      responseTime,
      timestamp: result.timestamp || new Date().toISOString(),
      version: result.version,
      environment: result.environment
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`[Health Check] Edge Function com problemas após ${responseTime}ms:`, error);
    
    return {
      isHealthy: false,
      status: 'unhealthy',
      responseTime,
      timestamp: new Date().toISOString(),
      error: errorMessage
    };
  }
};

export const testEdgeFunctionConnectivity = async (
  functionName: string = 'gpt-assistant'
): Promise<{
  canConnect: boolean;
  healthCheck: HealthCheckResult;
  networkInfo: {
    online: boolean;
    userAgent: string;
    language: string;
  };
}> => {
  const healthCheck = await checkEdgeFunctionHealth(functionName);
  
  return {
    canConnect: healthCheck.isHealthy,
    healthCheck,
    networkInfo: {
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      language: navigator.language
    }
  };
};