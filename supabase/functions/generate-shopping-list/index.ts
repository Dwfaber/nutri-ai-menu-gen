import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função de otimização de embalagens
function calculateOptimalPackaging(quantidadeNecessaria: number, opcoes: any[], config: any): any[] {
  if (!opcoes.length) return [];
  
  console.log(`Otimizando ${quantidadeNecessaria} unidades com ${opcoes.length} opções`);
  
  // Ordenar por prioridade: promoção, depois menor preço por unidade
  const opcoesSorted = opcoes.sort((a, b) => {
    // Priorizar promoções se configurado
    if (config.prioridade_promocao === 'alta') {
      if (a.em_promocao && !b.em_promocao) return -1;
      if (!a.em_promocao && b.em_promocao) return 1;
    }
    
    // Calcular preço por unidade
    const precoUnitarioA = a.preco / a.quantidade_embalagem;
    const precoUnitarioB = b.preco / b.quantidade_embalagem;
    
    return precoUnitarioA - precoUnitarioB;
  });
  
  const selecoes = [];
  let quantidadeRestante = quantidadeNecessaria;
  
  // Algoritmo guloso: usar a melhor opção até atingir a quantidade
  for (const opcao of opcoesSorted) {
    if (quantidadeRestante <= 0) break;
    
    let quantidadePacotes = Math.ceil(quantidadeRestante / opcao.quantidade_embalagem);
    
    // Aplicar restrição de apenas valor inteiro se necessário
    if (opcao.apenas_valor_inteiro) {
      quantidadePacotes = Math.ceil(quantidadePacotes);
    }
    
    // Limitar número de tipos de embalagem
    if (selecoes.length >= config.maximo_tipos_embalagem_por_produto) {
      // Usar apenas a última (melhor) opção para o restante
      quantidadePacotes = Math.ceil(quantidadeRestante / opcao.quantidade_embalagem);
      quantidadeRestante = 0;
    } else {
      quantidadeRestante -= quantidadePacotes * opcao.quantidade_embalagem;
    }
    
    if (quantidadePacotes > 0) {
      selecoes.push({
        produto_id: opcao.produto_id,
        descricao: opcao.descricao,
        quantidade_pacotes: quantidadePacotes,
        quantidade_unitaria: opcao.quantidade_embalagem,
        preco_unitario: opcao.preco,
        custo_total: quantidadePacotes * opcao.preco,
        em_promocao: opcao.em_promocao,
        motivo_selecao: opcao.em_promocao ? 'Promoção' : 'Melhor preço'
      });
    }
    
    if (quantidadeRestante <= 0) break;
  }
  
  return selecoes;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== INICIANDO GERAÇÃO DE LISTA DE COMPRAS ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { menuId, clientName, budgetPredicted, servingsPerDay = 100 } = await req.json();

    console.log('Gerando lista de compras para cardápio:', menuId);
    console.log('Cliente:', clientName, 'Orçamento:', budgetPredicted, 'Porções/dia:', servingsPerDay);

    // Buscar informações do cardápio gerado
    const { data: menuData, error: menuError } = await supabase
      .from('generated_menus')
      .select('*')
      .eq('id', menuId)
      .single();

    if (menuError || !menuData) {
      console.error('Erro ao buscar cardápio:', menuError);
      throw new Error(`Cardápio não encontrado: ${menuId}`);
    }

    console.log('Cardápio encontrado:', {
      id: menuData.id,
      client_name: menuData.client_name,
      receitas_count: menuData.receitas_adaptadas?.length || 0
    });

    // Buscar produtos do mercado
    const { data: marketProducts, error: marketError } = await supabase
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .eq('solicitacao_id', (await supabase
        .from('co_solicitacao_produto_listagem')
        .select('solicitacao_id')
        .order('solicitacao_id', { ascending: false })
        .limit(1)
        .single()
      ).data?.solicitacao_id);

    if (marketError || !marketProducts) {
      console.error('Erro ao buscar produtos do mercado:', marketError);
      throw new Error('Produtos do mercado não encontrados');
    }

    console.log(`Produtos do mercado carregados: ${marketProducts.length}`);

    // Processar receitas adaptadas do cardápio
    const receitasAdaptadas = menuData.receitas_adaptadas || [];
    if (!receitasAdaptadas.length) {
      throw new Error('Nenhuma receita encontrada no cardápio');
    }

    // Extrair IDs das receitas
    const recipeIds = receitasAdaptadas
      .map((r: any) => r.receita_id_legado)
      .filter(Boolean);

    if (!recipeIds.length) {
      throw new Error('Nenhum ID de receita válido encontrado');
    }

    console.log('IDs das receitas:', recipeIds);

    // Buscar ingredientes das receitas
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('receita_ingredientes')
      .select('*, produto_base_descricao')
      .in('receita_id_legado', recipeIds);

    if (ingredientsError) {
      console.error('Erro ao buscar ingredientes:', ingredientsError);
      throw new Error('Erro ao buscar ingredientes das receitas');
    }

    console.log(`Ingredientes carregados: ${ingredients?.length || 0}`);

    // Calcular multiplicador de porções
    const servingsMultiplier = servingsPerDay;
    console.log('Multiplicador de porções:', servingsMultiplier);

    // Consolidar ingredientes por produto_base_id
    const consolidatedIngredients = new Map();

    // Processar receitas adaptadas primeiro (prioridade)
    for (const receitaAdaptada of receitasAdaptadas) {
      const ing = receitaAdaptada;
      const adaptedIngredients = ing.ingredientes || [];
      for (const adaptedIng of adaptedIngredients) {
        const produtoBaseId = adaptedIng.produto_base_id;
        if (!produtoBaseId) continue;
        
        const quantidadeNecessaria = Number(adaptedIng.quantidade || 0) * Number(servingsMultiplier);
        if (quantidadeNecessaria <= 0) continue;
        
        console.log(`[RECEITAS ADAPTADAS] Processando ingrediente: ${adaptedIng.produto_base_descricao || adaptedIng.nome}, qtd necessária: ${quantidadeNecessaria}`);

        // Add to consolidated ingredients map
        if (!consolidatedIngredients.has(produtoBaseId)) {
          consolidatedIngredients.set(produtoBaseId, {
            produto_base_id: produtoBaseId,
            nome: adaptedIng.produto_base_descricao || adaptedIng.nome || '',
            quantidade_total: 0,
            unidade: adaptedIng.unidade || 'GR',
            receitas: []
          });
        }

        const existingIngredient = consolidatedIngredients.get(produtoBaseId);
        existingIngredient.quantidade_total += quantidadeNecessaria;
        existingIngredient.receitas.push(ing.nome_receita || '');
      }
    }

    // Processar ingredientes das receitas legado (complementar)
    if (ingredients && ingredients.length > 0) {
      for (const ingredient of ingredients) {
        const produtoBaseId = Number(ingredient.produto_base_id);
        if (!produtoBaseId || produtoBaseId <= 0) {
          console.log(`Saltando ingrediente sem produto_base_id válido: ${ingredient.produto_base_descricao || ingredient.nome}`);
          continue;
        }

        // Calcular quantidade necessária
        const baseServing = Number(ingredient.quantidade_refeicoes || 1);
        const quantidadeNecessaria = Number(ingredient.quantidade || 0) * Number(servingsMultiplier / baseServing);
        
        if (quantidadeNecessaria <= 0) {
          console.log(`Saltando ingrediente ${ingredient.produto_base_descricao || ingredient.nome}: quantidade inválida`);
          continue;
        }
        
        console.log(`Processando ingrediente: ${ingredient.produto_base_descricao || ingredient.nome}, qtd base: ${ingredient.quantidade}, multiplicador: ${servingsMultiplier}, qtd necessária: ${quantidadeNecessaria}`);

        // Add to consolidated ingredients map
        if (!consolidatedIngredients.has(produtoBaseId)) {
          consolidatedIngredients.set(produtoBaseId, {
            produto_base_id: produtoBaseId,
            nome: ingredient.produto_base_descricao || '',
            quantidade_total: 0,
            unidade: ingredient.unidade || 'GR',
            receitas: []
          });
        }

        const existingIngredient = consolidatedIngredients.get(produtoBaseId);
        existingIngredient.quantidade_total += quantidadeNecessaria;
        existingIngredient.receitas.push(ingredient.nome || 'Receita não identificada');
      }
    }

    console.log(`Ingredientes consolidados: ${consolidatedIngredients.size}`);

    // Gerar itens da lista de compras
    const shoppingItems = [];
    let totalCost = 0;

    for (const [produtoBaseId, consolidatedIngredient] of consolidatedIngredients) {
      console.log(`\n--- Processando ingrediente: ${consolidatedIngredient.nome} ---`);
      console.log(`Produto Base ID: ${produtoBaseId}`);
      console.log(`Quantidade total necessária: ${consolidatedIngredient.quantidade_total} ${consolidatedIngredient.unidade}`);

      // Buscar produtos do mercado para este produto_base_id
      const productOptions = marketProducts.filter(p => 
        Number(p.produto_base_id) === Number(produtoBaseId)
      );

      if (!productOptions.length) {
        console.log(`Nenhum produto encontrado no mercado para produto_base_id: ${produtoBaseId}`);
        continue;
      }

      console.log(`Opções de produto encontradas: ${productOptions.length}`);

      // Usar primeiro produto como referência
      const firstProduct = productOptions[0];

      try {
        // Otimização usando a função de cálculo
        const packageOptions = productOptions.map(prod => ({
          produto_id: prod.produto_id,
          produto_base_id: prod.produto_base_id,
          descricao: prod.descricao,
          quantidade_embalagem: prod.produto_base_quantidade_embalagem || 1000,
          unidade: prod.unidade,
          preco: prod.preco,
          preco_compra: prod.preco_compra || prod.preco,
          promocao: prod.em_promocao_sim_nao || false,
          em_promocao: prod.em_promocao_sim_nao || false,
          apenas_valor_inteiro: prod.apenas_valor_inteiro_sim_nao || false,
          disponivel: true
        }));

        const optimizationConfig = {
          prioridade_promocao: 'media',
          tolerancia_sobra_percentual: 15,
          preferir_produtos_integrais: false,
          maximo_tipos_embalagem_por_produto: 2,
          considerar_custo_compra: false
        };

        const optimizedPackaging = calculateOptimalPackaging(
          consolidatedIngredient.quantidade_total,
          packageOptions,
          optimizationConfig
        );

        if (optimizedPackaging.length > 0) {
          console.log(`Otimização realizada: ${optimizedPackaging.length} seleções`);
          
          for (const selection of optimizedPackaging) {
            shoppingItems.push({
              product_id_legado: String(selection.produto_id),
              product_name: consolidatedIngredient.nome,
              category: consolidatedIngredient.unidade,
              quantity: selection.quantidade_pacotes,
              unit: `${selection.quantidade_unitaria}${firstProduct.unidade}`,
              unit_price: selection.preco_unitario,
              total_price: selection.custo_total,
              available: true,
              promocao: selection.em_promocao,
              optimized: true
            });
            
            totalCost += selection.custo_total;
          }
        } else {
          console.log('Falha na otimização, usando cálculo simples');
          
          // Calcular preço total corrigido com conversão de unidades
          let finalUnitPrice = firstProduct.preco || 0;
          let finalQuantity = consolidatedIngredient.quantidade_total;
          
          // Se o produto tem quantidade de embalagem diferente da unidade base, ajustar preço
          const packageQuantity = firstProduct.produto_base_quantidade_embalagem || 1000;
          const ingredientUnit = consolidatedIngredient.unidade?.toUpperCase() || 'GR';
          const productUnit = firstProduct.unidade?.toUpperCase() || 'GR';
          
          console.log(`Calculando preço para ${consolidatedIngredient.nome}:`);
          console.log(`- Quantidade necessária: ${consolidatedIngredient.quantidade_total} ${ingredientUnit}`);
          console.log(`- Produto: ${firstProduct.descricao}`);
          console.log(`- Preço da embalagem: R$ ${finalUnitPrice}`);
          console.log(`- Quantidade da embalagem: ${packageQuantity} ${productUnit}`);
          
          // Converter quantidade necessária para a mesma unidade da embalagem
          let quantidadeConvertida = finalQuantity;
          if (ingredientUnit === 'GR' && productUnit === 'KG') {
            quantidadeConvertida = finalQuantity / 1000; // converter gramas para kg
          } else if (ingredientUnit === 'ML' && productUnit === 'L') {
            quantidadeConvertida = finalQuantity / 1000; // converter ml para litros
          } else if (ingredientUnit === 'KG' && productUnit === 'GR') {
            quantidadeConvertida = finalQuantity * 1000; // converter kg para gramas
          } else if (ingredientUnit === 'L' && productUnit === 'ML') {
            quantidadeConvertida = finalQuantity * 1000; // converter litros para ml
          }
          
          // Calcular quantas embalagens são necessárias
          const embalagensNecessarias = quantidadeConvertida / packageQuantity;
          const totalPrice = embalagensNecessarias * finalUnitPrice;
          
          console.log(`- Quantidade convertida: ${quantidadeConvertida} ${productUnit}`);
          console.log(`- Embalagens necessárias: ${embalagensNecessarias.toFixed(4)}`);
          console.log(`- Preço total: R$ ${totalPrice.toFixed(2)}`);

          shoppingItems.push({
            product_id_legado: String(firstProduct.produto_id),
            product_name: consolidatedIngredient.nome || firstProduct.descricao,
            category: firstProduct.categoria_descricao || 'Sem categoria',
            quantity: Math.ceil(embalagensNecessarias),
            unit: firstProduct.unidade,
            unit_price: finalUnitPrice,
            total_price: totalPrice,
            available: true,
            promocao: firstProduct.em_promocao_sim_nao || false,
            optimized: false
          });
          
          totalCost += totalPrice;
        }
      } catch (error) {
        console.error(`Erro ao processar ingrediente ${consolidatedIngredient.nome}:`, error);
        continue;
      }
    }

    console.log(`\n=== RESUMO ===`);
    console.log(`Total de itens: ${shoppingItems.length}`);
    console.log(`Custo total: R$ ${totalCost.toFixed(2)}`);

    // Determinar status do orçamento
    const budgetStatus = totalCost <= budgetPredicted ? 'within_budget' : 'over_budget';

    // Criar lista de compras no banco
    const { data: shoppingList, error: listError } = await supabase
      .from('shopping_lists')
      .insert({
        menu_id: menuId,
        client_name: clientName,
        budget_predicted: budgetPredicted,
        cost_actual: totalCost,
        status: budgetStatus
      })
      .select('id')
      .single();

    if (listError) {
      console.error('Erro ao criar lista de compras:', listError);
      throw new Error('Erro ao salvar lista de compras');
    }

    // Inserir itens da lista
    if (shoppingItems.length > 0) {
      const itemsToInsert = shoppingItems.map(item => ({
        ...item,
        shopping_list_id: shoppingList.id
      }));

      const { error: itemsError } = await supabase
        .from('shopping_list_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Erro ao inserir itens:', itemsError);
        throw new Error('Erro ao salvar itens da lista');
      }
    }

    const response = {
      success: true,
      shopping_list_id: shoppingList.id,
      total_items: shoppingItems.length,
      total_cost: totalCost,
      budget_status: budgetStatus,
      optimization_summary: {
        ingredients_processed: consolidatedIngredients.size,
        items_generated: shoppingItems.length,
        optimized_items: shoppingItems.filter(item => item.optimized).length
      }
    };

    console.log('=== LISTA DE COMPRAS GERADA COM SUCESSO ===');
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na geração da lista de compras:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: 'Erro interno na geração da lista de compras'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});