/**
 * Cost Calculator Module - DEBUG VERSION
 * Sistema de cálculo de custos para cardápios e geração de lista de compras
 * @version 2.0.0-DEBUG
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// ============= TIPOS E INTERFACES =============

export interface RecipeIngredient {
  receita_id_legado: string;
  nome: string;
  produto_base_id: number;
  produto_base_descricao: string;
  quantidade: number;
  unidade: string;
  categoria_descricao?: string;
}

export interface MarketProduct {
  produto_base_id: number;
  descricao: string;
  preco: number;
  produto_base_quantidade_embalagem: number;
  apenas_valor_inteiro_sim_nao: boolean;
  em_promocao_sim_nao: boolean;
  unidade?: string;
}

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

// ============= CONSTANTES =============

const RECIPE_IDS = {
  ARROZ: "580",
  FEIJAO: "1600", // corrigido
};

const UNITS_CONVERSION = {
  'KG': 1,
  'KILO': 1,
  'QUILO': 1,
  'GR': 0.001,
  'G': 0.001,
  'GRAMA': 0.001,
  'MG': 0.000001,
  'L': 1,
  'LITRO': 1,
  'ML': 0.001,
  'UN': 1,
  'UND': 1,
  'UNIDADE': 1,
};

// ============= CLASSE PRINCIPAL =============

export class CostCalculator {
  private supabase: any;
  private cache: Map<string, any>;
  private readonly PORCOES_PADRAO = 100;
  
  constructor() {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    this.cache = new Map();
    
    // 🔍 DEBUG: Verificar configuração do Supabase
    console.log(`🔧 [DEBUG] Supabase configurado:`, {
      url: Deno.env.get('SUPABASE_URL') ? 'OK' : 'MISSING',
      key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'OK' : 'MISSING'
    });
  }

  /**
   * Método principal para gerar cardápio completo
   */
  async generateOptimizedMenu(request: MenuRequest): Promise<MenuResult> {
    const startTime = Date.now();
    console.log(`🍽️ [DEBUG] Iniciando geração para cliente: ${request.cliente}`);
    console.log(`📋 [DEBUG] Request completo:`, JSON.stringify(request, null, 2));

    const totalRefeicoes = request.refeicoes_por_dia * request.periodo_dias;
    const orcamentoTotal = totalRefeicoes * request.orcamento_por_refeicao;

    // === RECEITAS FIXAS (Arroz + Feijão) ===
    const receitasFixasIds = request.receitas_fixas || [RECIPE_IDS.ARROZ, RECIPE_IDS.FEIJAO];
    console.log(`🍚 [DEBUG] IDs receitas fixas:`, receitasFixasIds);
    
    const receitasFixas: RecipeCost[] = [];

    for (const receitaId of receitasFixasIds) {
      console.log(`🔄 [DEBUG] Processando receita fixa: ${receitaId}`);
      try {
        const receitaIdNumber = parseInt(receitaId, 10);
        console.log(`🔢 [DEBUG] ID convertido para número: ${receitaIdNumber}`);
        
        const custo = await this.calculateRecipeCost(
          receitaIdNumber,
          request.refeicoes_por_dia,
          request.periodo_dias,
          request.orcamento_por_refeicao
        );
        
        console.log(`💰 [DEBUG] Custo calculado:`, {
          id: receitaIdNumber,
          nome: custo.nome,
          custo_total: custo.custo_total,
          custo_por_porcao: custo.custo_por_porcao,
          ingredientes_count: custo.ingredientes.length,
          ingredientes_sem_preco: custo.ingredientes_sem_preco.length
        });
        
        receitasFixas.push(custo);
      } catch (err) {
        console.error(`❌ [DEBUG] Erro ao calcular receita fixa ${receitaId}:`, err.message);
        console.error(`❌ [DEBUG] Stack trace:`, err.stack);
      }
    }
    
    console.log(`✅ [DEBUG] Receitas fixas processadas: ${receitasFixas.length}`);

    // Orçamento restante por refeição depois das fixas
    const custoFixoTotalPorRefeicao = receitasFixas.reduce((sum, r) => sum + r.custo_por_porcao, 0);
    const orcamentoRestante = Math.max(0, request.orcamento_por_refeicao - custoFixoTotalPorRefeicao);

    console.log(`💵 [DEBUG] Orçamento:`, {
      total: orcamentoTotal,
      por_refeicao: request.orcamento_por_refeicao,
      custo_fixo_por_refeicao: custoFixoTotalPorRefeicao,
      restante: orcamentoRestante
    });

    // === RECEITAS PRINCIPAIS (sugeridas) ===
    const receitasPrincipais: RecipeCost[] = [];
    if (request.receitas_sugeridas?.length) {
      console.log(`🍖 [DEBUG] Processando receitas principais:`, request.receitas_sugeridas);
      
      for (const receitaId of request.receitas_sugeridas) {
        try {
          const receitaIdNumber = parseInt(receitaId, 10);
          const custo = await this.calculateRecipeCost(
            receitaIdNumber,
            request.refeicoes_por_dia,
            request.periodo_dias,
            orcamentoRestante
          );
          if (custo.dentro_orcamento) receitasPrincipais.push(custo);
        } catch (err) {
          console.error(`❌ [DEBUG] Erro ao calcular receita principal ${receitaId}:`, err.message);
        }
      }
    }

    // === CONSOLIDAR LISTA DE COMPRAS ===
    const todasReceitas = [...receitasFixas, ...receitasPrincipais];
    console.log(`📊 [DEBUG] Total de receitas para lista de compras: ${todasReceitas.length}`);
    
    const listaCompras = await this.consolidateShoppingList(todasReceitas, request.periodo_dias);

    const custoTotalCalculado = todasReceitas.reduce((sum, r) => sum + r.custo_total, 0);
    const custoPorRefeicao = custoTotalCalculado / totalRefeicoes;
    const economia = orcamentoTotal - custoTotalCalculado;

    // === PRECISÃO DE CÁLCULO ===
    const totalIngredientes = todasReceitas.reduce((sum, r) => sum + r.ingredientes.length, 0);
    const ingredientesComPreco = todasReceitas.reduce(
      (sum, r) => sum + r.ingredientes.filter(i => i.preco_unitario > 0).length, 0
    );
    const precisaoGeral = totalIngredientes > 0 ? (ingredientesComPreco / totalIngredientes) * 100 : 0;

    console.log(`📈 [DEBUG] Resumo final:`, {
      receitas_fixas: receitasFixas.length,
      receitas_principais: receitasPrincipais.length,
      custo_total: custoTotalCalculado,
      custo_por_refeicao: custoPorRefeicao,
      economia: economia,
      precisao: precisaoGeral,
      lista_compras_itens: listaCompras.length
    });

    // === RESULTADO FINAL ===
    return {
      cliente: request.cliente,
      periodo: `${request.periodo_dias} dia${request.periodo_dias > 1 ? 's' : ''}`,
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date(Date.now() + (request.periodo_dias - 1) * 86_400_000).toISOString().split('T')[0],
      total_refeicoes: totalRefeicoes,
      refeicoes_por_dia: request.refeicoes_por_dia,
      orcamento_total: orcamentoTotal,
      orcamento_por_refeicao: request.orcamento_por_refeicao,

      receitas: {
        fixas: receitasFixas,
        principais: receitasPrincipais,
        acompanhamentos: [] // pode ser expandido futuramente
      },

      resumo_custos: {
        custo_total_calculado: custoTotalCalculado,
        custo_por_refeicao: custoPorRefeicao,
        economia_total: economia,
        economia_percentual: (economia / orcamentoTotal) * 100,
        dentro_orcamento: custoPorRefeicao <= request.orcamento_por_refeicao,
      },

      lista_compras: {
        itens: listaCompras,
        total_itens: listaCompras.length,
        custo_total: listaCompras.reduce((sum, i) => sum + i.custo_total, 0),
        itens_promocao: listaCompras.filter(i => i.em_promocao).length,
        economia_promocoes: listaCompras
          .filter(i => i.em_promocao)
          .reduce((sum, i) => sum + (i.custo_total * 0.1), 0), // assumir 10%
      },

      avisos: todasReceitas.flatMap(r => r.avisos),
      metadata: {
        generated_at: new Date().toISOString(),
        calculation_time_ms: Date.now() - startTime,
        precision_percentage: precisaoGeral,
      }
    };
  }

  /**
   * Calcula custo detalhado de uma receita
   */
  async calculateRecipeCost(
    recipeId: number,
    refeicoesTotal: number,
    dias: number = 1,
    budgetPerServing?: number
  ): Promise<RecipeCost> {
    console.log(`🧮 [DEBUG] Calculando custo receita ${recipeId} para ${refeicoesTotal} refeições em ${dias} dias`);
    
    const cacheKey = `recipe-${recipeId}-${refeicoesTotal}-${dias}`;
    if (this.cache.has(cacheKey)) {
      console.log(`📦 [DEBUG] Usando cache para receita ${recipeId}`);
      return this.cache.get(cacheKey);
    }

    const ingredients = await this.getRecipeIngredients(recipeId);
    console.log(`🥕 [DEBUG] Ingredientes encontrados: ${ingredients.length}`);
    
    if (!ingredients.length) {
      console.error(`❌ [DEBUG] FALHA CRÍTICA: Receita ${recipeId} sem ingredientes`);
      throw new Error(`Receita ${recipeId} não encontrada`);
    }

    const nomeReceita = ingredients[0]?.nome || `Receita ${recipeId}`;
    const categoria = ingredients[0]?.categoria_descricao || 'Outros';
    console.log(`📝 [DEBUG] Nome da receita: ${nomeReceita}, Categoria: ${categoria}`);

    const ids = [...new Set(ingredients.map(i => i.produto_base_id))];
    console.log(`🛒 [DEBUG] IDs de produtos únicos: ${ids.length} (${ids.join(', ')})`);
    
    const marketPrices = await this.getMarketPrices(ids);
    console.log(`💲 [DEBUG] Preços encontrados no mercado: ${marketPrices.length}`);

    const ingredientCosts: IngredientCost[] = [];
    const semPreco: string[] = [];
    let totalCost = 0;

    for (const ing of ingredients) {
      console.log(`🔍 [DEBUG] Processando ingrediente: ${ing.produto_base_descricao} (ID: ${ing.produto_base_id})`);
      
      const options = marketPrices.filter(p => p.produto_base_id === ing.produto_base_id);
      console.log(`💰 [DEBUG] Opções de preço encontradas: ${options.length}`);
      
      if (!options.length) {
        console.warn(`⚠️ [DEBUG] Sem preço para: ${ing.produto_base_descricao}`);
        semPreco.push(ing.produto_base_descricao);
        continue;
      }
      
      const bestPrice = this.selectBestPrice(options);
      console.log(`✅ [DEBUG] Melhor preço selecionado: R$ ${bestPrice.preco} (promoção: ${bestPrice.em_promocao_sim_nao})`);
      
      const fator = refeicoesTotal / this.PORCOES_PADRAO;
      const qtdNec = ing.quantidade * fator;
      const qtdComprar = this.calculatePurchaseQuantity(
        qtdNec,
        bestPrice.produto_base_quantidade_embalagem,
        bestPrice.apenas_valor_inteiro_sim_nao,
        dias
      );
      const custoTotal = qtdComprar * bestPrice.preco;
      const custoUtilizado = (qtdNec / qtdComprar) * custoTotal;

      console.log(`📊 [DEBUG] Cálculo ingrediente:`, {
        nome: ing.produto_base_descricao,
        qtd_necessaria: qtdNec,
        qtd_comprar: qtdComprar,
        preco_unitario: bestPrice.preco,
        custo_total: custoTotal,
        custo_utilizado: custoUtilizado
      });

      ingredientCosts.push({
        nome: ing.produto_base_descricao,
        produto_base_id: ing.produto_base_id,
        quantidade_necessaria: qtdNec,
        quantidade_comprar: qtdComprar,
        unidade: ing.unidade,
        preco_unitario: bestPrice.preco,
        custo_total: custoTotal,
        custo_por_refeicao: custoUtilizado / refeicoesTotal,
        custo_utilizado: custoUtilizado,
        fornecedor: 'Fornecedor Padrão',
        em_promocao: bestPrice.em_promocao_sim_nao,
        sobra: qtdComprar - qtdNec,
        percentual_sobra: ((qtdComprar - qtdNec) / qtdComprar) * 100,
        compra_inteira: bestPrice.apenas_valor_inteiro_sim_nao
      });

      totalCost += custoUtilizado;
    }

    console.log(`💵 [DEBUG] Custo total da receita ${nomeReceita}: R$ ${totalCost}`);
    console.log(`⚠️ [DEBUG] Ingredientes sem preço: ${semPreco.length} (${semPreco.join(', ')})`);

    const result: RecipeCost = {
      receita_id: recipeId,
      nome: nomeReceita,
      categoria,
      porcoes_base: this.PORCOES_PADRAO,
      porcoes_calculadas: refeicoesTotal,
      ingredientes: ingredientCosts,
      ingredientes_sem_preco: semPreco,
      custo_total: totalCost,
      custo_por_porcao: totalCost / refeicoesTotal,
      dentro_orcamento: (totalCost / refeicoesTotal) <= (budgetPerServing || Infinity),
      precisao_calculo: ingredientCosts.length / (ingredients.length || 1) * 100,
      avisos: semPreco.length ? [`⚠️ ${semPreco.length} ingredientes sem preço`] : []
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /** === Funções de apoio abaixo === **/

  private async getRecipeIngredients(recipeId: number): Promise<RecipeIngredient[]> {
    console.log(`🔍 [DEBUG] Buscando ingredientes para receita ID: ${recipeId}`);
    
    const { data, error } = await this.supabase
      .from('receita_ingredientes')
      .select('*')
      .eq('receita_id_legado', recipeId.toString());
      
    console.log(`📊 [DEBUG] Query result:`, { 
      recipeId, 
      found: data?.length || 0, 
      error: error?.message,
      firstItem: data?.[0] 
    });
    
    if (error) {
      console.error(`❌ [DEBUG] Erro na query ingredientes:`, error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.warn(`⚠️ [DEBUG] Nenhum ingrediente encontrado para receita ${recipeId}`);
    }
    
    return data || [];
  }

  private async getMarketPrices(ids: number[]): Promise<MarketProduct[]> {
    console.log(`💲 [DEBUG] Buscando preços para ${ids.length} produtos: [${ids.join(', ')}]`);
    
    const { data, error } = await this.supabase
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .in('produto_base_id', ids)
      .gt('preco', 0)
      .order('preco', { ascending: true });
      
    console.log(`📊 [DEBUG] Preços encontrados:`, {
      produtos_buscados: ids.length,
      precos_encontrados: data?.length || 0,
      error: error?.message,
      sample: data?.slice(0, 3)
    });
    
    if (error) {
      console.error(`❌ [DEBUG] Erro na query preços:`, error);
      throw error;
    }
    
    return data || [];
  }

  private selectBestPrice(opts: MarketProduct[]): MarketProduct {
    const promocoes = opts.filter(o => o.em_promocao_sim_nao);
    if (promocoes.length) return promocoes.reduce((min, c) => c.preco < min.preco ? c : min);
    return opts.reduce((min, c) => c.preco < min.preco ? c : min);
  }

  private calculatePurchaseQuantity(needed: number, packageSize: number, wholeOnly: boolean, days: number): number {
    if (!wholeOnly) return needed;
    const pacotes = Math.ceil(needed / packageSize);
    if (days > 1) {
      const totalNeeded = needed * days;
      const totalPackages = Math.ceil(totalNeeded / packageSize);
      return (totalPackages * packageSize) / days;
    }
    return pacotes * packageSize;
  }

  private async consolidateShoppingList(recipes: RecipeCost[], days: number): Promise<ShoppingListItem[]> {
    console.log(`🛒 [DEBUG] Consolidando lista de compras para ${recipes.length} receitas`);
    
    const grouped = new Map<number, ShoppingListItem>();
    for (const r of recipes) {
      for (const ing of r.ingredientes) {
        if (grouped.has(ing.produto_base_id)) {
          const ex = grouped.get(ing.produto_base_id)!;
          ex.quantidade_total += ing.quantidade_comprar;
          ex.custo_total += ing.custo_total;
          ex.receitas.push(r.nome);
        } else {
          grouped.set(ing.produto_base_id, {
            produto_base_id: ing.produto_base_id,
            nome: ing.nome,
            quantidade_total: ing.quantidade_comprar,
            unidade: ing.unidade,
            preco_unitario: ing.preco_unitario,
            custo_total: ing.custo_total,
            fornecedor: ing.fornecedor,
            em_promocao: ing.em_promocao,
            receitas: [r.nome],
            observacao: ing.compra_inteira ? `Compra por ${ing.unidade} inteiro` : `Pode ser fracionado`
          });
        }
      }
    }
    
    const result = Array.from(grouped.values());
    console.log(`✅ [DEBUG] Lista de compras consolidada: ${result.length} itens únicos`);
    
    return result;
  }

  clearCache() { this.cache.clear(); }
}

// ============= FUNÇÕES EXPORTADAS =============

export async function calculateRecipeCost(recipeId: number, servings = 100, days = 1, budgetPerServing?: number) {
  return new CostCalculator().calculateRecipeCost(recipeId, servings, days, budgetPerServing);
}

export async function generateMenu(request: MenuRequest): Promise<MenuResult> {
  return new CostCalculator().generateOptimizedMenu(request);
}

export default CostCalculator;