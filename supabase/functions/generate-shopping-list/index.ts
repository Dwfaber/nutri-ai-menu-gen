import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { menuId, clientName, budgetPredicted, menuItems, optimizationConfig } = await req.json()

    if (!menuId || !clientName || !budgetPredicted) {
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

    // Create a map for easy product lookup
    const productMap = new Map()
    marketProducts?.forEach(product => {
      productMap.set(product.produto_id, product)
    })

    // Process menu items to extract ingredients
    const ingredientMap = new Map()
    
    if (menuItems && menuItems.length > 0) {
      // Use actual menu items
      for (const item of menuItems) {
        if (item.ingredients) {
          for (const ingredient of item.ingredients) {
            const key = ingredient.produto_id
            if (ingredientMap.has(key)) {
              const existing = ingredientMap.get(key)
              existing.quantity += ingredient.quantidade || 0
            } else {
              const marketProduct = productMap.get(ingredient.produto_id)
              if (marketProduct) {
                ingredientMap.set(key, {
                  product_id: ingredient.produto_id.toString(),
                  name: ingredient.nome,
                  quantity: ingredient.quantidade || 0,
                  unit: ingredient.unidade || marketProduct.unidade,
                  category: marketProduct.categoria_descricao || 'Outros',
                  price: marketProduct.preco || 0,
                  per_capita: marketProduct.per_capita || 0,
                  promocao: marketProduct.promocao || false
                })
              }
            }
          }
        }
      }
    } else {
      // Fallback: create sample shopping list from available products
      const sampleProducts = marketProducts?.slice(0, 15) || []
      
      for (const product of sampleProducts) {
        if (product.preco > 0 && product.per_capita > 0) {
          const baseQuantity = product.per_capita * 100 // Assuming 100 employees
          
          ingredientMap.set(product.produto_id, {
            product_id: product.produto_id.toString(),
            name: product.descricao,
            quantity: baseQuantity,
            unit: product.unidade || 'kg',
            category: product.categoria_descricao || 'Outros',
            price: product.preco,
            per_capita: product.per_capita,
            promocao: product.promocao || false
          })
        }
      }
    }

    const aggregatedIngredients = Array.from(ingredientMap.values())

    // Calculate costs and create shopping list with optimization preparation
    let totalCost = 0
    const shoppingItems = []
    const optimizationData = []

    for (const ingredient of aggregatedIngredients) {
      const unitPrice = ingredient.price || 0
      const totalPrice = ingredient.quantity * unitPrice

      totalCost += totalPrice

      // Preparar dados para futura otimização
      const productVariants = marketProducts?.filter(p => 
        p.produto_base_id === ingredient.product_id || 
        p.produto_id === ingredient.product_id
      ) || []

      shoppingItems.push({
        product_id_legado: ingredient.product_id,
        product_name: ingredient.name,
        category: ingredient.category,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        unit_price: unitPrice,
        total_price: totalPrice,
        available: true, // Products in market are available
        promocao: ingredient.promocao
      })

      // Dados para otimização (preparação para GPT Assistant)
      if (optimizationConfig && productVariants.length > 1) {
        optimizationData.push({
          produto_base_id: ingredient.product_id,
          produto_base_nome: ingredient.name,
          quantidade_necessaria: ingredient.quantity,
          unidade: ingredient.unit,
          opcoes_embalagem: productVariants.map(variant => ({
            produto_id: variant.produto_id,
            descricao: variant.descricao,
            quantidade_embalagem: variant.quantidade_embalagem || 1,
            preco: variant.preco || 0,
            preco_compra: variant.preco_compra || 0,
            promocao: variant.promocao || false,
            em_promocao: variant.em_promocao || false,
            apenas_valor_inteiro: variant.apenas_valor_inteiro || false
          })),
          configuracao_otimizacao: optimizationConfig
        })
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
    console.log(`Optimization data prepared for ${optimizationData.length} products`)
    console.log(`Used ${shoppingItems.filter(item => item.promocao).length} products on promotion`)

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
        marketStats: {
          total_products_used: shoppingItems.length,
          promotions_used: shoppingItems.filter(item => item.promocao).length,
          categories_covered: [...new Set(shoppingItems.map(item => item.category))].length
        },
        optimizationData: optimizationData // Dados preparados para otimização
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
