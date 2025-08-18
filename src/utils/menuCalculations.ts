/**
 * Utility functions for menu calculations moved from Edge Function
 */

export interface IngredientCostDetails {
  nome: string;
  quantidade_necessaria: number;
  unidade: string;
  preco_embalagem: number;
  embalagem_tamanho: number;
  embalagem_unidade: string;
  embalagens_necessarias: number;
  custo_total: number;
  custo_por_refeicao: number;
  promocao: boolean;
  pode_fracionado: boolean;
  eficiencia_uso: number;
  produto_encontrado: boolean;
  descricao_produto: string;
  observacao?: string;
  violacao?: boolean;
  tipo_violacao?: string;
}

export interface IngredientCostResult {
  custo: number;
  detalhes: IngredientCostDetails;
}

export interface ConversionResult {
  ok: boolean;
  valor: number;
  conversao: string;
}

// Conversões de unidades
const UNIDADE_CONVERSIONS = {
  // Peso
  'G': { 'KG': 0.001, 'G': 1 },
  'KG': { 'G': 1000, 'KG': 1 },
  'GRAMAS': { 'KG': 0.001, 'G': 1 },
  'QUILOS': { 'G': 1000, 'KG': 1 },
  
  // Volume
  'ML': { 'L': 0.001, 'ML': 1 },
  'L': { 'ML': 1000, 'L': 1 },
  'LITROS': { 'ML': 1000, 'L': 1 },
  
  // Unidades
  'UN': { 'UN': 1, 'UNIDADE': 1, 'UNIDADES': 1 },
  'UNIDADE': { 'UN': 1, 'UNIDADE': 1, 'UNIDADES': 1 },
  'UNIDADES': { 'UN': 1, 'UNIDADE': 1, 'UNIDADES': 1 },
  
  // Medidas especiais
  'DENTE': { 'DENTE': 1, 'DENTES': 1 },
  'DENTES': { 'DENTE': 1, 'DENTES': 1 },
  'COLHER': { 'COLHER': 1, 'COLHERES': 1 },
  'COLHERES': { 'COLHER': 1, 'COLHERES': 1 }
};

/**
 * Converte quantidade entre unidades
 */
export function toMercadoBase(quantidade: number, unidadeOrigem: string, unidadeDestino: string): ConversionResult {
  const origem = unidadeOrigem.toUpperCase().trim();
  const destino = unidadeDestino.toUpperCase().trim();
  
  if (origem === destino) {
    return { ok: true, valor: quantidade, conversao: `${quantidade} ${origem}` };
  }
  
  const conversaoMap = UNIDADE_CONVERSIONS[origem as keyof typeof UNIDADE_CONVERSIONS];
  if (!conversaoMap) {
    return { ok: false, valor: 0, conversao: `Unidade não suportada: ${origem}` };
  }
  
  const fator = conversaoMap[destino as keyof typeof conversaoMap];
  if (fator === undefined) {
    return { ok: false, valor: 0, conversao: `Conversão impossível: ${origem} → ${destino}` };
  }
  
  const valorConvertido = quantidade * fator;
  return { 
    ok: true, 
    valor: valorConvertido, 
    conversao: `${quantidade} ${origem} = ${valorConvertido} ${destino}` 
  };
}

/**
 * Calcula similaridade entre strings (algoritmo simples)
 */
export function calculateSimilarityScore(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  // Verificar se uma string contém a outra
  if (s1.includes(s2) || s2.includes(s1)) return 85;
  
  // Verificar palavras em comum
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  let commonWords = 0;
  for (const word1 of words1) {
    if (word1.length > 2 && words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
      commonWords++;
    }
  }
  
  const similarity = (commonWords * 2) / (words1.length + words2.length);
  return Math.round(similarity * 100);
}

/**
 * Encontra produto por nome usando similarity
 */
export function findProductByName(nomeBusca: string, produtos: any[]): any[] {
  if (!nomeBusca || !produtos.length) return [];
  
  const produtosComScore = produtos.map(produto => ({
    ...produto,
    similarity_score: calculateSimilarityScore(nomeBusca, produto.descricao || '')
  }));
  
  // Filtrar produtos com score mínimo e ordenar por score
  return produtosComScore
    .filter(p => p.similarity_score >= 50)
    .sort((a, b) => b.similarity_score - a.similarity_score);
}

/**
 * Calcula custo de um ingrediente
 */
export function calculateIngredientCost(
  ingrediente: any,
  produtos: any[],
  mealQuantity: number = 50
): IngredientCostResult {
  const detalhesBase: IngredientCostDetails = {
    nome: ingrediente.produto_base_descricao || ingrediente.nome || 'Ingrediente desconhecido',
    quantidade_necessaria: Number(ingrediente.quantidade || 0),
    unidade: String(ingrediente.unidade || ''),
    preco_embalagem: 0,
    embalagem_tamanho: 0,
    embalagem_unidade: '',
    embalagens_necessarias: 0,
    custo_total: 0,
    custo_por_refeicao: 0,
    promocao: false,
    pode_fracionado: true,
    eficiencia_uso: 0,
    produto_encontrado: produtos.length > 0,
    descricao_produto: ''
  };

  if (!produtos.length) {
    return {
      custo: 0,
      detalhes: {
        ...detalhesBase,
        observacao: 'VIOLAÇÃO: Produto não encontrado no mercado',
        violacao: true,
        tipo_violacao: 'ingrediente_faltante'
      }
    };
  }

  const quantidadeNecessaria = Number(ingrediente.quantidade || 0);
  const unidadeNecessaria = String(ingrediente.unidade || '').toUpperCase();
  
  if (quantidadeNecessaria <= 0) {
    return { custo: 0, detalhes: detalhesBase };
  }

  // Encontrar melhor oferta
  let melhorCusto = Infinity;
  let melhorProduto = null;
  let melhorDetalhes = null;
  
  for (const produto of produtos) {
    try {
      const conversao = toMercadoBase(quantidadeNecessaria, unidadeNecessaria, produto.embalagem_unidade);
      if (!conversao.ok) continue;
      
      const necessidadeNaUnidadeProduto = conversao.valor;
      const tamanhoEmbalagem = produto.embalagem_tamanho;
      
      let embalagensNecessarias: number;
      if (produto.apenas_valor_inteiro_sim_nao) {
        embalagensNecessarias = Math.ceil(necessidadeNaUnidadeProduto / tamanhoEmbalagem);
      } else {
        embalagensNecessarias = necessidadeNaUnidadeProduto / tamanhoEmbalagem;
      }
      
      const custoTotal = embalagensNecessarias * produto.preco_reais;
      const custoEfetivo = produto.em_promocao_sim_nao ? custoTotal * 0.9 : custoTotal;
      
      const detalhes = {
        produto: produto.descricao,
        necessidade: `${quantidadeNecessaria} ${unidadeNecessaria}`,
        conversao: conversao.conversao,
        embalagem: `${tamanhoEmbalagem} ${produto.embalagem_unidade}`,
        embalagens_necessarias: embalagensNecessarias,
        preco_embalagem: produto.preco_reais,
        custo_total: custoTotal,
        promocao: produto.em_promocao_sim_nao,
        pode_fracionado: !produto.apenas_valor_inteiro_sim_nao,
        eficiencia_uso: necessidadeNaUnidadeProduto / tamanhoEmbalagem,
      };
      
      if (custoEfetivo < melhorCusto) {
        melhorCusto = custoEfetivo;
        melhorProduto = produto;
        melhorDetalhes = detalhes;
      }
    } catch (e) {
      console.error(`Erro processando produto ${produto.descricao}:`, e);
    }
  }
  
  if (melhorDetalhes && Number.isFinite(melhorCusto) && melhorProduto) {
    const detalhesCompletos: IngredientCostDetails = {
      nome: ingrediente.produto_base_descricao || ingrediente.nome || 'Ingrediente desconhecido',
      quantidade_necessaria: quantidadeNecessaria,
      unidade: ingrediente.unidade || '',
      preco_embalagem: melhorProduto.preco_reais,
      embalagem_tamanho: melhorProduto.embalagem_tamanho,
      embalagem_unidade: melhorProduto.embalagem_unidade,
      embalagens_necessarias: melhorDetalhes.embalagens_necessarias,
      custo_total: melhorCusto,
      custo_por_refeicao: melhorCusto / mealQuantity,
      promocao: melhorDetalhes.promocao,
      pode_fracionado: melhorDetalhes.pode_fracionado,
      eficiencia_uso: melhorDetalhes.eficiencia_uso,
      produto_encontrado: true,
      descricao_produto: melhorProduto.descricao
    };
    
    return { custo: melhorCusto, detalhes: detalhesCompletos };
  }
  
  return { custo: 0, detalhes: detalhesBase };
}

/**
 * Calcula custo total de uma receita
 */
export function calculateRecipeCost(
  receita: any,
  produtos: any[],
  mealQuantity: number = 50
): { custo: number; ingredientes: IngredientCostDetails[] } {
  let custoTotal = 0;
  const ingredientesDetalhados: IngredientCostDetails[] = [];
  
  for (const ingrediente of receita.ingredientes || []) {
    const produtosEncontrados = findProductByName(
      ingrediente.produto_base_descricao || ingrediente.nome,
      produtos
    );
    
    const resultado = calculateIngredientCost(ingrediente, produtosEncontrados, mealQuantity);
    custoTotal += resultado.custo;
    ingredientesDetalhados.push(resultado.detalhes);
  }
  
  return { custo: custoTotal, ingredientes: ingredientesDetalhados };
}