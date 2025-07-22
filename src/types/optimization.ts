
// Interfaces para sistema de otimização de compras

export interface ProductBase {
  id: number;
  name: string;
  category: string;
}

export interface PackagingOption {
  produto_id: number;
  produto_base_id: number;
  descricao: string;
  quantidade_embalagem: number;
  unidade: string;
  preco: number;
  preco_compra: number;
  promocao: boolean;
  em_promocao: boolean;
  apenas_valor_inteiro: boolean;
  disponivel: boolean;
}

export interface OptimizationRequest {
  produto_base_id: number;
  quantidade_necessaria: number;
  unidade: string;
  opcoes_embalagem: PackagingOption[];
  config: OptimizationConfig;
}

export interface OptimizationResult {
  produto_base_id: number;
  produto_base_nome: string;
  quantidade_solicitada: number;
  quantidade_total_comprada: number;
  sobra: number;
  custo_total: number;
  economia_obtida: number;
  pacotes_selecionados: PackageSelection[];
  justificativa: string;
}

export interface PackageSelection {
  produto_id: number;
  descricao: string;
  quantidade_pacotes: number;
  quantidade_unitaria: number;
  preco_unitario: number;
  custo_total: number;
  em_promocao: boolean;
  motivo_selecao: string;
}

export interface OptimizationConfig {
  prioridade_promocao: 'alta' | 'media' | 'baixa';
  tolerancia_sobra_percentual: number; // ex: 10 para 10%
  preferir_produtos_integrais: boolean;
  maximo_tipos_embalagem_por_produto: number;
  considerar_custo_compra: boolean; // usar preco_compra ao invés de preco
}

export interface OptimizationSummary {
  total_produtos_analisados: number;
  economia_total: number;
  produtos_em_promocao_utilizados: number;
  sobra_total_percentual: number;
  produtos_com_restricao_integral: number;
}

export interface OptimizationDecision {
  produto_base_id: number;
  decisao: 'otimizado' | 'padrao' | 'indisponivel';
  motivo: string;
  alternativas_consideradas: number;
  tempo_processamento_ms: number;
}
