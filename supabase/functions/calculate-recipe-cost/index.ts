import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Unit conversion constants
const UNIDADE_CONVERSIONS: Record<string, Record<string, number>> = {
  weight: {
    g: 0.001, kg: 1, t: 1000,
    gr: 0.001, grama: 0.001, gramas: 0.001,
    quilo: 1, quilos: 1, kilo: 1, kilos: 1
  },
  volume: {
    ml: 0.001, l: 1, litro: 1, litros: 1,
    cc: 0.001, cm3: 0.001
  },
  units: {
    un: 1, und: 1, unidade: 1, unidades: 1,
    pc: 1, peca: 1, pecas: 1, peça: 1, peças: 1,
    cx: 1, caixa: 1, caixas: 1
  }
};

function convertToMercadoBase(quantidade: number, unidadeOrigem: string, unidadeDestino: string): number {
  const origem = unidadeOrigem?.toLowerCase().trim() || '';
  const destino = unidadeDestino?.toLowerCase().trim() || '';
  
  if (origem === destino) return quantidade;
  
  for (const [_, conversions] of Object.entries(UNIDADE_CONVERSIONS)) {
    if (conversions[origem] && conversions[destino]) {
      return quantidade * (conversions[origem] / conversions[destino]);
    }
  }
  
  return quantidade;
}

function calculateSimilarityScore(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(word => words2.some(w => w.includes(word) || word.includes(w)));
  
  return commonWords.length / Math.max(words1.length, words2.length);
}

function findProductByName(nomeBusca: string, produtos: any[]): any[] {
  return produtos
    .map(produto => ({
      ...produto,
      similarity: calculateSimilarityScore(nomeBusca, produto.descricao || '')
    }))
    .filter(produto => produto.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity);
}

interface IngredientCostResult {
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

async function calculateIngredientCost(
  supabase: any,
  ingrediente: any,
  mealQuantity: number = 50
): Promise<IngredientCostResult> {
  const nomeIngrediente = ingrediente.nome || ingrediente.produto_base_descricao || '';
  
  // Buscar produtos disponíveis
  const { data: produtos } = await supabase
    .from('co_solicitacao_produto_listagem')
    .select('*')
    .order('em_promocao_sim_nao', { ascending: false })
    .order('preco', { ascending: true });
  
  if (!produtos || produtos.length === 0) {
    throw new Error('Nenhum produto disponível na base de dados');
  }
  
  // Encontrar melhor produto
  const produtosEncontrados = findProductByName(nomeIngrediente, produtos);
  
  if (produtosEncontrados.length === 0) {
    throw new Error(`Produto não encontrado: ${nomeIngrediente}`);
  }
  
  const melhorProduto = produtosEncontrados[0];
  
  // Escalar quantidade para o número de refeições
  const quantidadeBase = Number(ingrediente.quantidade) || 0;
  const receitaBaseRefeicoes = Number(ingrediente.quantidade_refeicoes) || 50;
  const fatorEscala = mealQuantity / receitaBaseRefeicoes;
  const quantidadeNecessaria = quantidadeBase * fatorEscala;
  
  // Converter unidades se necessário
  const unidadeIngrediente = ingrediente.unidade || 'kg';
  const unidadeProduto = melhorProduto.unidade || 'kg';
  const quantidadeConvertida = convertToMercadoBase(quantidadeNecessaria, unidadeIngrediente, unidadeProduto);
  
  // Aplicar regras de embalagem
  const quantidadeEmbalagem = Number(melhorProduto.produto_base_quantidade_embalagem) || 1;
  const apenasInteiroSN = melhorProduto.apenas_valor_inteiro_sim_nao || false;
  
  let quantidadeComprar = quantidadeConvertida;
  let compraInteira = false;
  
  if (apenasInteiroSN) {
    quantidadeComprar = Math.ceil(quantidadeConvertida / quantidadeEmbalagem) * quantidadeEmbalagem;
    compraInteira = true;
  }
  
  // Calcular custos
  const precoUnitario = Number(melhorProduto.preco) || 0;
  const custoTotal = quantidadeComprar * precoUnitario;
  const custoUtilizado = quantidadeConvertida * precoUnitario;
  const custoPorRefeicao = custoUtilizado / mealQuantity;
  const sobra = quantidadeComprar - quantidadeConvertida;
  const percentualSobra = quantidadeComprar > 0 ? (sobra / quantidadeComprar) * 100 : 0;
  
  return {
    nome: nomeIngrediente,
    produto_base_id: melhorProduto.produto_base_id || 0,
    quantidade_necessaria: quantidadeConvertida,
    quantidade_comprar: quantidadeComprar,
    unidade: unidadeProduto,
    preco_unitario: precoUnitario,
    custo_total: custoTotal,
    custo_por_refeicao: custoPorRefeicao,
    custo_utilizado: custoUtilizado,
    fornecedor: melhorProduto.grupo || 'Não especificado',
    em_promocao: melhorProduto.em_promocao_sim_nao || false,
    sobra: sobra,
    percentual_sobra: percentualSobra,
    compra_inteira: compraInteira
  };
}

async function calculateRecipeCost(supabase: any, receitaId: string, mealQuantity: number = 50) {
  console.log(`🔍 Buscando receita ID: ${receitaId}`);
  
  // Buscar receita
  const { data: receita, error: receitaError } = await supabase
    .from('receitas_legado')
    .select('*')
    .eq('receita_id_legado', receitaId)
    .single();
  
  if (receitaError) {
    console.error(`❌ Erro ao buscar receita ${receitaId}:`, receitaError);
  }
  
  if (!receita) {
    // Se for item base injetado, usar custo estimado
    if (receitaId.startsWith('base-injected-')) {
      console.log(`🟡 Item base injetado detectado: ${receitaId}`);
      return {
        receita_id: receitaId,
        nome: `Item Base ${receitaId}`,
        categoria: 'Base',
        porcoes_base: 50,
        porcoes_calculadas: mealQuantity,
        ingredientes: [],
        custo_total: 0.85 * mealQuantity,
        custo_por_porcao: 0.85,
        total_ingredientes: 0,
        metadata: {
          generated_at: new Date().toISOString(),
          meal_quantity: mealQuantity,
          fallback_used: true
        }
      };
    }
    
    throw new Error(`Receita não encontrada: ${receitaId}`);
  }
  
  // Buscar ingredientes da receita
  const { data: ingredientes, error: ingredientesError } = await supabase
    .from('receita_ingredientes')
    .select('*')
    .eq('receita_id_legado', receitaId);
  
  if (ingredientesError) {
    console.error(`❌ Erro ao buscar ingredientes para receita ${receitaId}:`, ingredientesError);
  }
  
  if (!ingredientes || ingredientes.length === 0) {
    console.warn(`⚠️ Nenhum ingrediente encontrado para receita: ${receitaId}`);
    
    // Estimar custo baseado no tipo de receita quando não há ingredientes
    const custoEstimado = receita.categoria_descricao?.toLowerCase().includes('proteí') ? 3.25 : 2.15;
    
    return {
      receita_id: receitaId,
      nome: receita.nome_receita,
      categoria: receita.categoria_descricao,
      porcoes_base: receita.porcoes || 50,
      porcoes_calculadas: mealQuantity,
      ingredientes: [],
      custo_total: custoEstimado * mealQuantity,
      custo_por_porcao: custoEstimado,
      total_ingredientes: 0,
      metadata: {
        generated_at: new Date().toISOString(),
        meal_quantity: mealQuantity,
        estimated_cost: true,
        reason: 'No ingredients found'
      }
    };
  }
  
  console.log(`Calculando custos para receita ${receita.nome_receita} (${ingredientes.length} ingredientes)`);
  
  // Calcular custo de cada ingrediente
  const ingredientesComCusto = [];
  let custoTotal = 0;
  
  for (const ingrediente of ingredientes) {
    try {
      const custoIngrediente = await calculateIngredientCost(supabase, ingrediente, mealQuantity);
      ingredientesComCusto.push(custoIngrediente);
      custoTotal += custoIngrediente.custo_utilizado;
    } catch (error) {
      console.error(`Erro ao calcular ingrediente ${ingrediente.nome}:`, error);
      // Continuar com outros ingredientes
    }
  }
  
  const custoPorRefeicao = custoTotal / mealQuantity;
  
  return {
    receita_id: receitaId,
    nome: receita.nome_receita,
    categoria: receita.categoria_descricao,
    porcoes_base: receita.porcoes || 50,
    porcoes_calculadas: mealQuantity,
    ingredientes: ingredientesComCusto,
    custo_total: custoTotal,
    custo_por_porcao: custoPorRefeicao,
    total_ingredientes: ingredientesComCusto.length,
    metadata: {
      generated_at: new Date().toISOString(),
      meal_quantity: mealQuantity
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { receita_id, meal_quantity = 50 } = await req.json();

    if (!receita_id) {
      throw new Error('receita_id é obrigatório');
    }

    console.log(`Calculando custo da receita ${receita_id} para ${meal_quantity} refeições`);

    const result = await calculateRecipeCost(supabase, receita_id, meal_quantity);

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro no cálculo de custos:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});