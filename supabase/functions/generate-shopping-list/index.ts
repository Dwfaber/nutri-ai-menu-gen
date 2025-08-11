import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
  const norm = (opcao: any) => {
    const embalagem = Number(opcao.quantidade_embalagem ?? opcao.produto_base_quantidade_embalagem ?? 1);
    const precoBase = config?.considerar_custo_compra
      ? Number(opcao.preco_compra ?? opcao.preco ?? 0)
      : Number(opcao.preco ?? opcao.preco_compra ?? 0);
    const promocao = Boolean(opcao.promocao || opcao.em_promocao || opcao.em_promocao_sim_nao);
    const apenasInteiro = Boolean(opcao.apenas_valor_inteiro || opcao.apenas_valor_inteiro_sim_nao || opcao.inteiro);
    return { embalagem, precoBase, promocao, apenasInteiro };
  };

  const opcoesDisponiveis = opcoes
    .map((op) => ({ ...op, __norm: norm(op) }))
    .filter((op) => op.__norm.precoBase > 0 && op.__norm.embalagem > 0);

  if (opcoesDisponiveis.length === 0) {
    return [];
  }

  const opcoesOrdenadas = [...opcoesDisponiveis].sort((a, b) => {
    if (config?.prioridade_promocao === 'alta') {
      if (a.__norm.promocao && !b.__norm.promocao) return -1;
      if (!a.__norm.promocao && b.__norm.promocao) return 1;
    }

    const custoUnitarioA = a.__norm.precoBase / a.__norm.embalagem;
    const custoUnitarioB = b.__norm.precoBase / b.__norm.embalagem;

    if (custoUnitarioA !== custoUnitarioB) return custoUnitarioA - custoUnitarioB;
    // desempate: embalagem maior para reduzir tipos
    return b.__norm.embalagem - a.__norm.embalagem;
  });

  const selecoes: any[] = [];
  let quantidadeRestante = quantidadeNecessaria;

  for (const opcao of opcoesOrdenadas) {
    if (quantidadeRestante <= 0) break;
    if (selecoes.length >= (config?.maximo_tipos_embalagem_por_produto ?? 3)) break;

    const { embalagem, precoBase, promocao, apenasInteiro } = opcao.__norm;

    if (apenasInteiro) {
      const pacotesNecessarios = Math.ceil(quantidadeRestante / embalagem);
      const quantidadeTotal = pacotesNecessarios * embalagem;
      const sobra = Math.max(0, quantidadeTotal - quantidadeRestante);
      const sobraPercentual = (sobra / Math.max(1, quantidadeNecessaria)) * 100;

      if (sobraPercentual <= (config?.tolerancia_sobra_percentual ?? 10)) {
        selecoes.push({
          produto_id: opcao.produto_id,
          descricao: opcao.descricao,
          quantidade_pacotes: pacotesNecessarios,
          quantidade_unitaria: embalagem,
          preco_unitario: precoBase,
          custo_total: pacotesNecessarios * precoBase,
          em_promocao: promocao,
          motivo_selecao: `${promocao ? 'em promoção, ' : ''}R$ ${(precoBase / embalagem).toFixed(2)}/unidade${sobra > 0 ? `, sobra ${sobraPercentual.toFixed(1)}%` : ''}`,
        });

        quantidadeRestante = 0; // Produto integral resolve tudo de uma vez
      }
    } else {
      // Produto pode ser fracionado
      const pacotesNecessarios = Math.ceil(quantidadeRestante / embalagem);

      selecoes.push({
        produto_id: opcao.produto_id,
        descricao: opcao.descricao,
        quantidade_pacotes: pacotesNecessarios,
        quantidade_unitaria: embalagem,
        preco_unitario: precoBase,
        custo_total: pacotesNecessarios * precoBase,
        em_promocao: promocao,
        motivo_selecao: `${promocao ? 'em promoção, ' : ''}R$ ${(precoBase / embalagem).toFixed(2)}/unidade`,
      });

      quantidadeRestante -= pacotesNecessarios * embalagem;
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
    
    const { menuId, clientName, budgetPredicted, menuItems, optimizationConfig, servingsPerDay, totalServingsWeek, servingsByRecipe } = await req.json()

    console.log('Parsed parameters:', { 
      menuId, 
      clientName, 
      budgetPredicted: typeof budgetPredicted, 
      menuItemsLength: menuItems?.length,
      optimizationConfig: !!optimizationConfig,
      servingsPerDay, totalServingsWeek,
      hasServingsByRecipe: !!servingsByRecipe 
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

    // Get OpenAI API Key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey && optimizationConfig) {
      console.warn('OpenAI API key not found, falling back to basic optimization');
    }

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

    // Recipe mapping for dynamic IDs to real recipe IDs
    const RECIPE_MAPPING: { [key: string]: string } = {
      'arroz-Segunda': '580',
      'arroz-Terça': '580', 
      'arroz-Quarta': '580',
      'arroz-Quinta': '580',
      'arroz-Sexta': '580',
      'feijao-Segunda': '581',
      'feijao-Terça': '581',
      'feijao-Quarta': '581', 
      'feijao-Quinta': '581',
      'feijao-Sexta': '581',
      'suco-laranja-default': '1121',
      'suco-uva-default': '1124',
      'suco-limao-default': '1122', 
      'suco-maracuja-default': '1123'
    };

    // Function to normalize recipe ID - if it's already a number/valid ID, use it directly
    const normalizeRecipeId = (recipeId: string): string => {
      // Check if it's in our mapping first
      if (RECIPE_MAPPING[recipeId]) {
        console.log(`Mapped ${recipeId} to ${RECIPE_MAPPING[recipeId]}`);
        return RECIPE_MAPPING[recipeId];
      }
      
      // If it's already a numeric ID, use it as-is
      if (/^\d+$/.test(recipeId)) {
        console.log(`Using numeric recipe ID as-is: ${recipeId}`);
        return recipeId;
      }
      
      // If it's not in mapping and not numeric, log and skip
      console.log(`Warning: Recipe ID '${recipeId}' not found in mapping and not numeric`);
      return recipeId; // Return as-is, let the query handle it
    };

    // Process recipes from the menu to extract ingredients from database
    const ingredientMap = new Map();
    
    // First, get the actual menu with recipe IDs
    const { data: menuData, error: menuError } = await supabaseClient
      .from('generated_menus')
      .select('receitas_ids, receitas_adaptadas')
      .eq('id', menuId)
      .single();

    if (menuError || !menuData) {
      console.error('Error fetching menu data:', menuError);
      throw new Error('Menu not found');
    }

    const receitasIds = menuData.receitas_ids || [];
    console.log('Processing recipe IDs from menu:', receitasIds);

    if (receitasIds && receitasIds.length > 0) {
      for (const recipeId of receitasIds) {
        console.log(`Processing recipe ID: ${recipeId}`);
        
        // Map dynamic IDs to real recipe IDs using the normalize function
        const realRecipeId = normalizeRecipeId(recipeId);

        try {
          // First, verify the recipe exists and get its data
          const { data: recipe, error: recipeError } = await supabaseClient
            .from('receitas_legado')
            .select('receita_id_legado, nome_receita, quantidade_refeicoes')
            .eq('receita_id_legado', realRecipeId)
            .single();

          if (recipeError || !recipe) {
            console.log(`Recipe ${realRecipeId} not found in receitas_legado, trying receitas_adaptadas fallback`);
            const adaptedList = menuData.receitas_adaptadas || [];
            const adapted = adaptedList.find((r: any) => String(r?.receita_id_legado) === String(realRecipeId) || String(r?.receita_id_legado) === String(recipeId));
            if (adapted && Array.isArray(adapted.ingredientes) && adapted.ingredientes.length > 0) {
              const recipeBaseServings = adapted.porcoes || 100;
              const defaultNeededServings = typeof servingsPerDay === 'number' && servingsPerDay > 0 ? servingsPerDay : 100;
              const recipeNeededServings = (servingsByRecipe && (servingsByRecipe[realRecipeId] || servingsByRecipe[recipeId])) || defaultNeededServings;
              const multiplier = recipeBaseServings > 0 ? (recipeNeededServings / recipeBaseServings) : 1;
              console.log(`Fallback adapted recipe multiplier: base=${recipeBaseServings}, need=${recipeNeededServings}, mult=${multiplier}`);

              for (const ing of adapted.ingredientes) {
                const baseId = ing.produto_base_id;
                if (!baseId) continue;
                const baseQuantity = parseFloat((ing.quantidade ?? ing.quantity ?? 0).toString()) || 0;
                const adjustedQuantity = baseQuantity * multiplier;
                if (adjustedQuantity <= 0) continue;

                const firstProduct = productsByBase.get(baseId)?.[0];
                const name = ing.nome || ing.name || firstProduct?.descricao || 'Ingrediente';
                const unit = ing.unidade || ing.unit || firstProduct?.unidade || 'kg';
                const category = firstProduct?.categoria_descricao || 'Outros';
                if (ingredientMap.has(baseId)) {
                  const existing = ingredientMap.get(baseId);
                  existing.quantity += adjustedQuantity;
                  existing.recipes.push(adapted.nome_receita || adapted.nome || `receita_${realRecipeId}`);
                } else {
                  ingredientMap.set(baseId, {
                    produto_base_id: baseId,
                    name,
                    quantity: adjustedQuantity,
                    unit,
                    category,
                    opcoes_embalagem: productsByBase.get(baseId) || [] ,
                    recipes: [adapted.nome_receita || adapted.nome || `receita_${realRecipeId}`]
                  });
                }
              }
              // Done with fallback for this recipe id
              continue;
            } else {
              // No fallback available for this recipe id
              continue;
            }
          }

          console.log(`Found recipe: ${recipe.nome_receita} (serves ${recipe.quantidade_refeicoes})`);

          // Fetch ingredients for this recipe
          const { data: ingredients, error: ingredientsError } = await supabaseClient
            .from('receita_ingredientes')
            .select('*')
            .eq('receita_id_legado', realRecipeId);

          if (ingredientsError) {
            console.error(`Error fetching ingredients for recipe ${realRecipeId}:`, ingredientsError);
            continue;
          }

          if (!ingredients || ingredients.length === 0) {
            console.log(`No ingredients found for recipe ${realRecipeId}`);
            // Try adapted fallback for missing ingredients
            const adaptedList = menuData.receitas_adaptadas || [];
            const adapted = adaptedList.find((r: any) => String(r?.receita_id_legado) === String(realRecipeId));
            if (adapted && Array.isArray(adapted.ingredientes) && adapted.ingredientes.length > 0) {
              const recipeBaseServings = adapted.porcoes || 100;
              const defaultNeededServings = typeof servingsPerDay === 'number' && servingsPerDay > 0 ? servingsPerDay : 100;
              const recipeNeededServings = (servingsByRecipe && (servingsByRecipe[realRecipeId] || servingsByRecipe[recipeId])) || defaultNeededServings;
              const multiplier = recipeBaseServings > 0 ? (recipeNeededServings / recipeBaseServings) : 1;
              for (const ing of adapted.ingredientes) {
                const baseId = ing.produto_base_id;
                if (!baseId) continue;
                const baseQuantity = parseFloat((ing.quantidade ?? ing.quantity ?? 0).toString()) || 0;
                const adjustedQuantity = baseQuantity * multiplier;
                if (adjustedQuantity <= 0) continue;
                const firstProduct = productsByBase.get(baseId)?.[0];
                const name = ing.nome || ing.name || firstProduct?.descricao || 'Ingrediente';
                const unit = ing.unidade || ing.unit || firstProduct?.unidade || 'kg';
                const category = firstProduct?.categoria_descricao || 'Outros';
                if (ingredientMap.has(baseId)) {
                  const existing = ingredientMap.get(baseId);
                  existing.quantity += adjustedQuantity;
                  existing.recipes.push(adapted.nome_receita || adapted.nome || `receita_${realRecipeId}`);
                } else {
                  ingredientMap.set(baseId, {
                    produto_base_id: baseId,
                    name,
                    quantity: adjustedQuantity,
                    unit,
                    category,
                    opcoes_embalagem: productsByBase.get(baseId) || [] ,
                    recipes: [adapted.nome_receita || adapted.nome || `receita_${realRecipeId}`]
                  });
                }
              }
              continue;
            }
            continue;
          }

          console.log(`Found ${ingredients.length} ingredients for recipe ${realRecipeId}`);
          
          // Calculate quantity multiplier based on servings needed vs recipe base
          const recipeBaseServings = recipe.quantidade_refeicoes || 100;
          const defaultNeededServings = typeof servingsPerDay === 'number' && servingsPerDay > 0 ? servingsPerDay : 100;
          const recipeNeededServings = (servingsByRecipe && servingsByRecipe[realRecipeId]) || defaultNeededServings;
          const multiplier = recipeBaseServings > 0 ? (recipeNeededServings / recipeBaseServings) : 1;
          
          console.log(`Recipe serves ${recipeBaseServings}, need ${recipeNeededServings}, multiplier: ${multiplier}`);
          
          // Process each ingredient
          for (const ingredient of ingredients) {
            const baseId = ingredient.produto_base_id;
            if (!baseId) {
              console.log(`Skipping ingredient without produto_base_id: ${ingredient.nome}`);
              continue;
            }
            
            // Calculate adjusted quantity
            const baseQuantity = parseFloat(ingredient.quantidade?.toString()) || 0;
            const adjustedQuantity = baseQuantity * multiplier;
            
            console.log(`Ingredient: ${ingredient.nome} - Base: ${baseQuantity} - Adjusted: ${adjustedQuantity} - Unit: ${ingredient.unidade}`);
            
            if (adjustedQuantity > 0) {
              const key = baseId;
              
              if (ingredientMap.has(key)) {
                const existing = ingredientMap.get(key);
                existing.quantity += adjustedQuantity;
                existing.recipes.push(recipe.nome_receita);
                console.log(`Updated existing ingredient: ${existing.name} - New total: ${existing.quantity}`);
              } else {
                const firstProduct = productsByBase.get(baseId)?.[0];
                if (firstProduct) {
                  const newIngredient = {
                    produto_base_id: baseId,
                    name: ingredient.nome || firstProduct.descricao,
                    quantity: adjustedQuantity,
                    unit: ingredient.unidade || firstProduct.unidade || 'kg',
                    category: firstProduct.categoria_descricao || 'Outros',
                    opcoes_embalagem: productsByBase.get(baseId) || [],
                    recipes: [recipe.nome_receita]
                  };
                  ingredientMap.set(key, newIngredient);
                  console.log(`Added new ingredient: ${newIngredient.name} - Quantity: ${newIngredient.quantity}`);
                } else {
                  console.log(`No product found for base ID: ${baseId}`);
                }
              }
            } else {
              console.log(`Skipping ingredient with zero quantity: ${ingredient.nome}`);
            }
          }
          
        } catch (error) {
          console.error(`Error processing recipe ${recipeId}:`, error);
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

    let aggregatedIngredients = Array.from(ingredientMap.values());
    
    if (aggregatedIngredients.length === 0) {
      console.log('Ingredient map is empty, using market products fallback to build basic list');
      const sampleProducts = marketProducts?.slice(0, 10) || [];
      for (const product of sampleProducts) {
        if (product.preco > 0) {
          const baseId = product.produto_base_id || product.produto_id;
          const qty = product.per_capita > 0
            ? product.per_capita * (typeof servingsPerDay === 'number' && servingsPerDay > 0 ? servingsPerDay : 100)
            : 1.0;
          ingredientMap.set(baseId, {
            produto_base_id: baseId,
            name: product.descricao,
            quantity: qty,
            unit: product.unidade || 'kg',
            category: product.categoria_descricao || 'Outros',
            opcoes_embalagem: productsByBase.get(baseId) || [product]
          });
        }
      }
      aggregatedIngredients = Array.from(ingredientMap.values());
    }
    
    console.log('Total ingredients processed:', aggregatedIngredients.length);
    if (aggregatedIngredients[0]) {
      console.log('Sample processed ingredient:', aggregatedIngredients[0]);
    }

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
        let selections = [];
        
        // Try AI-powered optimization if available
        if (openAIApiKey) {
          try {
            console.log(`Using AI optimization for ingredient: ${ingredient.name}`);
            
            const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'system',
                    content: `Você é um especialista em otimização de compras que analisa embalagens e preços para encontrar a melhor combinação custo-benefício. 
                    
                    Considere:
                    - Produtos em promoção têm prioridade
                    - Minimize sobras excessivas
                    - Prefira menos tipos de embalagem quando possível
                    - Calcule o custo real por unidade
                    
                    Retorne a resposta em JSON com este formato:
                    {
                      "selections": [
                        {
                          "produto_id": number,
                          "quantidade_pacotes": number,
                          "motivo": "string explicando a escolha"
                        }
                      ],
                      "total_cost": number,
                      "waste_percentage": number
                    }`
                  },
                  {
                    role: 'user',
                    content: `Otimize a compra para:
                    Produto: ${ingredient.name}
                    Quantidade necessária: ${ingredient.quantity} ${ingredient.unit}
                    
                    Opções disponíveis:
                    ${ingredient.opcoes_embalagem.map(op => 
                      `- ID: ${op.produto_id}, Embalagem: ${op.quantidade_embalagem} ${op.unidade}, Preço: R$ ${op.preco.toFixed(2)}${op.promocao || op.em_promocao ? ' (PROMOÇÃO)' : ''}, Desc: ${op.descricao}`
                    ).join('\n')}
                    
                    Configuração:
                    - Prioridade promoção: ${config.prioridade_promocao}
                    - Tolerância sobra: ${config.tolerancia_sobra_percentual}%
                    - Máximo tipos embalagem: ${config.maximo_tipos_embalagem_por_produto}`
                  }
                ]
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const aiOptimization = JSON.parse(aiData.choices[0].message.content);
              
              // Convert AI response to internal format
              selections = aiOptimization.selections.map((sel: any) => {
                const option = ingredient.opcoes_embalagem.find(op => op.produto_id === sel.produto_id);
                if (option) {
                  return {
                    produto_id: option.produto_id,
                    descricao: option.descricao,
                    quantidade_pacotes: sel.quantidade_pacotes,
                    quantidade_unitaria: option.quantidade_embalagem,
                    preco_unitario: option.preco,
                    custo_total: sel.quantidade_pacotes * option.preco,
                    em_promocao: option.promocao || option.em_promocao,
                    motivo_selecao: sel.motivo
                  };
                }
                return null;
              }).filter(Boolean);
              
              console.log(`AI optimization successful for ${ingredient.name}: ${selections.length} selections`);
            } else {
              throw new Error('AI API call failed');
            }
          } catch (aiError) {
            console.error('AI optimization failed, falling back to algorithm:', aiError);
            selections = [];
          }
        }
        
        // Fallback to algorithm optimization if AI failed or unavailable
        if (selections.length === 0) {
          selections = calculateOptimalPackaging(
            ingredient.quantity,
            ingredient.opcoes_embalagem,
            config
          );
        }

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
