
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Optimization algorithm implementation
const calculateOptimalPackaging = (
  quantidadeNecessaria: number,
  opcoes: any[],
  config: any
) => {
  const opcoesDisponiveis = opcoes.filter(opcao => opcao.preco > 0);
  
  if (opcoesDisponiveis.length === 0) {
    return [];
  }

  // Sort by priority: promotions first, then cost per unit
  const opcoesOrdenadas = [...opcoesDisponiveis].sort((a, b) => {
    if (config.prioridade_promocao === 'alta') {
      if (a.promocao || a.em_promocao) return -1;
      if (b.promocao || b.em_promocao) return 1;
    }
    
    const custoUnitarioA = a.preco / (a.quantidade_embalagem || 1);
    const custoUnitarioB = b.preco / (b.quantidade_embalagem || 1);
    
    return custoUnitarioA - custoUnitarioB;
  });

  const selecoes = [];
  let quantidadeRestante = quantidadeNecessaria;

  for (const opcao of opcoesOrdenadas) {
    if (quantidadeRestante <= 0) break;
    
    if (selecoes.length >= config.maximo_tipos_embalagem_por_produto) break;

    const quantidadeEmbalagem = opcao.quantidade_embalagem || 1;
    
    if (opcao.apenas_valor_inteiro) {
      const pacotesNecessarios = Math.ceil(quantidadeRestante / quantidadeEmbalagem);
      const quantidadeTotal = pacotesNecessarios * quantidadeEmbalagem;
      const sobra = quantidadeTotal - quantidadeRestante;
      const sobraPercentual = (sobra / quantidadeNecessaria) * 100;
      
      if (sobraPercentual <= config.tolerancia_sobra_percentual) {
        selecoes.push({
          produto_id: opcao.produto_id,
          descricao: opcao.descricao,
          quantidade_pacotes: pacotesNecessarios,
          quantidade_unitaria: quantidadeEmbalagem,
          preco_unitario: opcao.preco,
          custo_total: pacotesNecessarios * opcao.preco,
          em_promocao: opcao.promocao || opcao.em_promocao,
          motivo_selecao: `${opcao.promocao || opcao.em_promocao ? 'promoção, ' : ''}R$ ${(opcao.preco / quantidadeEmbalagem).toFixed(2)}/unidade${sobra > 0 ? `, sobra ${sobraPercentual.toFixed(1)}%` : ''}`
        });
        
        quantidadeRestante = 0;
      }
    } else {
      const pacotesNecessarios = Math.ceil(quantidadeRestante / quantidadeEmbalagem);
      
      selecoes.push({
        produto_id: opcao.produto_id,
        descricao: opcao.descricao,
        quantidade_pacotes: pacotesNecessarios,
        quantidade_unitaria: quantidadeEmbalagem,
        preco_unitario: opcao.preco,
        custo_total: pacotesNecessarios * opcao.preco,
        em_promocao: opcao.promocao || opcao.em_promocao,
        motivo_selecao: `${opcao.promocao || opcao.em_promocao ? 'promoção, ' : ''}R$ ${(opcao.preco / quantidadeEmbalagem).toFixed(2)}/unidade`
      });
      
      quantidadeRestante -= pacotesNecessarios * quantidadeEmbalagem;
    }
  }

  return selecoes;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { menuId, clientName, budgetPredicted, menuItems, optimizationConfig } = await req.json()

    if (!menuId || !clientName || budgetPredicted === undefined || budgetPredicted === null) {
      throw new Error('menuId, clientName e budgetPredicted são obrigatórios')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Generating shopping list for menu: ${menuId}`)
    console.log(`Optimization enabled: ${!!optimizationConfig}`)

    // Get products from digital market
    const { data: marketProducts } = await supabaseClient
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .order('categoria_descricao', { ascending: true });

    // Group products by produto_base_id for optimization
    const productsByBase = new Map();
    marketProducts?.forEach(product => {
      const baseId = product.produto_base_id || product.produto_id;
      if (!productsByBase.has(baseId)) {
        productsByBase.set(baseId, []);
      }
      productsByBase.get(baseId).push(product);
    });

    // Process menu items to extract ingredients
    const ingredientMap = new Map();
    
    if (menuItems && menuItems.length > 0) {
      for (const item of menuItems) {
        if (item.ingredients) {
          for (const ingredient of item.ingredients) {
            const baseId = ingredient.produto_base_id || ingredient.produto_id;
            const key = baseId;
            if (ingredientMap.has(key)) {
              const existing = ingredientMap.get(key);
              existing.quantity += ingredient.quantidade || 0;
            } else {
              const firstProduct = productsByBase.get(baseId)?.[0];
              if (firstProduct) {
                ingredientMap.set(key, {
                  produto_base_id: baseId,
                  name: ingredient.nome || firstProduct.descricao,
                  quantity: ingredient.quantidade || 0,
                  unit: ingredient.unidade || firstProduct.unidade,
                  category: firstProduct.categoria_descricao || 'Outros',
                  opcoes_embalagem: productsByBase.get(baseId) || []
                });
              }
            }
          }
        }
      }
    } else {
      // Fallback: create sample shopping list
      const sampleProducts = marketProducts?.slice(0, 15) || [];
      
      for (const product of sampleProducts) {
        if (product.preco > 0 && product.per_capita > 0) {
          const baseQuantity = product.per_capita * 100;
          const baseId = product.produto_base_id || product.produto_id;
          
          ingredientMap.set(baseId, {
            produto_base_id: baseId,
            name: product.descricao,
            quantity: baseQuantity,
            unit: product.unidade || 'kg',
            category: product.categoria_descricao || 'Outros',
            opcoes_embalagem: productsByBase.get(baseId) || [product]
          });
        }
      }
    }

    const aggregatedIngredients = Array.from(ingredientMap.values());

    // Apply optimization if enabled
    let totalCost = 0;
    let totalSavings = 0;
    const shoppingItems = [];
    const optimizationResults = [];

    const defaultConfig = {
      prioridade_promocao: 'alta',
      tolerancia_sobra_percentual: 10,
      preferir_produtos_integrais: false,
      maximo_tipos_embalagem_por_produto: 3,
      considerar_custo_compra: false
    };

    const config = optimizationConfig || defaultConfig;

    for (const ingredient of aggregatedIngredients) {
      if (optimizationConfig && ingredient.opcoes_embalagem.length > 1) {
        // Apply optimization algorithm
        const selections = calculateOptimalPackaging(
          ingredient.quantity,
          ingredient.opcoes_embalagem,
          config
        );

        if (selections.length > 0) {
          const optimizedCost = selections.reduce((sum, sel) => sum + sel.custo_total, 0);
          const totalQuantity = selections.reduce((sum, sel) => sum + (sel.quantidade_pacotes * sel.quantidade_unitaria), 0);
          const sobra = Math.max(0, totalQuantity - ingredient.quantity);

          // Calculate cost without optimization (using first available option)
          const firstOption = ingredient.opcoes_embalagem[0];
          const packagesNeeded = Math.ceil(ingredient.quantity / (firstOption.quantidade_embalagem || 1));
          const costWithoutOptimization = packagesNeeded * firstOption.preco;
          const savings = Math.max(0, costWithoutOptimization - optimizedCost);

          totalCost += optimizedCost;
          totalSavings += savings;

          // Create shopping items for each selection
          for (const selection of selections) {
            shoppingItems.push({
              product_id_legado: selection.produto_id.toString(),
              product_name: selection.descricao,
              category: ingredient.category,
              quantity: selection.quantidade_pacotes,
              unit: `pacote(s) de ${selection.quantidade_unitaria}${ingredient.unit}`,
              unit_price: selection.preco_unitario,
              total_price: selection.custo_total,
              available: true,
              promocao: selection.em_promocao,
              optimized: true
            });
          }

          optimizationResults.push({
            produto_base_id: ingredient.produto_base_id,
            produto_base_nome: ingredient.name,
            quantidade_solicitada: ingredient.quantity,
            quantidade_total_comprada: totalQuantity,
            sobra: sobra,
            custo_total: optimizedCost,
            economia_obtida: savings,
            pacotes_selecionados: selections,
            justificativa: `Otimização aplicada: ${selections.length} tipo(s) de embalagem selecionado(s)${savings > 0 ? `, economia de R$ ${savings.toFixed(2)}` : ''}${sobra > 0 ? `, sobra de ${sobra.toFixed(2)}${ingredient.unit}` : ''}`
          });
        } else {
          // Fallback to first option if optimization fails
          const firstOption = ingredient.opcoes_embalagem[0];
          const unitPrice = firstOption.preco || 0;
          const totalPrice = ingredient.quantity * unitPrice;
          totalCost += totalPrice;

          shoppingItems.push({
            product_id_legado: firstOption.produto_id.toString(),
            product_name: ingredient.name,
            category: ingredient.category,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            unit_price: unitPrice,
            total_price: totalPrice,
            available: true,
            promocao: firstOption.promocao || false,
            optimized: false
          });
        }
      } else {
        // No optimization - use simple calculation
        const firstOption = ingredient.opcoes_embalagem[0];
        const unitPrice = firstOption?.preco || 0;
        const totalPrice = ingredient.quantity * unitPrice;
        totalCost += totalPrice;

        shoppingItems.push({
          product_id_legado: (firstOption?.produto_id || ingredient.produto_base_id).toString(),
          product_name: ingredient.name,
          category: ingredient.category,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          unit_price: unitPrice,
          total_price: totalPrice,
          available: true,
          promocao: firstOption?.promocao || false,
          optimized: false
        });
      }
    }

    const { data: shoppingList, error: listError } = await supabaseClient
      .from('shopping_lists')
      .insert({
        menu_id: menuId,
        client_name: clientName,
        status: totalCost <= budgetPredicted ? 'budget_ok' : 'budget_exceeded',
        budget_predicted: budgetPredicted,
        cost_actual: totalCost
      })
      .select()
      .single()

    if (listError) {
      throw new Error(`Error creating shopping list: ${listError.message}`)
    }

    // Create shopping list items
    const itemsWithListId = shoppingItems.map(item => ({
      ...item,
      shopping_list_id: shoppingList.id
    }))

    const { error: itemsError } = await supabaseClient
      .from('shopping_list_items')
      .insert(itemsWithListId)

    if (itemsError) {
      throw new Error(`Error creating shopping list items: ${itemsError.message}`)
    }

    console.log(`Shopping list created successfully. Total cost: R$ ${totalCost.toFixed(2)}`)
    console.log(`Optimization results: ${optimizationResults.length} products optimized`)
    console.log(`Total savings: R$ ${totalSavings.toFixed(2)}`)
    console.log(`Promotions used: ${shoppingItems.filter(item => item.promocao).length}`)

    return new Response(
      JSON.stringify({
        success: true,
        shoppingList: {
          ...shoppingList,
          items: itemsWithListId
        },
        budgetStatus: {
          predicted: budgetPredicted,
          actual: totalCost,
          withinBudget: totalCost <= budgetPredicted,
          difference: totalCost - budgetPredicted
        },
        optimizationSummary: {
          enabled: !!optimizationConfig,
          products_optimized: optimizationResults.length,
          total_savings: totalSavings,
          promotions_used: shoppingItems.filter(item => item.promocao).length,
          products_with_surplus: optimizationResults.filter(r => r.sobra > 0).length
        },
        optimizationResults: optimizationResults,
        marketStats: {
          total_products_used: shoppingItems.length,
          optimized_products: shoppingItems.filter(item => item.optimized).length,
          categories_covered: [...new Set(shoppingItems.map(item => item.category))].length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error generating shopping list:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
