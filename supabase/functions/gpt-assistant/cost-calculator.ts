// costCalculator.ts - Edge Function Logic (Supabase backend)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ======================================
// Tipos
// ======================================

export interface MenuRequest {
  cliente: string;
  periodo_dias: number;
  refeicoes_por_dia: number;
  orcamento_por_refeicao: number;
  receitas_fixas?: string[];
  receitas_sugeridas?: string[];
}

export interface IngredientCost {
  nome: string;
  produto_base_id: number;
  quantidade_necessaria: number;
  quantidade_comprar: number;
  unidade: string;
  preco_unitario: number;
  custo_total: number;
  custo_por_refeicao: number;
  custo_utilizado: number;
  fornecedor: string;
  em_promocao: boolean;
  sobra: number;
  percentual_sobra: number;
  compra_inteira: boolean;
}

export interface RecipeCost {
  receita_id: number;
  nome: string;
  categoria?: string;
  porcoes_base: number;
  porcoes_calculadas: number;
  ingredientes: IngredientCost[];
  ingredientes_sem_preco: string[];
  custo_total: number;
  custo_por_porcao: number;
  dentro_orcamento: boolean;
  precisao_calculo: number;
  avisos: string[];
}

export interface ShoppingListItem {
  produto_base_id: number;
  nome: string;
  quantidade_total: number;
  unidade: string;
  preco_unitario: number;
  custo_total: number;
  fornecedor: string;
  em_promocao: boolean;
  receitas: string[];
  observacao?: string;
}

export interface MenuResult {
  cliente: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  total_refeicoes: number;
  refeicoes_por_dia: number;
  orcamento_total: number;
  orcamento_por_refeicao: number;

  receitas: {
    fixas: RecipeCost[];
    principais: RecipeCost[];
    acompanhamentos: RecipeCost[];
  };

  resumo_custos: {
    custo_total_calculado: number;
    custo_por_refeicao: number;
    economia_total: number;
    economia_percentual: number;
    dentro_orcamento: boolean;
  };

  lista_compras: {
    itens: ShoppingListItem[];
    total_itens: number;
    custo_total: number;
    itens_promocao: number;
    economia_promocoes: number;
  };

  avisos: string[];
  metadata: {
    generated_at: string;
    calculation_time_ms: number;
    precision_percentage: number;
  };
}

// ======================================
// Classe principal
// ======================================

export class CostCalculator {
  private supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  async generateOptimizedMenu(request: MenuRequest): Promise<MenuResult> {
    const startTime = Date.now();

    // -------------------
    // (1) Pega receitas fixas (ex.: arroz, feijão)
    // -------------------
    const receitasFixas: RecipeCost[] = (request.receitas_fixas || []).map((nome, idx) => ({
      receita_id: idx + 1,
      nome,
      categoria: mapCategoria(nome),
      porcoes_base: 100,
      porcoes_calculadas: request.refeicoes_por_dia * request.periodo_dias,
      ingredientes: [],
      ingredientes_sem_preco: [],
      custo_total: 0,
      custo_por_porcao: 0,
      dentro_orcamento: true,
      precisao_calculo: 100,
      avisos: []
    }));

    // -------------------
    // (2) Suponha que "principais" sejam sempre vazios (exemplo)
    // -------------------
    const receitasPrincipais: RecipeCost[] = [];

    // -------------------
    // (3) Suponha acompanhamentos vazios também
    // -------------------
    const receitasAcompanhamentos: RecipeCost[] = [];

    // -------------------
    // (4) Calcula totais
    // -------------------
    const allRecipes = [...receitasFixas, ...receitasPrincipais, ...receitasAcompanhamentos];
    const totalRef = allRecipes.reduce((sum, r) => sum + (r.porcoes_calculadas || 0), 0);
    const totalCost = allRecipes.reduce((sum, r) => sum + (r.custo_total || 0), 0);
    const orcamentoTotal = request.periodo_dias * request.refeicoes_por_dia * request.orcamento_por_refeicao;

    // -------------------
    // (5) Monta resultado final
    // -------------------
    const menuResult: MenuResult = {
      cliente: request.cliente,
      periodo: `${request.periodo_dias} dias`,
      data_inicio: new Date().toISOString().split("T")[0],
      data_fim: new Date(Date.now() + request.periodo_dias * 86400000).toISOString().split("T")[0],
      total_refeicoes: totalRef,
      refeicoes_por_dia: request.refeicoes_por_dia,
      orcamento_total: orcamentoTotal,
      orcamento_por_refeicao: request.orcamento_por_refeicao,

      receitas: {
        fixas: receitasFixas,
        principais: receitasPrincipais,
        acompanhamentos: receitasAcompanhamentos,
      },

      resumo_custos: {
        custo_total_calculado: totalCost,
        custo_por_refeicao: totalRef > 0 ? totalCost / totalRef : 0,
        economia_total: orcamentoTotal - totalCost,
        economia_percentual: orcamentoTotal > 0 ? ((orcamentoTotal - totalCost) / orcamentoTotal) * 100 : 0,
        dentro_orcamento: totalCost <= orcamentoTotal,
      },

      lista_compras: {
        itens: [], // implementar logicamente mais tarde
        total_itens: 0,
        custo_total: 0,
        itens_promocao: 0,
        economia_promocoes: 0,
      },

      avisos: [],
      metadata: {
        generated_at: new Date().toISOString(),
        calculation_time_ms: Date.now() - startTime,
        precision_percentage: 100,
      },
    };

    return menuResult;
  }
}

// ======================================
// Função pública exportada
// ======================================

export async function generateMenu(request: MenuRequest): Promise<MenuResult> {
  const calculator = new CostCalculator();
  return calculator.generateOptimizedMenu(request);
}

// ======================================
// Helper simples para categorizar receitas
// ======================================
function mapCategoria(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("arroz")) return "Arroz Branco";
  if (n.includes("feijão")) return "Feijão";
  if (n.includes("salada")) return "Salada";
  if (n.includes("suco")) return "Suco";
  if (n.includes("carne") || n.includes("frango") || n.includes("peixe")) return "Prato Principal 1";
  if (n.includes("sobremesa")) return "Sobremesa";
  return "Outros";
}