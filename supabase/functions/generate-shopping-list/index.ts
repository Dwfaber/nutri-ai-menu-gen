
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
    const { menuId, clientName, budgetPredicted } = await req.json()

    if (!menuId || !clientName || !budgetPredicted) {
      throw new Error('menuId, clientName e budgetPredicted são obrigatórios')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Generating shopping list for menu: ${menuId}`)

    // Mock menu data with ingredients (in real implementation, this would come from the menu)
    const menuItems = [
      {
        name: "Frango Grelhado",
        ingredients: [
          { product_id: "FRANG001", name: "Peito de Frango", quantity: 2, unit: "kg" },
          { product_id: "TEMP001", name: "Tempero Completo", quantity: 0.1, unit: "kg" }
        ]
      },
      {
        name: "Arroz Integral",
        ingredients: [
          { product_id: "ARROZ001", name: "Arroz Integral", quantity: 1, unit: "kg" }
        ]
      },
      {
        name: "Feijão Carioca",
        ingredients: [
          { product_id: "FEIJAO001", name: "Feijão Carioca", quantity: 0.5, unit: "kg" }
        ]
      }
    ]

    // Aggregate ingredients by product
    const ingredientMap = new Map()
    
    for (const item of menuItems) {
      for (const ingredient of item.ingredients) {
        const key = ingredient.product_id
        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)
          existing.quantity += ingredient.quantity
        } else {
          ingredientMap.set(key, { ...ingredient })
        }
      }
    }

    const aggregatedIngredients = Array.from(ingredientMap.values())

    // Get product prices from legacy system
    const productPrices = new Map([
      ["FRANG001", { price: 15.90, available: true, category: "Proteínas" }],
      ["TEMP001", { price: 8.50, available: true, category: "Temperos" }],
      ["ARROZ001", { price: 6.80, available: true, category: "Carboidratos" }],
      ["FEIJAO001", { price: 9.20, available: true, category: "Leguminosas" }]
    ])

    // Calculate costs and create shopping list
    let totalCost = 0
    const shoppingItems = []

    for (const ingredient of aggregatedIngredients) {
      const priceData = productPrices.get(ingredient.product_id)
      if (!priceData) {
        console.warn(`Price not found for product: ${ingredient.product_id}`)
        continue
      }

      const unitPrice = priceData.price
      const totalPrice = ingredient.quantity * unitPrice

      totalCost += totalPrice

      shoppingItems.push({
        product_id_legado: ingredient.product_id,
        product_name: ingredient.name,
        category: priceData.category,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        unit_price: unitPrice,
        total_price: totalPrice,
        available: priceData.available
      })
    }

    // Create shopping list record
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
