/**
 * Utilitários para sistema de sugestões de ingredientes
 */

export interface IngredientSuggestion {
  originalName: string;
  suggestedProduct: {
    id: number;
    descricao: string;
    preco: number;
    unidade: string;
    similarity_score: number;
  };
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ProductSuggestionViolation {
  type: 'product_suggestion';
  originalIngredient: string;
  suggestedProduct: string;
  price: number;
  unit: string;
  score: number;
  requiresApproval: boolean;
}

/**
 * Normaliza texto para comparação (mesmo algoritmo do backend)
 */
export const normalizeSearchTerm = (text: string): string => {
  if (!text) return '';
  
  return text
    .normalize('NFD') // Remove acentos
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s*-\s*/g, ' ') // Remove hífens
    .replace(/\b\d+\s*(GR?S?|KGS?|G|GRAMAS?|QUILOS?)\b/gi, '') // Remove especificações de peso
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
};

/**
 * Identifica se uma violação é uma sugestão de produto
 */
export const isProductSuggestion = (violation: any): violation is ProductSuggestionViolation => {
  return violation.type === 'product_suggestion' && 
         violation.originalIngredient &&
         violation.suggestedProduct &&
         violation.score !== undefined;
};

/**
 * Formata sugestão para exibição
 */
export const formatSuggestion = (suggestion: IngredientSuggestion): string => {
  return `${suggestion.originalName} → ${suggestion.suggestedProduct.descricao}`;
};

/**
 * Verifica se uma sugestão tem score suficiente para auto-aprovação
 */
export const canAutoApprove = (score: number): boolean => {
  return score >= 80; // Score muito alto = auto-aprovar
};

/**
 * Cria chave única para armazenar aprovação
 */
export const createApprovalKey = (originalName: string, suggestedName: string): string => {
  return `${normalizeSearchTerm(originalName)}_${normalizeSearchTerm(suggestedName)}`;
};