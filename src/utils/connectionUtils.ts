
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
    maxRetries = 2,
    initialDelay = 1000,
    maxDelay = 5000,
    backoffFactor = 1.5
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Se não é um erro de conexão ou já é a última tentativa, falha imediatamente
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      console.log(`Tentativa ${attempt + 1} falhou, tentando novamente em ${delay}ms...`);
      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError!;
};

const isRetryableError = (error: any): boolean => {
  // Erros HTTP que indicam problemas de conectividade (mais restrito)
  const retryableStatusCodes = [408, 502, 503, 504];
  
  if (error?.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }

  // Erros de rede específicos
  if (error?.message?.includes('Failed to fetch')) return true;
  if (error?.message?.includes('NetworkError')) return true;
  if (error?.message?.includes('timeout')) return true;
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
