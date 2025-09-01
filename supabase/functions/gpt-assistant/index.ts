import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'healthy', 
        version: 'PRODUCAO-CUSTO-REAL-v1.0',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const startTime = Date.now();
    const requestData = await req.json();
    
    console.log('📥 REQUEST:', requestData.action, requestData.filialIdLegado || 'sem filial');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ============ CÁLCULO DE CUSTO DE RECEITA ============
    async function calculateRecipeCost(recipeId, mealQuantity = 100) {
      console.log(`🧮 Calculando custo da receita ${recipeId} para ${mealQuantity} refeições`);
      
      try {
        // 1. Buscar ingredientes da receita
        const { data: ingredients, error: ingError } = await supabase
          .from('receita_ingredientes')
          .select(`
            receita_id_legado,
            nome,
            produto_base_id,
            produto_base_descricao,
            quantidade,
            unidade,
            quantidade_refeicoes
          `)
          .eq('receita_id_legado', recipeId);
        
        if (ingError) {
          console.error('❌ Erro ao buscar ingredientes:', ingError);
          throw ingError;
        }
        
        if (!ingredients || ingredients.length === 0) {
          console.warn(`⚠️ Receita ${recipeId} sem ingredientes`);
          return {
            receita_id: recipeId,
            nome: `Receita ${recipeId}`,
            custo_total: 0,
            custo_por_refeicao: 0,
            ingredientes: [],
            avisos: ['Receita sem ingredientes cadastrados']
          };
        }
        
        const recipeName = ingredients[0]?.nome || `Receita ${recipeId}`;
        console.log(`📦 ${recipeName}: ${ingredients.length} ingredientes`);
        
        // 2. Buscar preços dos ingredientes
        const productIds = [...new Set(ingredients.map(i => i.produto_base_id).filter(id => id))];
        
        const { data: prices, error: priceError } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select(`
            produto_base_id,
            preco,
            descricao,
            produto_base_quantidade_embalagem,
            apenas_valor_inteiro_sim_nao,
            em_promocao_sim_nao
          `)
          .in('produto_base_id', productIds)
          .gt('preco', 0)
          .order('preco', { ascending: true });
        
        if (priceError) {
          console.error('❌ Erro ao buscar preços:', priceError);
          throw priceError;
        }
        
        console.log(`💰 ${prices?.length || 0} preços encontrados para ${productIds.length} produtos`);
        
        // 3. Calcular custo de cada ingrediente
        let totalCost = 0;
        const ingredientDetails = [];
        const missingPrices = [];
        
        for (const ingredient of ingredients) {
          const ingredientName = ingredient.produto_base_descricao?.trim() || 'Ingrediente';
          
          // Encontrar preço do ingrediente
          const priceOptions = prices?.filter(p => p.produto_base_id === ingredient.produto_base_id) || [];
          
          if (priceOptions.length === 0) {
            console.warn(`  ⚠️ Sem preço: ${ingredientName} (ID: ${ingredient.produto_base_id})`);
            missingPrices.push(ingredientName);
            
            ingredientDetails.push({
              nome: ingredientName,
              quantidade: ingredient.quantidade,
              unidade: ingredient.unidade,
              preco_unitario: 0,
              custo_total: 0,
              tem_preco: false,
              aviso: 'Preço não cadastrado'
            });
            continue;
          }
          
          // Pegar o preço mais barato
          const bestPrice = priceOptions.reduce((min, curr) => 
            curr.preco < min.preco ? curr : min
          );
          
          // Calcular quantidade necessária (escalar de 100 para quantidade real)
          const basePortions = ingredient.quantidade_refeicoes || 100;
          const scaleFactor = mealQuantity / basePortions;
          const neededQuantity = ingredient.quantidade * scaleFactor;
          
          // Converter unidades se necessário
          let adjustedQuantity = neededQuantity;
          let adjustedPrice = bestPrice.preco;
          
          // Conversões simples
          if (ingredient.unidade === 'ML' && neededQuantity >= 1000) {
            adjustedQuantity = neededQuantity / 1000; // ML para L
          }
          
          // Calcular custo
          const totalIngredientCost = adjustedQuantity * adjustedPrice;
          totalCost += totalIngredientCost;
          
          ingredientDetails.push({
            nome: ingredientName,
            quantidade: neededQuantity,
            unidade: ingredient.unidade,
            preco_unitario: bestPrice.preco,
            custo_total: totalIngredientCost,
            produto_mercado: bestPrice.descricao,
            tem_preco: true,
            em_promocao: bestPrice.em_promocao_sim_nao || false
          });
          
          console.log(`  ✅ ${ingredientName}: ${neededQuantity}${ingredient.unidade} × R$${adjustedPrice} = R$${totalIngredientCost.toFixed(2)}`);
        }
        
        const costPerMeal = totalCost / mealQuantity;
        
        console.log(`💰 TOTAL: R$${totalCost.toFixed(2)} (R$${costPerMeal.toFixed(2)}/refeição)`);
        if (missingPrices.length > 0) {
          console.log(`⚠️ ${missingPrices.length} ingrediente(s) sem preço: ${missingPrices.join(', ')}`);
        }
        
        return {
          receita_id: recipeId,
          nome: recipeName,
          custo_total: totalCost,
          custo_por_refeicao: costPerMeal,
          ingredientes: ingredientDetails,
          ingredientes_sem_preco: missingPrices,
          precisao: ingredientDetails.length > 0 ? 
            ((ingredientDetails.length - missingPrices.length) / ingredientDetails.length * 100) : 0,
          avisos: missingPrices.length > 0 ? 
            [`${missingPrices.length} ingrediente(s) sem preço cadastrado`] : []
        };
        
      } catch (error) {
        console.error(`❌ Erro ao calcular receita ${recipeId}:`, error);
        return {
          receita_id: recipeId,
          nome: `Receita ${recipeId}`,
          custo_total: 0,
          custo_por_refeicao: 0,
          ingredientes: [],
          avisos: [`Erro no cálculo: ${error.message}`]
        };
      }
    }

    // ============ GERAÇÃO DE CARDÁPIO ============
    if (requestData.action === 'generate_menu') {
      console.log('🍽️ Gerando cardápio...');
      
      // Definir parâmetros
      const mealQuantity = requestData.refeicoesPorDia || requestData.meal_quantity || 100;
      const clientName = requestData.cliente || 'Cliente';
      const budget = requestData.orcamento_por_refeicao || 9.00;
      
      console.log(`📊 Parâmetros: ${mealQuantity} refeições, orçamento R$${budget}/refeição`);
      
      // Receitas fixas (sempre incluir)
      const fixedRecipes = [580]; // ID do Arroz
      const selectedRecipes = [];
      
      console.log('📌 Calculando receitas fixas...');
      for (const recipeId of fixedRecipes) {
        const cost = await calculateRecipeCost(recipeId, mealQuantity);
        if (cost.custo_total > 0 || cost.ingredientes.length > 0) {
          selectedRecipes.push(cost);
        }
      }
      
      // Buscar outras receitas disponíveis
      console.log('🔍 Buscando receitas adicionais...');
      const { data: availableRecipes, error: recipesError } = await supabase
        .from('receita_ingredientes')
        .select('receita_id_legado, nome')
        .neq('receita_id_legado', 580) // Excluir arroz já incluído
        .limit(20);
      
      if (!recipesError && availableRecipes) {
        // Pegar IDs únicos
        const uniqueRecipeIds = [...new Set(availableRecipes.map(r => r.receita_id_legado))];
        
        console.log(`📚 ${uniqueRecipeIds.length} receitas adicionais encontradas`);
        
        // Calcular custo de algumas receitas
        let additionalCount = 0;
        for (const recipeId of uniqueRecipeIds.slice(0, 5)) {
          if (additionalCount >= 3) break; // Máximo 3 adicionais
          
          const cost = await calculateRecipeCost(recipeId, mealQuantity);
          
          // Incluir se estiver no orçamento
          if (cost.custo_por_refeicao <= budget && cost.custo_total > 0) {
            selectedRecipes.push(cost);
            additionalCount++;
          }
        }
      }
      
      // Calcular totais
      const totalCost = selectedRecipes.reduce((sum, r) => sum + r.custo_total, 0);
      const costPerMeal = totalCost / mealQuantity;
      const totalBudget = budget * mealQuantity;
      const savings = totalBudget - totalCost;
      
      // Gerar lista de compras
      const shoppingList = new Map();
      
      for (const recipe of selectedRecipes) {
        for (const ingredient of recipe.ingredientes) {
          if (ingredient.tem_preco) {
            const key = ingredient.nome;
            
            if (shoppingList.has(key)) {
              const existing = shoppingList.get(key);
              existing.quantidade += ingredient.quantidade;
              existing.custo_total += ingredient.custo_total;
            } else {
              shoppingList.set(key, {
                nome: ingredient.nome,
                quantidade: ingredient.quantidade,
                unidade: ingredient.unidade,
                custo_total: ingredient.custo_total,
                produto_mercado: ingredient.produto_mercado
              });
            }
          }
        }
      }
      
      const shoppingItems = Array.from(shoppingList.values())
        .sort((a, b) => b.custo_total - a.custo_total);
      
      // Coletar avisos
      const allWarnings = [];
      for (const recipe of selectedRecipes) {
        if (recipe.avisos && recipe.avisos.length > 0) {
          allWarnings.push({
            receita: recipe.nome,
            avisos: recipe.avisos
          });
        }
      }
      
      const result = {
        success: true,
        version: 'PRODUCAO-CUSTO-REAL-v1.0',
        cliente: clientName,
        quantidade_refeicoes: mealQuantity,
        orcamento_por_refeicao: budget,
        
        cardapio: {
          receitas: selectedRecipes.map(r => ({
            id: r.receita_id,
            nome: r.nome,
            custo_total: r.custo_total.toFixed(2),
            custo_por_refeicao: r.custo_por_refeicao.toFixed(2),
            precisao_calculo: `${r.precisao.toFixed(1)}%`,
            ingredientes_sem_preco: r.ingredientes_sem_preco.length
          }))
        },
        
        resumo_financeiro: {
          custo_total: totalCost.toFixed(2),
          custo_por_refeicao: costPerMeal.toFixed(2),
          orcamento_total: totalBudget.toFixed(2),
          economia: savings.toFixed(2),
          dentro_orcamento: costPerMeal <= budget
        },
        
        lista_compras: {
          total_itens: shoppingItems.length,
          custo_total: shoppingItems.reduce((sum, item) => sum + item.custo_total, 0).toFixed(2),
          itens: shoppingItems.map(item => ({
            nome: item.nome,
            quantidade: item.quantidade.toFixed(3),
            unidade: item.unidade,
            custo: item.custo_total.toFixed(2),
            produto_mercado: item.produto_mercado
          }))
        },
        
        avisos: allWarnings,
        
        metadata: {
          tempo_geracao_ms: Date.now() - startTime,
          receitas_analisadas: selectedRecipes.length,
          data_geracao: new Date().toISOString()
        }
      };
      
      console.log(`✅ Cardápio gerado: ${selectedRecipes.length} receitas, R$${totalCost.toFixed(2)} total`);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ TESTE DE RECEITA ESPECÍFICA ============
    if (requestData.action === 'test_recipe_cost') {
      const recipeId = requestData.receita_id || 580;
      const mealQuantity = requestData.meal_quantity || 100;
      
      const result = await calculateRecipeCost(recipeId, mealQuantity);
      
      return new Response(
        JSON.stringify({
          success: true,
          version: 'PRODUCAO-CUSTO-REAL-v1.0',
          ...result
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ DEFAULT ============
    return new Response(
      JSON.stringify({
        success: true,
        version: 'PRODUCAO-CUSTO-REAL-v1.0',
        message: 'Sistema de cálculo de custos funcionando!',
        actions: ['generate_menu', 'test_recipe_cost'],
        tempo_ms: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ERRO PRINCIPAL:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        version: 'PRODUCAO-CUSTO-REAL-v1.0',
        erro: error.message,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});