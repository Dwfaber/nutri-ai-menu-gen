
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
    console.log('Received request body:', JSON.stringify(await req.clone().json()))
    
    const { menuId, clientName, budgetPredicted, menuItems, optimizationConfig } = await req.json()

    console.log('Parsed parameters:', { 
      menuId, 
      clientName, 
      budgetPredicted: typeof budgetPredicted, 
      menuItemsLength: menuItems?.length,
      optimizationConfig: !!optimizationConfig 
    })

    if (!menuId || !clientName || budgetPredicted === undefined || budgetPredicted === null) {
      const error = `Missing required parameters: menuId=${menuId}, clientName=${clientName}, budgetPredicted=${budgetPredicted}`
      console.error(error)
      throw new Error(error)
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
    
    console.log('Processing menu items:', JSON.stringify(menuItems?.slice(0, 2), null, 2));
    
    if (menuItems && menuItems.length > 0) {
      for (const item of menuItems) {
        console.log(`Processing menu item: ${item.name || item.nome || 'Unknown'}`);
        
        if (item.ingredients) {
          console.log(`Found ${item.ingredients.length} ingredients in this item`);
          
          for (const ingredient of item.ingredients) {
            const baseId = ingredient.produto_base_id || ingredient.produto_id;
            const key = baseId;
            
            // Try multiple possible quantity field names
            let quantity = 0;
            const quantityFields = ['quantity', 'quantidade', 'qtd', 'peso', 'volume'];
            
            for (const field of quantityFields) {
              if (ingredient[field] !== undefined && ingredient[field] !== null) {
                quantity = parseFloat(ingredient[field].toString()) || 0;
                if (quantity > 0) break;
              }
            }
            
            console.log(`Ingredient: ${ingredient.name || ingredient.nome} - Quantity: ${quantity} - Base ID: ${baseId}`);
            
            if (quantity > 0 && baseId) {
              if (ingredientMap.has(key)) {
                const existing = ingredientMap.get(key);
                existing.quantity += quantity;
                console.log(`Updated existing ingredient: ${existing.name} - New total: ${existing.quantity}`);
              } else {
                const firstProduct = productsByBase.get(baseId)?.[0];
                if (firstProduct) {
                  const newIngredient = {
                    produto_base_id: baseId,
                    name: ingredient.name || ingredient.nome || firstProduct.descricao,
                    quantity: quantity,
                    unit: ingredient.unit || ingredient.unidade || firstProduct.unidade,
                    category: firstProduct.categoria_descricao || 'Outros',
                    opcoes_embalagem: productsByBase.get(baseId) || []
                  };
                  ingredientMap.set(key, newIngredient);
                  console.log(`Added new ingredient: ${newIngredient.name} - Quantity: ${newIngredient.quantity}`);
                } else {
                  console.log(`No product found for base ID: ${baseId}`);
                }
              }
            } else {
              console.log(`Skipping ingredient with zero quantity or missing base ID: ${ingredient.name || ingredient.nome}`);
            }
          }
        } else {
          console.log('No ingredients found in this menu item');
        }
      }
    } else {
      console.log('No menu items provided, creating sample shopping list');
      
      // Fallback: create sample shopping list with meaningful quantities
      const sampleProducts = marketProducts?.slice(0, 15) || [];
      
      for (const product of sampleProducts) {
        if (product.preco > 0) {
          // Calculate base quantity using per capita data or reasonable defaults
          let baseQuantity = 0;
          
          if (product.per_capita > 0) {
            baseQuantity = product.per_capita * 100; // Scale for 100 people
          } else {
            // Set reasonable default quantities based on category
            const categoryDefaults = {
              'CARNES': 5.0,
              'ARROZ': 3.0,
              'FEIJAO': 2.0,
              'VERDURAS': 2.0,
              'TEMPEROS': 0.5,
              'OLEOS': 1.0
            };
            
            const category = product.categoria_descricao?.toUpperCase() || '';
            for (const [cat, qty] of Object.entries(categoryDefaults)) {
              if (category.includes(cat)) {
                baseQuantity = qty;
                break;
              }
            }
            
            if (baseQuantity === 0) baseQuantity = 1.0; // Default fallback
          }
          
          const baseId = product.produto_base_id || product.produto_id;
          
          console.log(`Sample product: ${product.descricao} - Quantity: ${baseQuantity} - Category: ${product.categoria_descricao}`);
          
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
    
    console.log('Total ingredients processed:', aggregatedIngredients.length);
    console.log('Sample processed ingredient:', aggregatedIngredients[0]);

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
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause
    })
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        errorDetails: {
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5) // Only first 5 lines of stack
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
