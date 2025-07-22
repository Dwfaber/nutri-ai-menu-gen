
import { PackagingOption, OptimizationConfig, PackageSelection } from '@/types/optimization';

/**
 * Agrupa produtos por produto_base_id
 */
export const groupProductsByBase = (products: any[]): Map<number, any[]> => {
  const grouped = new Map<number, any[]>();
  
  products.forEach(product => {
    const baseId = product.produto_base_id;
    if (!grouped.has(baseId)) {
      grouped.set(baseId, []);
    }
    grouped.get(baseId)!.push(product);
  });
  
  return grouped;
};

/**
 * Calcula a melhor combinação de embalagens para uma quantidade necessária
 * Algoritmo guloso que prioriza custo-benefício
 */
export const calculateOptimalPackaging = (
  quantidadeNecessaria: number,
  opcoes: PackagingOption[],
  config: OptimizationConfig
): PackageSelection[] => {
  // Filtrar opções disponíveis
  const opcoesDisponiveis = opcoes.filter(opcao => opcao.disponivel);
  
  if (opcoesDisponiveis.length === 0) {
    return [];
  }

  // Ordenar por prioridade: promoção, custo por unidade, tamanho
  const opcoesOrdenadas = [...opcoesDisponiveis].sort((a, b) => {
    // 1. Priorizar promoções se configurado
    if (config.prioridade_promocao === 'alta') {
      if (a.promocao || a.em_promocao) return -1;
      if (b.promocao || b.em_promocao) return 1;
    }
    
    // 2. Comparar custo por unidade
    const precoA = config.considerar_custo_compra ? a.preco_compra : a.preco;
    const precoB = config.considerar_custo_compra ? b.preco_compra : b.preco;
    
    const custoUnitarioA = precoA / a.quantidade_embalagem;
    const custoUnitarioB = precoB / b.quantidade_embalagem;
    
    return custoUnitarioA - custoUnitarioB;
  });

  const selecoes: PackageSelection[] = [];
  let quantidadeRestante = quantidadeNecessaria;

  // Algoritmo guloso para seleção de embalagens
  for (const opcao of opcoesOrdenadas) {
    if (quantidadeRestante <= 0) break;
    
    if (selecoes.length >= config.maximo_tipos_embalagem_por_produto) break;

    const preco = config.considerar_custo_compra ? opcao.preco_compra : opcao.preco;
    
    // Se o produto só aceita valores inteiros
    if (opcao.apenas_valor_inteiro) {
      const pacotesNecessarios = Math.ceil(quantidadeRestante / opcao.quantidade_embalagem);
      const quantidadeTotal = pacotesNecessarios * opcao.quantidade_embalagem;
      const sobra = quantidadeTotal - quantidadeRestante;
      const sobraPercentual = (sobra / quantidadeNecessaria) * 100;
      
      // Verificar se a sobra está dentro da tolerância
      if (sobraPercentual <= config.tolerancia_sobra_percentual) {
        selecoes.push({
          produto_id: opcao.produto_id,
          descricao: opcao.descricao,
          quantidade_pacotes: pacotesNecessarios,
          quantidade_unitaria: opcao.quantidade_embalagem,
          preco_unitario: preco,
          custo_total: pacotesNecessarios * preco,
          em_promocao: opcao.promocao || opcao.em_promocao,
          motivo_selecao: getSelectionReason(opcao, config, sobraPercentual)
        });
        
        quantidadeRestante = 0; // Produto integral resolve tudo de uma vez
      }
    } else {
      // Produto pode ser fracionado
      const quantidadeDesejada = Math.min(quantidadeRestante, opcao.quantidade_embalagem * 10); // Limitar a quantidade
      const pacotesNecessarios = Math.ceil(quantidadeDesejada / opcao.quantidade_embalagem);
      
      selecoes.push({
        produto_id: opcao.produto_id,
        descricao: opcao.descricao,
        quantidade_pacotes: pacotesNecessarios,
        quantidade_unitaria: opcao.quantidade_embalagem,
        preco_unitario: preco,
        custo_total: pacotesNecessarios * preco,
        em_promocao: opcao.promocao || opcao.em_promocao,
        motivo_selecao: getSelectionReason(opcao, config, 0)
      });
      
      quantidadeRestante -= pacotesNecessarios * opcao.quantidade_embalagem;
    }
  }

  return selecoes;
};

/**
 * Gera justificativa para a seleção de uma embalagem
 */
const getSelectionReason = (
  opcao: PackagingOption,
  config: OptimizationConfig,
  sobraPercentual: number
): string => {
  const reasons: string[] = [];
  
  if (opcao.promocao || opcao.em_promocao) {
    reasons.push("em promoção");
  }
  
  if (opcao.apenas_valor_inteiro) {
    reasons.push("produto integral");
    if (sobraPercentual > 0) {
      reasons.push(`sobra de ${sobraPercentual.toFixed(1)}%`);
    }
  }
  
  const preco = config.considerar_custo_compra ? opcao.preco_compra : opcao.preco;
  const custoUnitario = preco / opcao.quantidade_embalagem;
  reasons.push(`R$ ${custoUnitario.toFixed(2)}/unidade`);
  
  return reasons.join(", ");
};

/**
 * Calcula estatísticas de otimização
 */
export const calculateOptimizationStats = (
  selecoes: PackageSelection[],
  quantidadeOriginal: number,
  custoSemOtimizacao: number
) => {
  const quantidadeTotal = selecoes.reduce((total, sel) => 
    total + (sel.quantidade_pacotes * sel.quantidade_unitaria), 0
  );
  
  const custoTotal = selecoes.reduce((total, sel) => total + sel.custo_total, 0);
  
  const sobra = quantidadeTotal - quantidadeOriginal;
  const sobraPercentual = (sobra / quantidadeOriginal) * 100;
  
  const economia = Math.max(0, custoSemOtimizacao - custoTotal);
  const economiaPercentual = custoSemOtimizacao > 0 ? (economia / custoSemOtimizacao) * 100 : 0;
  
  const promocoesUsadas = selecoes.filter(sel => sel.em_promocao).length;
  
  return {
    quantidadeTotal,
    custoTotal,
    sobra,
    sobraPercentual,
    economia,
    economiaPercentual,
    promocoesUsadas,
    eficiencia: economiaPercentual - sobraPercentual // Métrica combinada
  };
};

/**
 * Valida se uma configuração de otimização é válida
 */
export const validateOptimizationConfig = (config: OptimizationConfig): string[] => {
  const errors: string[] = [];
  
  if (config.tolerancia_sobra_percentual < 0 || config.tolerancia_sobra_percentual > 50) {
    errors.push("Tolerância de sobra deve estar entre 0% e 50%");
  }
  
  if (config.maximo_tipos_embalagem_por_produto < 1 || config.maximo_tipos_embalagem_por_produto > 10) {
    errors.push("Máximo de tipos de embalagem deve estar entre 1 e 10");
  }
  
  if (!['alta', 'media', 'baixa'].includes(config.prioridade_promocao)) {
    errors.push("Prioridade de promoção deve ser 'alta', 'media' ou 'baixa'");
  }
  
  return errors;
};
