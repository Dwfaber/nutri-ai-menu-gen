import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MenuDay {
  date: string;
  recipes: Array<{
    receita_id: string;
    nome: string;
    meals_quantity: number;
  }>;
}

interface IngredientAggregate {
  produto_base_id: number;
  nome: string;
  total_quantity_needed: number;
  unidade: string;
  daily_usage: Array<{
    date: string;
    quantity: number;
  }>;
}

interface PackagingInfo {
  produto_base_id: number;
  descricao: string;
  quantidade_embalagem: number;
  preco: number;
  preco_compra: number;
  apenas_valor_inteiro: boolean;
  em_promocao: boolean;
}

interface OptimizedPurchase {
  produto_base_id: number;
  nome: string;
  total_needed: number;
  packages_to_buy: number;
  total_quantity_bought: number;
  total_cost: number;
  cost_per_unit: number;
  surplus: number;
  packaging_info: PackagingInfo;
  daily_distribution: Array<{
    date: string;
    quantity_used: number;
    cost_allocated: number;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { menu_days, total_meals } = await req.json();

    console.log(`🚀 Iniciando otimização para ${menu_days.length} dias, ${total_meals} refeições totais`);

    // 1. Agregar todos os ingredientes necessários
    const ingredientAggregates = await aggregateIngredients(supabase, menu_days);
    console.log(`📊 Agregados ${ingredientAggregates.length} ingredientes únicos`);

    // 2. Buscar informações de embalagens para cada ingrediente
    const packagingInfo = await getPackagingInfo(supabase, ingredientAggregates);
    console.log(`📦 Informações de embalagem obtidas para ${packagingInfo.length} produtos`);

    // 3. Otimizar compras considerando embalagens
    const optimizedPurchases = optimizePurchases(ingredientAggregates, packagingInfo);
    console.log(`✅ Otimização concluída para ${optimizedPurchases.length} produtos`);

    // 4. Calcular custos finais
    const summary = calculateOptimizationSummary(optimizedPurchases, total_meals);

    return new Response(JSON.stringify({
      success: true,
      optimized_purchases: optimizedPurchases,
      summary: summary,
      total_meals: total_meals
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na otimização:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function aggregateIngredients(supabase: any, menuDays: MenuDay[]): Promise<IngredientAggregate[]> {
  const aggregates = new Map<number, IngredientAggregate>();

  for (const day of menuDays) {
    console.log(`📅 Processando dia ${day.date} com ${day.recipes.length} receitas`);
    
    for (const recipe of day.recipes) {
      // Buscar ingredientes da receita
      const { data: ingredientes } = await supabase
        .from('receita_ingredientes')
        .select('*')
        .eq('receita_id_legado', recipe.receita_id);

      if (!ingredientes || ingredientes.length === 0) {
        console.log(`⚠️ Nenhum ingrediente encontrado para receita ${recipe.receita_id}`);
        continue;
      }

      for (const ingrediente of ingredientes) {
        if (!ingrediente.produto_base_id) continue;

        const baseId = ingrediente.produto_base_id;
        const quantityForMeals = (ingrediente.quantidade || 0) * (recipe.meals_quantity / (ingrediente.quantidade_refeicoes || 1));

        if (!aggregates.has(baseId)) {
          aggregates.set(baseId, {
            produto_base_id: baseId,
            nome: ingrediente.nome || ingrediente.produto_base_descricao || `Produto ${baseId}`,
            total_quantity_needed: 0,
            unidade: ingrediente.unidade || 'kg',
            daily_usage: []
          });
        }

        const aggregate = aggregates.get(baseId)!;
        aggregate.total_quantity_needed += quantityForMeals;
        
        // Adicionar ou atualizar uso diário
        const dailyUsage = aggregate.daily_usage.find(d => d.date === day.date);
        if (dailyUsage) {
          dailyUsage.quantity += quantityForMeals;
        } else {
          aggregate.daily_usage.push({
            date: day.date,
            quantity: quantityForMeals
          });
        }
      }
    }
  }

  return Array.from(aggregates.values());
}

async function getPackagingInfo(supabase: any, aggregates: IngredientAggregate[]): Promise<PackagingInfo[]> {
  const packagingInfo: PackagingInfo[] = [];

  for (const aggregate of aggregates) {
    // Buscar melhor opção de embalagem para o produto
    const { data: produtos } = await supabase
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .eq('produto_base_id', aggregate.produto_base_id)
      .order('preco', { ascending: true });

    if (produtos && produtos.length > 0) {
      // Priorizar promoções, depois menor preço por unidade
      const bestProduct = produtos.sort((a, b) => {
        if (a.em_promocao_sim_nao && !b.em_promocao_sim_nao) return -1;
        if (!a.em_promocao_sim_nao && b.em_promocao_sim_nao) return 1;
        
        const precoA = a.preco_compra || a.preco || 0;
        const precoB = b.preco_compra || b.preco || 0;
        const custoUnitA = precoA / (a.produto_base_quantidade_embalagem || 1);
        const custoUnitB = precoB / (b.produto_base_quantidade_embalagem || 1);
        
        return custoUnitA - custoUnitB;
      })[0];

      packagingInfo.push({
        produto_base_id: aggregate.produto_base_id,
        descricao: bestProduct.descricao || aggregate.nome,
        quantidade_embalagem: bestProduct.produto_base_quantidade_embalagem || 1,
        preco: bestProduct.preco || 0,
        preco_compra: bestProduct.preco_compra || bestProduct.preco || 0,
        apenas_valor_inteiro: bestProduct.apenas_valor_inteiro_sim_nao || false,
        em_promocao: bestProduct.em_promocao_sim_nao || false
      });
    }
  }

  return packagingInfo;
}

function optimizePurchases(aggregates: IngredientAggregate[], packagingInfo: PackagingInfo[]): OptimizedPurchase[] {
  const optimized: OptimizedPurchase[] = [];

  for (const aggregate of aggregates) {
    const packaging = packagingInfo.find(p => p.produto_base_id === aggregate.produto_base_id);
    
    if (!packaging) {
      console.log(`⚠️ Embalagem não encontrada para produto ${aggregate.produto_base_id}`);
      continue;
    }

    // Calcular quantidade de embalagens necessárias
    const packagesNeeded = Math.ceil(aggregate.total_quantity_needed / packaging.quantidade_embalagem);
    const totalQuantityBought = packagesNeeded * packaging.quantidade_embalagem;
    const surplus = totalQuantityBought - aggregate.total_quantity_needed;
    const totalCost = packagesNeeded * packaging.preco_compra;
    const costPerUnit = totalCost / aggregate.total_quantity_needed;

    // Distribuir custo pelos dias proporcionalmente
    const dailyDistribution = aggregate.daily_usage.map(day => ({
      date: day.date,
      quantity_used: day.quantity,
      cost_allocated: (day.quantity / aggregate.total_quantity_needed) * totalCost
    }));

    optimized.push({
      produto_base_id: aggregate.produto_base_id,
      nome: aggregate.nome,
      total_needed: aggregate.total_quantity_needed,
      packages_to_buy: packagesNeeded,
      total_quantity_bought: totalQuantityBought,
      total_cost: totalCost,
      cost_per_unit: costPerUnit,
      surplus: surplus,
      packaging_info: packaging,
      daily_distribution: dailyDistribution
    });

    console.log(`📦 ${aggregate.nome}: ${aggregate.total_quantity_needed.toFixed(2)}${aggregate.unidade} → ${packagesNeeded} embalagens → R$ ${totalCost.toFixed(2)}`);
  }

  return optimized;
}

function calculateOptimizationSummary(purchases: OptimizedPurchase[], totalMeals: number) {
  const totalCost = purchases.reduce((sum, p) => sum + p.total_cost, 0);
  const costPerMeal = totalCost / totalMeals;
  const totalSurplus = purchases.reduce((sum, p) => sum + p.surplus, 0);
  const promotionalItems = purchases.filter(p => p.packaging_info.em_promocao).length;
  
  // Calcular economia estimada vs compra diária individual
  const estimatedIndividualCost = purchases.reduce((sum, p) => {
    // Simular compra diária sem otimização
    const dailyCosts = p.daily_distribution.map(day => {
      const packagesPerDay = Math.ceil(day.quantity_used / p.packaging_info.quantidade_embalagem);
      return packagesPerDay * p.packaging_info.preco_compra;
    });
    return sum + dailyCosts.reduce((a, b) => a + b, 0);
  }, 0);

  const savings = estimatedIndividualCost - totalCost;
  const savingsPercentage = estimatedIndividualCost > 0 ? (savings / estimatedIndividualCost) * 100 : 0;

  return {
    total_cost: totalCost,
    cost_per_meal: costPerMeal,
    total_meals: totalMeals,
    total_products: purchases.length,
    promotional_items: promotionalItems,
    estimated_savings: savings,
    savings_percentage: savingsPercentage,
    surplus_info: {
      total_surplus: totalSurplus,
      products_with_surplus: purchases.filter(p => p.surplus > 0).length
    }
  };
}