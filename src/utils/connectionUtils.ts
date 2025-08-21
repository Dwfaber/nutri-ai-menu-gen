
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

export class ConnectionError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 8000,
    backoffFactor = 2
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      console.log(`Tentativa ${attempt + 1}/${maxRetries + 1} falhou:`, {
        error: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        isRetryable: isRetryableError(error)
      });
      
      // Se não é um erro de conexão ou já é a última tentativa, falha imediatamente
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError!;
};

const isRetryableError = (error: any): boolean => {
  // Erros HTTP que indicam problemas de conectividade
  const retryableStatusCodes = [408, 429, 502, 503, 504];
  
  if (error?.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }

  // Erros específicos do Supabase Functions
  if (error?.name === 'FunctionsFetchError') return true;
  if (error?.message?.includes('FunctionsFetchError')) return true;
  
  // Erros de rede específicos
  if (error?.message?.includes('Failed to fetch')) return true;
  if (error?.message?.includes('NetworkError')) return true;
  if (error?.message?.includes('timeout')) return true;
  if (error?.message?.includes('ERR_NETWORK')) return true;
  if (error?.message?.includes('ERR_INTERNET_DISCONNECTED')) return true;
  if (error?.code === 'NETWORK_ERROR') return true;

  return false;
};

const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const createConnectionMonitor = () => {
  let isOnline = navigator.onLine;
  const listeners: Array<(online: boolean) => void> = [];

  const notifyListeners = (online: boolean) => {
    listeners.forEach(listener => listener(online));
  };

  window.addEventListener('online', () => {
    isOnline = true;
    notifyListeners(true);
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    notifyListeners(false);
  });

  return {
    isOnline: () => isOnline,
    onStatusChange: (listener: (online: boolean) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      };
    }
  };
};
