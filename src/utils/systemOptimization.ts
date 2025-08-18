/**
 * Utilitários para otimização do sistema de sugestões
 */

export interface OptimizationMetrics {
  searchEfficiency: number;
  cacheHitRate: number;
  suggestionAccuracy: number;
  averageResponseTime: number;
}

export interface SuggestionStats {
  totalSuggestions: number;
  approvedSuggestions: number;
  rejectedSuggestions: number;
  autoApprovedSuggestions: number;
  approvalRate: number;
}

// Cache global para sugestões aprovadas
const approvedSuggestionsCache = new Map<string, any>();
const performanceMetrics = {
  searches: 0,
  cacheHits: 0,
  totalResponseTime: 0,
  suggestions: {
    total: 0,
    approved: 0,
    rejected: 0,
    autoApproved: 0
  }
};

/**
 * Adiciona sugestão aprovada ao cache
 */
export const cacheApprovedSuggestion = (originalName: string, approvedProduct: any): void => {
  const key = normalizeForCache(originalName);
  approvedSuggestionsCache.set(key, {
    ...approvedProduct,
    cached_at: Date.now(),
    auto_approved: false
  });
  
  performanceMetrics.suggestions.approved++;
  performanceMetrics.suggestions.total++;
};

/**
 * Busca sugestão no cache
 */
export const getCachedSuggestion = (originalName: string): any | null => {
  const key = normalizeForCache(originalName);
  performanceMetrics.searches++;
  
  if (approvedSuggestionsCache.has(key)) {
    performanceMetrics.cacheHits++;
    return approvedSuggestionsCache.get(key);
  }
  
  return null;
};

/**
 * Normaliza nome para cache
 */
const normalizeForCache = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .trim();
};

/**
 * Registra sugestão rejeitada
 */
export const recordRejectedSuggestion = (originalName: string): void => {
  performanceMetrics.suggestions.rejected++;
  performanceMetrics.suggestions.total++;
};

/**
 * Registra auto-aprovação
 */
export const recordAutoApproval = (originalName: string, product: any): void => {
  const key = normalizeForCache(originalName);
  approvedSuggestionsCache.set(key, {
    ...product,
    cached_at: Date.now(),
    auto_approved: true
  });
  
  performanceMetrics.suggestions.autoApproved++;
  performanceMetrics.suggestions.total++;
};

/**
 * Obtém métricas de performance
 */
export const getPerformanceMetrics = (): OptimizationMetrics => {
  const { searches, cacheHits, totalResponseTime } = performanceMetrics;
  
  return {
    searchEfficiency: searches > 0 ? (cacheHits / searches) * 100 : 0,
    cacheHitRate: cacheHits,
    suggestionAccuracy: calculateSuggestionAccuracy(),
    averageResponseTime: searches > 0 ? totalResponseTime / searches : 0
  };
};

/**
 * Obtém estatísticas de sugestões
 */
export const getSuggestionStats = (): SuggestionStats => {
  const { total, approved, rejected, autoApproved } = performanceMetrics.suggestions;
  
  return {
    totalSuggestions: total,
    approvedSuggestions: approved,
    rejectedSuggestions: rejected,
    autoApprovedSuggestions: autoApproved,
    approvalRate: total > 0 ? ((approved + autoApproved) / total) * 100 : 0
  };
};

/**
 * Calcula precisão das sugestões
 */
const calculateSuggestionAccuracy = (): number => {
  const { total, approved, autoApproved } = performanceMetrics.suggestions;
  if (total === 0) return 100;
  
  return ((approved + autoApproved) / total) * 100;
};

/**
 * Limpa cache antigo (>24h)
 */
export const cleanupOldCache = (): void => {
  const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  for (const [key, value] of approvedSuggestionsCache.entries()) {
    if (value.cached_at < dayAgo) {
      approvedSuggestionsCache.delete(key);
    }
  }
};

/**
 * Registra tempo de resposta
 */
export const recordResponseTime = (timeMs: number): void => {
  performanceMetrics.totalResponseTime += timeMs;
};

/**
 * Reseta métricas (para testes/debug)
 */
export const resetMetrics = (): void => {
  performanceMetrics.searches = 0;
  performanceMetrics.cacheHits = 0;
  performanceMetrics.totalResponseTime = 0;
  performanceMetrics.suggestions = {
    total: 0,
    approved: 0,
    rejected: 0,
    autoApproved: 0
  };
  approvedSuggestionsCache.clear();
};