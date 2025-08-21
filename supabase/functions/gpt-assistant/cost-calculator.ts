/**
 * Cost Calculator Module
 * Sistema de cálculo de custos para cardápios e geração de lista de compras
 * @version 1.0.0
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// ============= TIPOS E INTERFACES =============

export interface RecipeIngredient {
  receita_id_legado: number;
  nome: string; // Nome da receita
  produto_base_id: number;
  produto_base_descricao: string; // Nome do ingrediente
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
  fornecedor_nome?: string;
  unidade?: string;
}

export interface MenuRequest {
  cliente: string;
  periodo_dias: number;
  refeicoes_por_dia: number;
  orcamento_por_refeicao: number;
  receitas_fixas?: number[]; // IDs das receitas obrigatórias (arroz, feijão)
  receitas_sugeridas?: number[]; // IDs de outras receitas desejadas
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
  custo_utilizado: number; // Custo apenas do que será usado
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
  porcoes_base: number; // Sempre 100
  porcoes_calculadas: number; // Quantidade real
  ingredientes: IngredientCost[];
  ingredientes_sem_preco: string[]; // Lista de ingredientes não encontrados
  custo_total: number;
  custo_por_porcao: number;
  dentro_orcamento: boolean;
  precisao_calculo: number; // % de ingredientes com preço encontrado
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
  receitas: string[]; // Quais receitas usam este item
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
  ARROZ: 580,
  FEIJAO: 581, // Assumindo ID do feijão
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
  }

  /**
   * Método principal para gerar cardápio completo com custos
   */
  async generateOptimizedMenu(request: MenuRequest): Promise<MenuResult> {
    const startTime = Date.now();
    console.log(`\n🍽️ ===== INICIANDO GERAÇÃO DE CARDÁPIO =====`);
    console.log(`📊 Cliente: ${request.cliente}`);
    console.log(`📅 Período: ${request.periodo_dias} dia(s)`);
    console.log(`🍴 Refeições: ${request.refeicoes_por_dia}/dia (Total: ${request.refeicoes_por_dia * request.periodo_dias})`);
    console.log(`💰 Orçamento: R$ ${request.orcamento_por_refeicao.toFixed(2)}/refeição`);
    
    const totalRefeicoes = request.refeicoes_por_dia * request.periodo_dias;
    const orcamentoTotal = totalRefeicoes * request.orcamento_por_refeicao;
    
    // 1. Preparar IDs das receitas fixas (sempre arroz e feijão)
    const receitasFixasIds = request.receitas_fixas || [RECIPE_IDS.ARROZ, RECIPE_IDS.FEIJAO];
    
    // 2. Calcular custos das receitas fixas
    console.log(`\n📌 Calculando receitas fixas...`);
    const receitasFixas: RecipeCost[] = [];
    
    for (const receitaId of receitasFixasIds) {
      try {
        const custo = await this.calculateRecipeCost(
          receitaId,
          request.refeicoes_por_dia,
          request.periodo_dias
        );
        receitasFixas.push(custo);
        console.log(`  ✅ ${custo.nome}: R$ ${custo.custo_por_porcao.toFixed(2)}/porção`);
      } catch (error) {
        console.error(`  ❌ Erro ao calcular receita ${receitaId}:`, error.message);
      }
    }
    
    // 3. Calcular orçamento restante
    const custoFixoTotal = receitasFixas.reduce((sum, r) => sum + r.custo_por_porcao, 0);
    const orcamentoRestante = request.orcamento_por_refeicao - custoFixoTotal;
    
    console.log(`\n💵 Resumo de custos fixos:`);
    console.log(`  • Custo fixo total: R$ ${custoFixoTotal.toFixed(2)}/refeição`);
    console.log(`  • Orçamento restante: R$ ${orcamentoRestante.toFixed(2)}/refeição`);
    
    // 4. Calcular receitas sugeridas (se houver)
    const receitasPrincipais: RecipeCost[] = [];
    
    if (request.receitas_sugeridas && request.receitas_sugeridas.length > 0) {
      console.log(`\n🍖 Calculando receitas principais...`);
      
      for (const receitaId of request.receitas_sugeridas) {
        try {
          const custo = await this.calculateRecipeCost(
            receitaId,
            request.refeicoes_por_dia,
            request.periodo_dias
          );
          
          // Verificar se cabe no orçamento restante
          if (custo.custo_por_porcao <= orcamentoRestante) {
            receitasPrincipais.push(custo);
            console.log(`  ✅ ${custo.nome}: R$ ${custo.custo_por_porcao.toFixed(2)}/porção`);
          } else {
            console.log(`  ⚠️ ${custo.nome}: R$ ${custo.custo_por_porcao.toFixed(2)}/porção (acima do orçamento)`);
          }
        } catch (error) {
          console.error(`  ❌ Erro ao calcular receita ${receitaId}:`, error.message);
        }
      }
    }
    
    // 5. Consolidar lista de compras
    console.log(`\n🛒 Consolidando lista de compras...`);
    const listaCompras = await this.consolidateShoppingList(
      [...receitasFixas, ...receitasPrincipais],
      request.periodo_dias
    );
    
    // 6. Calcular totais
    const custoTotalCalculado = [...receitasFixas, ...receitasPrincipais]
      .reduce((sum, r) => sum + r.custo_total, 0);
    
    const custoPorRefeicao = custoTotalCalculado / totalRefeicoes;
    const economia = orcamentoTotal - custoTotalCalculado;
    const economiaPercentual = (economia / orcamentoTotal) * 100;
    
    // 7. Coletar avisos
    const avisos: string[] = [];
    const todasReceitas = [...receitasFixas, ...receitasPrincipais];
    
    for (const receita of todasReceitas) {
      if (receita.ingredientes_sem_preco.length > 0) {
        avisos.push(`⚠️ ${receita.nome}: ${receita.ingredientes_sem_preco.length} ingrediente(s) sem preço`);
      }
      avisos.push(...receita.avisos);
    }
    
    // 8. Calcular precisão geral
    const totalIngredientes = todasReceitas.reduce((sum, r) => sum + r.ingredientes.length, 0);
    const ingredientesComPreco = todasReceitas.reduce(
      (sum, r) => sum + r.ingredientes.filter(i => i.preco_unitario > 0).length, 0
    );
    const precisaoGeral = totalIngredientes > 0 ? (ingredientesComPreco / totalIngredientes) * 100 : 0;
    
    // 9. Montar resultado final
    const result: MenuResult = {
      cliente: request.cliente,
      periodo: `${request.periodo_dias} dia${request.periodo_dias > 1 ? 's' : ''}`,
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date(Date.now() + (request.periodo_dias - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_refeicoes: totalRefeicoes,
      refeicoes_por_dia: request.refeicoes_por_dia,
      orcamento_total: orcamentoTotal,
      orcamento_por_refeicao: request.orcamento_por_refeicao,
      
      receitas: {
        fixas: receitasFixas,
        principais: receitasPrincipais,
        acompanhamentos: []
      },
      
      resumo_custos: {
        custo_total_calculado: custoTotalCalculado,
        custo_por_refeicao: custoPorRefeicao,
        economia_total: economia,
        economia_percentual: economiaPercentual,
        dentro_orcamento: custoPorRefeicao <= request.orcamento_por_refeicao
      },
      
      lista_compras: {
        itens: listaCompras,
        total_itens: listaCompras.length,
        custo_total: listaCompras.reduce((sum, item) => sum + item.custo_total, 0),
        itens_promocao: listaCompras.filter(item => item.em_promocao).length,
        economia_promocoes: listaCompras
          .filter(item => item.em_promocao)
          .reduce((sum, item) => sum + (item.custo_total * 0.1), 0) // Assumindo 10% de desconto
      },
      
      avisos: [...new Set(avisos)], // Remove duplicados
      
      metadata: {
        generated_at: new Date().toISOString(),
        calculation_time_ms: Date.now() - startTime,
        precision_percentage: precisaoGeral
      }
    };
    
    // Log final
    console.log(`\n✨ ===== CARDÁPIO GERADO COM SUCESSO =====`);
    console.log(`💰 Custo total: R$ ${custoTotalCalculado.toFixed(2)}`);
    console.log(`📊 Custo por refeição: R$ ${custoPorRefeicao.toFixed(2)}`);
    console.log(`✅ Economia: R$ ${economia.toFixed(2)} (${economiaPercentual.toFixed(1)}%)`);
    console.log(`⏱️ Tempo de cálculo: ${Date.now() - startTime}ms`);
    
    return result;
  }

  /**
   * Calcula o custo de uma receita específica
   */
  async calculateRecipeCost(
    recipeId: number,
    refeicoesTotal: number,
    dias: number = 1
  ): Promise<RecipeCost> {
    const cacheKey = `recipe-${recipeId}-${refeicoesTotal}-${dias}`;
    
    // Verificar cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // 1. Buscar ingredientes da receita
    const ingredients = await this.getRecipeIngredients(recipeId);
    
    if (!ingredients || ingredients.length === 0) {
      throw new Error(`Receita ${recipeId} não encontrada ou sem ingredientes`);
    }
    
    const nomeReceita = ingredients[0]?.nome || `Receita ${recipeId}`;
    const categoria = ingredients[0]?.categoria_descricao || 'Geral';
    
    // 2. Buscar preços de mercado para todos os ingredientes
    const uniqueProductIds = [...new Set(ingredients.map(i => i.produto_base_id))];
    const marketPrices = await this.getMarketPrices(uniqueProductIds);
    
    // 3. Calcular custos de cada ingrediente
    const ingredientCosts: IngredientCost[] = [];
    const ingredientesSemPreco: string[] = [];
    let totalCost = 0;
    
    for (const ingredient of ingredients) {
      // Encontrar opções de preço para este ingrediente
      const marketOptions = marketPrices.filter(
        p => p.produto_base_id === ingredient.produto_base_id
      );
      
      if (marketOptions.length === 0) {
        console.warn(`  ⚠️ Sem preço para: ${ingredient.produto_base_descricao} (ID: ${ingredient.produto_base_id})`);
        ingredientesSemPreco.push(ingredient.produto_base_descricao);
        continue;
      }
      
      // Selecionar melhor preço (promoção ou mais barato)
      const bestPrice = this.selectBestPrice(marketOptions);
      
      // Calcular quantidade necessária (escalar de 100 porções para quantidade real)
      const fatorEscala = refeicoesTotal / this.PORCOES_PADRAO;
      const qtdNecessaria = ingredient.quantidade * fatorEscala;
      
      // Calcular quantidade a comprar (considerando embalagem inteira se necessário)
      const qtdComprar = this.calculatePurchaseQuantity(
        qtdNecessaria,
        bestPrice.produto_base_quantidade_embalagem,
        bestPrice.apenas_valor_inteiro_sim_nao,
        dias
      );
      
      // Calcular custos
      const custoTotal = qtdComprar * bestPrice.preco;
      const custoUtilizado = (qtdNecessaria / qtdComprar) * custoTotal;
      const sobra = qtdComprar - qtdNecessaria;
      const percentualSobra = (sobra / qtdComprar) * 100;
      
      ingredientCosts.push({
        nome: ingredient.produto_base_descricao,
        produto_base_id: ingredient.produto_base_id,
        quantidade_necessaria: qtdNecessaria,
        quantidade_comprar: qtdComprar,
        unidade: ingredient.unidade,
        preco_unitario: bestPrice.preco,
        custo_total: custoTotal,
        custo_por_refeicao: custoUtilizado / refeicoesTotal,
        custo_utilizado: custoUtilizado,
        fornecedor: bestPrice.fornecedor_nome || 'Fornecedor',
        em_promocao: bestPrice.em_promocao_sim_nao,
        sobra: sobra,
        percentual_sobra: percentualSobra,
        compra_inteira: bestPrice.apenas_valor_inteiro_sim_nao
      });
      
      totalCost += custoUtilizado;
    }
    
    // 4. Montar avisos
    const avisos: string[] = [];
    
    // Avisar sobre ingredientes com muita sobra
    const ingredientesComMuitaSobra = ingredientCosts.filter(i => i.percentual_sobra > 50);
    if (ingredientesComMuitaSobra.length > 0) {
      avisos.push(`💡 ${ingredientesComMuitaSobra.length} ingrediente(s) com sobra > 50%`);
    }
    
    // 5. Calcular precisão do cálculo
    const totalIngredientes = ingredients.length;
    const ingredientesComPreco = ingredientCosts.length;
    const precisao = totalIngredientes > 0 ? (ingredientesComPreco / totalIngredientes) * 100 : 0;
    
    const result: RecipeCost = {
      receita_id: recipeId,
      nome: nomeReceita,
      categoria: categoria,
      porcoes_base: this.PORCOES_PADRAO,
      porcoes_calculadas: refeicoesTotal,
      ingredientes: ingredientCosts,
      ingredientes_sem_preco: ingredientesSemPreco,
      custo_total: totalCost,
      custo_por_porcao: totalCost / refeicoesTotal,
      dentro_orcamento: (totalCost / refeicoesTotal) <= 9.00, // Usar orçamento padrão
      precisao_calculo: precisao,
      avisos: avisos
    };
    
    // Salvar no cache
    this.cache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Busca ingredientes de uma receita
   */
  private async getRecipeIngredients(recipeId: number): Promise<RecipeIngredient[]> {
    const { data, error } = await this.supabase
      .from('receita_ingredientes')
      .select(`
        receita_id_legado,
        nome,
        produto_base_id,
        produto_base_descricao,
        quantidade,
        unidade,
        categoria_descricao
      `)
      .eq('receita_id_legado', recipeId);
    
    if (error) {
      console.error('Erro ao buscar ingredientes:', error);
      throw error;
    }
    
    return data || [];
  }

  /**
   * Busca preços de mercado
   */
  private async getMarketPrices(productIds: number[]): Promise<MarketProduct[]> {
    const { data, error } = await this.supabase
      .from('co_solicitacao_produto_listagem')
      .select(`
        produto_base_id,
        descricao,
        preco,
        produto_base_quantidade_embalagem,
        apenas_valor_inteiro_sim_nao,
        em_promocao_sim_nao,
        fornecedor_nome,
        unidade
      `)
      .in('produto_base_id', productIds)
      .gt('preco', 0)
      .order('preco', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar preços:', error);
      throw error;
    }
    
    return data || [];
  }

  /**
   * Seleciona o melhor preço entre as opções
   */
  private selectBestPrice(options: MarketProduct[]): MarketProduct {
    // 1. Priorizar produtos em promoção
    const promocoes = options.filter(o => o.em_promocao_sim_nao);
    if (promocoes.length > 0) {
      return promocoes.reduce((min, curr) => 
        curr.preco < min.preco ? curr : min
      );
    }
    
    // 2. Se não houver promoções, pegar o mais barato
    return options.reduce((min, curr) => 
      curr.preco < min.preco ? curr : min
    );
  }

  /**
   * Calcula quantidade a comprar considerando embalagens
   */
  private calculatePurchaseQuantity(
    needed: number,
    packageSize: number,
    wholeOnly: boolean,
    days: number
  ): number {
    // Se pode comprar fracionado, retorna exatamente o necessário
    if (!wholeOnly) {
      return needed;
    }
    
    // Precisa comprar embalagem inteira
    const packagesNeeded = Math.ceil(needed / packageSize);
    
    // Para múltiplos dias, verificar se vale a pena otimizar a compra
    if (days > 1) {
      const totalNeededAllDays = needed * days;
      const totalPackages = Math.ceil(totalNeededAllDays / packageSize);
      
      // Se a quantidade total para todos os dias resulta em menos desperdício
      // retornar a quantidade dividida pelos dias
      if ((totalPackages * packageSize - totalNeededAllDays) < (packagesNeeded * packageSize - needed)) {
        return (totalPackages * packageSize) / days;
      }
    }
    
    return packagesNeeded * packageSize;
  }

  /**
   * Consolida lista de compras de várias receitas
   */
  private async consolidateShoppingList(
    recipes: RecipeCost[],
    days: number
  ): Promise<ShoppingListItem[]> {
    const consolidated = new Map<number, ShoppingListItem>();
    
    // Agrupar ingredientes por produto_base_id
    for (const recipe of recipes) {
      for (const ing of recipe.ingredientes) {
        const key = ing.produto_base_id;
        
        if (consolidated.has(key)) {
          const existing = consolidated.get(key)!;
          existing.quantidade_total += ing.quantidade_comprar;
          existing.custo_total += ing.custo_total;
          existing.receitas.push(recipe.nome);
        } else {
          consolidated.set(key, {
            produto_base_id: ing.produto_base_id,
            nome: ing.nome,
            quantidade_total: ing.quantidade_comprar,
            unidade: ing.unidade,
            preco_unitario: ing.preco_unitario,
            custo_total: ing.custo_total,
            fornecedor: ing.fornecedor,
            em_promocao: ing.em_promocao,
            receitas: [recipe.nome],
            observacao: ing.compra_inteira ? 
              `Compra por ${ing.unidade} inteiro` : 
              `Pode ser fracionado`
          });
        }
      }
    }
    
    // Converter para array e ordenar por custo (maior primeiro)
    const items = Array.from(consolidated.values())
      .sort((a, b) => b.custo_total - a.custo_total);
    
    // Adicionar observações especiais
    for (const item of items) {
      // Se usado em múltiplas receitas
      if (item.receitas.length > 1) {
        item.observacao = `${item.observacao || ''} | Usado em: ${item.receitas.join(', ')}`.trim();
      }
      
      // Se está em promoção
      if (item.em_promocao) {
        item.observacao = `🏷️ EM PROMOÇÃO! ${item.observacao || ''}`.trim();
      }
      
      // Arredondar valores
      item.quantidade_total = Math.round(item.quantidade_total * 1000) / 1000; // 3 decimais
      item.custo_total = Math.round(item.custo_total * 100) / 100; // 2 decimais
    }
    
    return items;
  }

  /**
   * Converte unidades para padrão (KG para peso, L para volume)
   */
  private convertToStandardUnit(value: number, unit: string): number {
    const upperUnit = unit.toUpperCase();
    const factor = UNITS_CONVERSION[upperUnit] || 1;
    return value * factor;
  }

  /**
   * Limpa o cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('📭 Cache limpo');
  }

  /**
   * Busca receitas dentro do orçamento
   */
  async findRecipesWithinBudget(
    maxCostPerServing: number,
    servings: number = 100
  ): Promise<RecipeCost[]> {
    console.log(`🔍 Buscando receitas até R$ ${maxCostPerServing.toFixed(2)}/porção...`);
    
    // Buscar todas as receitas disponíveis
    const { data: recipes, error } = await this.supabase
      .from('receitas_legado')
      .select('receita_id_legado')
      .eq('inativa', false)
      .limit(50);
    
    if (error) throw error;
    
    const recipesWithinBudget: RecipeCost[] = [];
    
    for (const recipe of recipes || []) {
      try {
        const cost = await this.calculateRecipeCost(recipe.receita_id_legado, servings, 1);
        if (cost.custo_por_porcao <= maxCostPerServing) {
          recipesWithinBudget.push(cost);
        }
      } catch (err) {
        console.error(`Erro ao calcular receita ${recipe.receita_id_legado}:`, err.message);
      }
    }
    
    // Ordenar por custo (mais barato primeiro)
    recipesWithinBudget.sort((a, b) => a.custo_por_porcao - b.custo_por_porcao);
    
    console.log(`✅ Encontradas ${recipesWithinBudget.length} receitas dentro do orçamento`);
    
    return recipesWithinBudget;
  }
}

// ============= FUNÇÕES AUXILIARES DE EXPORTAÇÃO =============

/**
 * Função simplificada para calcular custo de uma receita
 */
export async function calculateRecipeCost(
  recipeId: number,
  servings: number = 100,
  days: number = 1
): Promise<RecipeCost> {
  const calculator = new CostCalculator();
  return await calculator.calculateRecipeCost(recipeId, servings, days);
}

/**
 * Função simplificada para gerar cardápio completo
 */
export async function generateMenu(request: MenuRequest): Promise<MenuResult> {
  const calculator = new CostCalculator();
  return await calculator.generateOptimizedMenu(request);
}

/**
 * Função para normalizar nome do ingrediente
 */
export function normalizeIngredientName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
    .replace(/\s+em\s+pó/gi, ' po')
    .replace(/\s+em\s+/gi, ' ')
    .replace(/[^\w\s]/g, ' ')  // Remove caracteres especiais
    .replace(/\s+/g, ' ')
    .trim();
}

// ============= EXPORTAÇÃO PADRÃO =============

export default CostCalculator;