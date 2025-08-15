import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sistema otimizado de embalagens com validação rigorosa
interface PackagingOption {
  produto_id: any;
  descricao: string;
  quantidade_embalagem: number;
  preco: number;
  apenas_valor_inteiro: boolean;
  em_promocao: boolean;
  disponivel?: boolean;
}

interface OptimizationResult {
  opcoes_selecionadas: Array<{
    produto_id: any;
    descricao: string;
    quantidade_pacotes: number;
    quantidade_total: number;
    custo_total: number;
    eficiencia: number;
    motivo_selecao: string;
  }>;
  quantidade_final: number;
  custo_total: number;
  desperdicio: number;
  desperdicio_percentual: number;
}

function validateIngredientData(ingredient: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!ingredient.produto_base_id || ingredient.produto_base_id <= 0) {
    errors.push('produto_base_id inválido');
  }
  
  if (!ingredient.quantidade_total || ingredient.quantidade_total <= 0) {
    errors.push('quantidade_total inválida');
  }
  
  if (!ingredient.unidade || ingredient.unidade.trim() === '') {
    errors.push('unidade não especificada');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function calculateOptimalPackaging(quantidadeNecessaria: number, opcoes: PackagingOption[]): OptimizationResult {
  if (quantidadeNecessaria <= 0 || opcoes.length === 0) {
    throw new Error('Quantidade inválida ou sem opções de embalagem');
  }
  
  console.log(`Otimizando ${quantidadeNecessaria} unidades com ${opcoes.length} opções`);
  
  // Calcular eficiência (quantidade/preço) e ordenar
  const opcoesComEficiencia = opcoes
    .filter(opcao => opcao.preco > 0 && opcao.quantidade_embalagem > 0)
    .map(opcao => ({
      ...opcao,
      eficiencia: opcao.quantidade_embalagem / opcao.preco,
      preco_por_unidade: opcao.preco / opcao.quantidade_embalagem
    }))
    .sort((a, b) => {
      // Priorizar promoções
      if (a.em_promocao && !b.em_promocao) return -1;
      if (!a.em_promocao && b.em_promocao) return 1;
      // Depois menor preço por unidade
      return a.preco_por_unidade - b.preco_por_unidade;
    });
  
  let quantidadeRestante = quantidadeNecessaria;
  const opcoesSelecionadas = [];
  let custoTotal = 0;
  
  for (const opcao of opcoesComEficiencia) {
    if (quantidadeRestante <= 0) break;
    
    // Calcular quantos pacotes desta opção usar
    let quantidadePacotes = Math.floor(quantidadeRestante / opcao.quantidade_embalagem);
    
    // Se apenas valor inteiro e ainda sobra quantidade
    if (opcao.apenas_valor_inteiro && quantidadeRestante % opcao.quantidade_embalagem > 0) {
      quantidadePacotes += 1;
    }
    
    if (quantidadePacotes > 0) {
      const quantidadeTotal = quantidadePacotes * opcao.quantidade_embalagem;
      const custoOpcao = quantidadePacotes * opcao.preco;
      
      opcoesSelecionadas.push({
        produto_id: opcao.produto_id,
        descricao: opcao.descricao,
        quantidade_pacotes: quantidadePacotes,
        quantidade_total: quantidadeTotal,
        custo_total: custoOpcao,
        eficiencia: opcao.eficiencia,
        motivo_selecao: opcao.em_promocao ? 'Promoção' : 'Melhor preço'
      });
      
      quantidadeRestante -= quantidadeTotal;
      custoTotal += custoOpcao;
    }
  }
  
  // Se ainda sobra quantidade, usar a opção mais eficiente
  if (quantidadeRestante > 0 && opcoesComEficiencia.length > 0) {
    const melhorOpcao = opcoesComEficiencia[0];
    const pacotesAdicionais = Math.ceil(quantidadeRestante / melhorOpcao.quantidade_embalagem);
    
    const opcaoExistente = opcoesSelecionadas.find(o => o.produto_id === melhorOpcao.produto_id);
    if (opcaoExistente) {
      opcaoExistente.quantidade_pacotes += pacotesAdicionais;
      opcaoExistente.quantidade_total += pacotesAdicionais * melhorOpcao.quantidade_embalagem;
      opcaoExistente.custo_total += pacotesAdicionais * melhorOpcao.preco;
    } else {
      opcoesSelecionadas.push({
        produto_id: melhorOpcao.produto_id,
        descricao: melhorOpcao.descricao,
        quantidade_pacotes: pacotesAdicionais,
        quantidade_total: pacotesAdicionais * melhorOpcao.quantidade_embalagem,
        custo_total: pacotesAdicionais * melhorOpcao.preco,
        eficiencia: melhorOpcao.eficiencia,
        motivo_selecao: 'Completar quantidade necessária'
      });
    }
    
    custoTotal += pacotesAdicionais * melhorOpcao.preco;
  }
  
  const quantidadeFinal = opcoesSelecionadas.reduce((sum, o) => sum + o.quantidade_total, 0);
  const desperdicio = Math.max(0, quantidadeFinal - quantidadeNecessaria);
  const desperdicioPercentual = (desperdicio / quantidadeNecessaria) * 100;
  
  console.log(`Otimização concluída: ${opcoesSelecionadas.length} opções, desperdício: ${desperdicioPercentual.toFixed(1)}%`);
  
  return {
    opcoes_selecionadas: opcoesSelecionadas,
    quantidade_final: quantidadeFinal,
    custo_total: custoTotal,
    desperdicio,
    desperdicio_percentual: Math.round(desperdicioPercentual * 100) / 100
  };
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
      .maybeSingle();

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
    const { data: latestSolicitacao, error: solicitacaoError } = await supabase
      .from('co_solicitacao_produto_listagem')
      .select('solicitacao_id')
      .order('solicitacao_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (solicitacaoError || !latestSolicitacao) {
      console.error('Erro ao buscar última solicitação:', solicitacaoError);
      throw new Error('Nenhuma solicitação de produtos encontrada');
    }

    const { data: marketProducts, error: marketError } = await supabase
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .eq('solicitacao_id', latestSolicitacao.solicitacao_id);

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
            nome: adaptedIng.produto_base_descricao || 'Ingrediente não identificado',
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

    // Processar ingredientes das receitas legado com validação rigorosa
    const warnings = [];
    
    if (ingredients && ingredients.length > 0) {
      for (const ingredient of ingredients) {
        // Validação rigorosa de ingredientes
        const validation = validateIngredientData({
          produto_base_id: ingredient.produto_base_id,
          quantidade_total: ingredient.quantidade,
          unidade: ingredient.unidade
        });
        
        if (!validation.valid) {
          console.error(`Ingrediente inválido ${ingredient.produto_base_descricao}:`, validation.errors);
          warnings.push(`Ingrediente ${ingredient.produto_base_descricao}: ${validation.errors.join(', ')}`);
          continue; // Pular ingrediente inválido mas continuar processamento
        }

        const produtoBaseId = Number(ingredient.produto_base_id);

        // Calcular quantidade necessária usando quantidade_refeicoes real
        const baseServing = Number(ingredient.quantidade_refeicoes || 100); // fallback para 100
        const quantidadeNecessaria = Number(ingredient.quantidade || 0) * Number(servingsMultiplier / baseServing);
        
        console.log(`Processando ingrediente: ${ingredient.produto_base_descricao || ingredient.nome}`);
        console.log(`- Qtd base: ${ingredient.quantidade} ${ingredient.unidade}`);
        console.log(`- Base serving: ${baseServing} refeições`);
        console.log(`- Target serving: ${servingsMultiplier} refeições`);
        console.log(`- Fator: ${(servingsMultiplier / baseServing).toFixed(3)}`);
        console.log(`- Qtd necessária: ${quantidadeNecessaria} ${ingredient.unidade}`);

        // Add to consolidated ingredients map
        if (!consolidatedIngredients.has(produtoBaseId)) {
          consolidatedIngredients.set(produtoBaseId, {
            produto_base_id: produtoBaseId,
            nome: ingredient.produto_base_descricao || 'Ingrediente não identificado',
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
    
    // Log warnings para monitoramento
    if (warnings.length > 0) {
      console.warn('⚠️ Avisos durante processamento de ingredientes:', warnings);
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
          packageOptions
        );

        if (optimizedPackaging.opcoes_selecionadas && optimizedPackaging.opcoes_selecionadas.length > 0) {
          console.log(`Otimização realizada: ${optimizedPackaging.opcoes_selecionadas.length} seleções`);
          console.log(`Desperdício: ${optimizedPackaging.desperdicio_percentual}%`);
          
          for (const selection of optimizedPackaging.opcoes_selecionadas) {
            shoppingItems.push({
              product_id_legado: String(selection.produto_id),
              product_name: consolidatedIngredient.nome,
              category: consolidatedIngredient.unidade,
              quantity: selection.quantidade_pacotes,
              unit: firstProduct.unidade,
              unit_price: selection.custo_total / selection.quantidade_pacotes,
              total_price: selection.custo_total,
              available: true,
              promocao: packageOptions.find(p => p.produto_id === selection.produto_id)?.em_promocao || false,
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
            product_name: consolidatedIngredient.nome,
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
      .maybeSingle();

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