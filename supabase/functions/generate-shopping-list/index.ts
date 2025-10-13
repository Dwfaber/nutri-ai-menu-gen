import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== SISTEMA CORRIGIDO DE LISTA DE COMPRAS =====
class ShoppingListGeneratorFixed {
  private readonly CONVERSOES_UNIDADES = {
    // Peso
    'GR': { para_kg: 0.001, tipo: 'peso' },
    'G': { para_kg: 0.001, tipo: 'peso' },
    'GRAMA': { para_kg: 0.001, tipo: 'peso' },
    'KG': { para_kg: 1, tipo: 'peso' },
    'KILO': { para_kg: 1, tipo: 'peso' },
    
    // Volume
    'ML': { para_litro: 0.001, tipo: 'volume' },
    'LT': { para_litro: 1, tipo: 'volume' },
    'L': { para_litro: 1, tipo: 'volume' },
    'LITRO': { para_litro: 1, tipo: 'volume' },
    
    // Unidades
    'UN': { valor: 1, tipo: 'unidade' },
    'UND': { valor: 1, tipo: 'unidade' },
    'UNIDADE': { valor: 1, tipo: 'unidade' },
  };

  constructor(private supabase: any) {}

  /**
   * Calcula orçamento previsto a partir dos dados do cardápio
   */
  private computeBudget(menuData: any, servingsPerDay: number): number {
    console.log('💰 === CALCULANDO ORÇAMENTO PREVISTO ===');
    
    // Prioridade 1: Se total_cost está preenchido e válido
    if (menuData.total_cost && menuData.total_cost > 0) {
      console.log(`✅ Usando total_cost: R$ ${menuData.total_cost.toFixed(2)}`);
      return menuData.total_cost;
    }
    
    // Prioridade 2: Calcular a partir de menu_data.dias
    if (menuData.menu_data?.dias && Array.isArray(menuData.menu_data.dias)) {
      console.log(`🔍 Calculando de menu_data.dias (${menuData.menu_data.dias.length} dias)...`);
      
      let weeklyTotal = 0;
      const dailyCosts: number[] = [];
      
      for (let i = 0; i < menuData.menu_data.dias.length; i++) {
        const day = menuData.menu_data.dias[i];
        let dayCost = 0;
        
        // Se dia tem custo_total_dia direto
        if (day.custo_total_dia && day.custo_total_dia > 0) {
          dayCost = day.custo_total_dia;
          console.log(`   Dia ${i + 1}: R$ ${dayCost.toFixed(2)} (via custo_total_dia)`);
        }
        // Senão, somar das receitas do dia
        else if (day.receitas && Array.isArray(day.receitas)) {
          for (const receita of day.receitas) {
            // custo_total_receita é o custo total dessa receita para o dia
            if (receita.custo_total_receita && receita.custo_total_receita > 0) {
              dayCost += receita.custo_total_receita;
            }
            // Senão, usar custo_por_refeicao
            else if (receita.custo_por_refeicao) {
              const custoReceita = Number(receita.custo_por_refeicao);
              
              // Se custo_por_refeicao é "custo por pessoa" (valor relativamente baixo)
              // Multiplicar pelo número de porções
              if (custoReceita < 30) {
                const porcoes = receita.porcoes || servingsPerDay;
                dayCost += custoReceita * porcoes;
                console.log(`     ${receita.nome || 'Receita'}: R$ ${custoReceita.toFixed(2)} × ${porcoes} porções`);
              } else {
                // Caso contrário, é o custo total da receita
                dayCost += custoReceita;
              }
            }
            // Fallback para custo_por_porcao
            else if (receita.custo_por_porcao) {
              const porcoes = receita.porcoes || servingsPerDay;
              dayCost += receita.custo_por_porcao * porcoes;
            }
          }
          console.log(`   Dia ${i + 1}: R$ ${dayCost.toFixed(2)} (soma de receitas)`);
        }
        
        dailyCosts.push(dayCost);
        weeklyTotal += dayCost;
      }
      
      console.log(`📊 Resumo semanal:`);
      console.log(`   Custos diários: ${dailyCosts.map(c => `R$ ${c.toFixed(2)}`).join(', ')}`);
      console.log(`   Total semanal: R$ ${weeklyTotal.toFixed(2)}`);
      
      if (weeklyTotal > 0) {
        return weeklyTotal;
      }
    }
    
    // Prioridade 3: Usar cost_per_meal * meals_per_day * dias
    if (menuData.cost_per_meal && menuData.cost_per_meal > 0) {
      const numDays = menuData.menu_data?.dias?.length || 5; // Default 5 dias úteis
      const totalEstimated = menuData.cost_per_meal * numDays;
      console.log(`📊 Calculado via cost_per_meal: R$ ${menuData.cost_per_meal.toFixed(2)} × ${numDays} dias = R$ ${totalEstimated.toFixed(2)}`);
      return totalEstimated;
    }
    
    console.warn('⚠️ Nenhum método de cálculo funcionou, retornando 0');
    return 0;
  }

  async gerarListaComprasCorrigida(menuId: string, clientName: string, budgetPredicted: number, servingsPerDay: number, existingListId?: string) {
    console.log(`🛒 === GERAÇÃO DE LISTA CORRIGIDA ===`);
    console.log(`📋 Menu ID: ${menuId}`);
    console.log(`👤 Cliente: ${clientName}`);
    console.log(`🍽️ Porções/dia: ${servingsPerDay}`);
    
    try {
      // PASSO 1: Buscar cardápio com logs detalhados
      console.log(`🔍 Buscando cardápio com ID: ${menuId}`);
      console.log(`📊 Tipo do menuId: ${typeof menuId}, length: ${menuId?.length}`);
      
      const { data: menuData, error: menuError } = await this.supabase
        .from('generated_menus')
        .select('id, client_name, receitas_adaptadas, receitas_ids, created_at, total_cost, cost_per_meal, meals_per_day, menu_data')
        .eq('id', menuId)
        .maybeSingle();

      if (menuError) {
        console.error('❌ Erro na busca do cardápio:', menuError);
        throw new Error(`Erro na busca do cardápio: ${menuError.message}`);
      }

      if (!menuData) {
        console.error('❌ Cardápio não encontrado na base de dados');
        console.log('🔍 Tentando listar cardápios existentes...');
        
        // Log para debug: mostrar cardápios existentes
        const { data: existingMenus } = await this.supabase
          .from('generated_menus')
          .select('id, client_name, created_at')
          .limit(5)
          .order('created_at', { ascending: false });
          
        console.log('📋 Últimos cardápios na base:', existingMenus?.map(m => `${m.id} - ${m.client_name}`));
        throw new Error(`Cardápio não encontrado: ${menuId}`);
      }

      console.log(`✅ Cardápio encontrado: ${menuData.client_name}`);
      console.log(`📅 Criado em: ${menuData.created_at}`);
      console.log(`🍽️ Receitas adaptadas: ${menuData.receitas_adaptadas?.length || 0} receitas`);
      
      // CALCULAR ORÇAMENTO PREVISTO CORRETO
      const computedBudget = this.computeBudget(menuData, servingsPerDay);
      console.log(`💰 Orçamento calculado: R$ ${computedBudget.toFixed(2)}`);
      
      // ESTRATÉGIA EM CASCATA: receitas_adaptadas → receitas_ids → erro
      let receitasAdaptadas = menuData.receitas_adaptadas || [];

      // 🚨 fallback quando receitas_adaptadas está vazio
      if (!Array.isArray(receitasAdaptadas) || receitasAdaptadas.length === 0) {
        console.warn("⚠️ receitas_adaptadas vazio, tentando fallback com receitas_ids");

        if (Array.isArray(menuData.receitas_ids) && menuData.receitas_ids.length > 0) {
          receitasAdaptadas = menuData.receitas_ids.map((id: string) => ({
            receita_id_legado: id
          }));
          console.log(`✅ Fallback: ${receitasAdaptadas.length} receitas recuperadas via receitas_ids`);
        } else {
          console.error("❌ Nenhuma receita associada a este cardápio:", menuData.id);
          console.log('📋 Conteúdo receitas_adaptadas:', menuData.receitas_adaptadas);
          console.log('📋 Conteúdo receitas_ids:', menuData.receitas_ids);
          throw new Error(`Cardápio ${menuData.id} não possui receitas associadas`);
        }
      } else {
        console.log(`✅ Usando receitas_adaptadas: ${receitasAdaptadas.length} receitas`);
      }

      // PASSO 2: Buscar ingredientes das receitas - NORMALIZAÇÃO DE IDs APRIMORADA
      const recipeIds = [];
      
      for (const receita of receitasAdaptadas) {
        let recipeId = null;
        
        console.log(`🔍 Processando receita:`, {
          receita_id_legado: receita.receita_id_legado,
          nome: receita.nome,
          id: receita.id,
          full_object: receita
        });
        
        // Prioridade 1: receita_id_legado (string ou number)
        if (receita.receita_id_legado) {
          const legadoId = parseInt(receita.receita_id_legado);
          if (!isNaN(legadoId) && legadoId >= 1) {
            recipeId = legadoId;
            console.log(`✅ ID via receita_id_legado: ${recipeId}`);
          }
        }
        
        // Prioridade 2: campo 'nome' se for numérico
        if (!recipeId && receita.nome && !isNaN(parseInt(receita.nome))) {
          const nomeId = parseInt(receita.nome);
          if (nomeId >= 1) {
            recipeId = nomeId;
            console.log(`🔄 ID normalizado: ${receita.receita_id_legado} → ${recipeId} (via campo nome)`);
          }
        }
        
        // Prioridade 3: campo 'id' 
        if (!recipeId && receita.id && !isNaN(parseInt(receita.id))) {
          const idField = parseInt(receita.id);
          if (idField >= 1) {
            recipeId = idField;
            console.log(`🔄 ID normalizado: ${receita.receita_id_legado} → ${recipeId} (via campo id)`);
          }
        }
        
        // Buscar pelo nome da receita como último recurso
        if (!recipeId && receita.nome && typeof receita.nome === 'string') {
          console.log(`🔍 Tentando buscar receita pelo nome: "${receita.nome}"`);
          
          // Fazer busca na tabela de receitas pelo nome
          try {
            const { data: receitaEncontrada } = await this.supabase
              .from('receitas_legado')
              .select('receita_id_legado')
              .ilike('nome_receita', `%${receita.nome}%`)
              .limit(1)
              .maybeSingle();
              
            if (receitaEncontrada?.receita_id_legado) {
              recipeId = parseInt(receitaEncontrada.receita_id_legado);
              console.log(`🎯 ID encontrado via nome: ${recipeId} para "${receita.nome}"`);
            }
          } catch (error) {
            console.warn(`⚠️ Erro ao buscar receita por nome:`, error);
          }
        }
        
        if (recipeId) {
          recipeIds.push(recipeId);
        } else {
          console.warn(`⚠️ Receita inválida ignorada:`, receita);
        }
      }
      
      console.log(`🔍 IDs de receitas normalizados: [${recipeIds.join(', ')}]`);

      if (!recipeIds.length) {
        throw new Error('Nenhum ID de receita válido encontrado');
      }

      const { data: ingredientsRaw, error: ingredientsError } = await this.supabase
        .from('receita_ingredientes')
        .select('receita_id_legado, nome, produto_base_id, produto_base_descricao, quantidade, unidade, quantidade_refeicoes')
        .in('receita_id_legado', recipeIds)
        .order('receita_id_legado');
      
      if (ingredientsError) {
        throw new Error('Erro ao buscar ingredientes das receitas');
      }
      
      let ingredients = ingredientsRaw || [];
      
      // Fallback: usar JSON de receitas_legado quando não houver ingredientes estruturados
      if (!ingredients.length) {
        console.warn('⚠️ Nenhum ingrediente encontrado em receita_ingredientes. Tentando fallback via receitas_legado.');
        const { data: receitasJson, error: receitasError } = await this.supabase
          .from('receitas_legado')
          .select('receita_id_legado, nome_receita, ingredientes, porcoes, quantidade_refeicoes')
          .in('receita_id_legado', recipeIds);
        
        if (receitasError) {
          console.warn('⚠️ Erro ao buscar receitas_legado para fallback:', receitasError);
        } else if (receitasJson && receitasJson.length) {
          const flatten: any[] = [];
          for (const r of receitasJson) {
            const basePorcoes = parseInt(r.quantidade_refeicoes) || parseInt(r.porcoes) || 100;
            const arr = Array.isArray(r.ingredientes) ? r.ingredientes : [];
            for (const ing of arr) {
              const prodId = ing.produto_base_id ?? ing.produto_id ?? ing.id ?? null;
              const nomeDesc = ing.produto_base_descricao ?? ing.descricao ?? ing.nome ?? 'Ingrediente';
              const unidade = ing.unidade ?? ing.unidade_medida ?? 'UN';
              const qtdNum = typeof ing.quantidade === 'number' ? ing.quantidade : parseFloat(ing.quantidade);
              flatten.push({
                receita_id_legado: r.receita_id_legado,
                nome: r.nome_receita,
                produto_base_id: prodId,
                produto_base_descricao: nomeDesc,
                quantidade: isNaN(qtdNum) ? 0 : qtdNum,
                unidade,
                quantidade_refeicoes: basePorcoes
              });
            }
          }
          ingredients = flatten.filter(i => i.quantidade > 0);
        }
      }
      
      console.log(`📦 ${ingredients.length} ingredientes encontrados nas receitas`);
      
      // PASSO 3: Consolidar ingredientes
      const ingredientesConsolidados = this.consolidarIngredientes(ingredients, servingsPerDay);
      console.log(`🔗 ${ingredientesConsolidados.size} ingredientes únicos consolidados`);
      
      // Se nenhum ingrediente consolidado, criar itens placeholder baseados no cardápio
      if (ingredientesConsolidados.size === 0) {
        console.warn('⚠️ Nenhum ingrediente encontrado. Criando itens placeholder baseados no cardápio...');
        
        // Criar categorias principais com distribuição inteligente do orçamento
        const categoriasPrincipais = [
          { nome: 'Proteínas', percentual: 0.35, unidade: 'KG' },
          { nome: 'Carboidratos', percentual: 0.25, unidade: 'KG' },
          { nome: 'Vegetais e Verduras', percentual: 0.20, unidade: 'KG' },
          { nome: 'Condimentos e Temperos', percentual: 0.10, unidade: 'UN' },
          { nome: 'Óleos e Gorduras', percentual: 0.10, unidade: 'L' }
        ];
        
        categoriasPrincipais.forEach((categoria, index) => {
          const valorCategoria = budgetPredicted * categoria.percentual;
          const quantidade = Math.max(1, Math.ceil(servingsPerDay / 20)); // Quantidade baseada nas porções
          
          // Adicionar direto na coleção de ingredientes consolidados
          ingredientesConsolidados.set(`placeholder_${index + 1}`, {
            produto_base_id: `placeholder_${index + 1}`,
            nome: `Ingredientes - ${categoria.nome}`,
            unidade_padrao: categoria.unidade,
            quantidade_total: quantidade,
            receitas: new Set(['Cardápio Genérico']),
            valor_categoria: valorCategoria
          });
        });
        
        console.log(`✅ Criados ${categoriasPrincipais.length} itens placeholder por categoria`);
      }
      
      // PASSO 4: Buscar produtos do mercado
      const { data: produtosMercado, error: mercadoError } = await this.supabase
        .from('co_solicitacao_produto_listagem')
        .select('produto_base_id, descricao, preco, produto_base_quantidade_embalagem, apenas_valor_inteiro_sim_nao, em_promocao_sim_nao, unidade')
        .gt('preco', 0)
        .order('produto_base_id')
        .order('preco');
      
      if (mercadoError) {
        console.error('❌ Erro ao buscar produtos do mercado:', mercadoError);
        throw mercadoError;
      }
      
      // 🔍 CORREÇÃO 1: Validação de Query do Mercado
      if (!produtosMercado || produtosMercado.length === 0) {
        console.error('⚠️ AVISO CRÍTICO: Nenhum produto retornado do mercado!');
        console.error('   Verifique se co_solicitacao_produto_listagem tem dados com preco > 0');
      } else {
        console.log(`🛍️ ${produtosMercado.length} produtos disponíveis no mercado`);
        console.log('📦 Amostra produtos mercado (primeiros 5):');
        produtosMercado.slice(0, 5).forEach(p => {
          console.log(`   - ID:${p.produto_base_id} (tipo: ${typeof p.produto_base_id}) | ${p.descricao} | R$ ${p.preco}`);
        });
      }
      
      // PASSO 5: Gerar lista de compras
      const listaCompras = [];
      const ingredientesNaoEncontrados = [];
      let custoTotal = 0;
      let itensPromocao = 0;
      let economiaPromocoes = 0;
      
      for (const [produtoId, ingrediente] of ingredientesConsolidados) {
        // Para itens placeholder, criar direto sem buscar no mercado
        if (String(produtoId).startsWith('placeholder_')) {
          const valorItem = ingrediente.valor_categoria || (budgetPredicted * 0.2);
          
          const itemPlaceholder = {
            produto_base_id: produtoId,
            nome_ingrediente: ingrediente.nome,
            unidade_padrao: ingrediente.unidade_padrao,
            quantidade_comprar: ingrediente.quantidade_total.toString(),
            produto_selecionado: ingrediente.nome,
            produto_id_mercado: null,
            preco_unitario: (valorItem / ingrediente.quantidade_total).toFixed(2),
            custo_total_compra: valorItem.toFixed(2),
            sobra: '0.000',
            percentual_sobra: '0.0',
            em_promocao: false,
            economia_promocao: '0.00',
            receitas_usando: Array.from(ingrediente.receitas),
            categoria_estimada: this.estimarCategoria(ingrediente.nome),
            available: true
          };
          
          listaCompras.push(itemPlaceholder);
          custoTotal += valorItem;
          console.log(`✅ ${ingrediente.nome}: item placeholder criado - R$ ${valorItem.toFixed(2)}`);
          continue;
        }
        
        // 🔍 CORREÇÃO 2: Log Detalhado de Debug
        console.log(`🔍 DEBUG Ingrediente: ${ingrediente.nome}`);
        console.log(`   - produto_base_id: ${ingrediente.produto_base_id} (tipo: ${typeof ingrediente.produto_base_id})`);
        console.log(`   - quantidade_total: ${ingrediente.quantidade_total} ${ingrediente.unidade_padrao}`);
        
        const resultado = this.processarIngredienteParaCompra(
          ingrediente, 
          produtosMercado || []
        );
        
        if (resultado.encontrado) {
          listaCompras.push(resultado.item);
          custoTotal += parseFloat(resultado.item.custo_total_compra);
          
          if (resultado.item.em_promocao) {
            itensPromocao++;
            economiaPromocoes += parseFloat(resultado.item.economia_promocao || '0');
          }
          
          console.log(`✅ ${resultado.item.nome_ingrediente}: ${resultado.item.quantidade_comprar} ${resultado.item.unidade} = R$ ${resultado.item.custo_total_compra}`);
        } else {
          // Criar item placeholder
          const itemPlaceholder = {
            produto_base_id: ingrediente.produto_base_id,
            nome_ingrediente: ingrediente.nome,
            produto_mercado: 'Produto não encontrado no mercado',
            quantidade_necessaria: ingrediente.quantidade_total.toFixed(3),
            quantidade_comprar: ingrediente.quantidade_total.toFixed(3),
            unidade: ingrediente.unidade_padrao,
            preco_unitario: '0.00',
            custo_total_compra: '0.00',
            sobra: '0.000',
            percentual_sobra: '0.0',
            em_promocao: false,
            economia_promocao: '0.00',
            receitas_usando: Array.from(ingrediente.receitas),
            categoria_estimada: this.estimarCategoria(ingrediente.nome),
            available: false
          };
          
          listaCompras.push(itemPlaceholder);
          
          ingredientesNaoEncontrados.push({
            nome: ingrediente.nome,
            quantidade: `${ingrediente.quantidade_total.toFixed(3)} ${ingrediente.unidade_padrao}`,
            receitas: Array.from(ingrediente.receitas)
          });
          console.log(`❌ ${ingrediente.nome}: criado placeholder`);
        }
      }
      
      // PASSO 6: Tratativa de custo zero e agrupar por categoria
      if (custoTotal === 0 && budgetPredicted > 0) {
        console.warn('⚠️ Nenhum item encontrado no mercado. Distribuindo orçamento previsto entre os itens.');
        
        // Distribuir budgetPredicted proporcionalmente entre os itens
        const totalItems = listaCompras.length;
        if (totalItems > 0) {
          const costPerItem = budgetPredicted / totalItems;
          listaCompras.forEach(item => {
            item.custo_total_compra = costPerItem.toFixed(2);
            item.preco_unitario = (costPerItem / parseFloat(item.quantidade_comprar)).toFixed(2);
          });
          custoTotal = budgetPredicted;
        }
      }
      
      const listaAgrupada = this.agruparPorCategoria(listaCompras);
      
      // PASSO 7: Salvar no banco
      let shoppingList;
      
      if (existingListId) {
        // Atualizar lista existente (incluindo budget_predicted recalculado)
        const { data, error: updateError } = await this.supabase
          .from('shopping_lists')
          .update({
            budget_predicted: computedBudget,
            cost_actual: custoTotal,
            status: 'generated'
          })
          .eq('id', existingListId)
          .select()
          .single();
          
        if (updateError || !data) {
          console.error('Erro ao atualizar lista:', updateError);
          throw new Error('Erro ao atualizar lista de compras');
        }
        
        shoppingList = data;
        
        // Apagar itens antigos
        await this.supabase
          .from('shopping_list_items')
          .delete()
          .eq('shopping_list_id', existingListId);
          
        console.log(`🔄 Lista atualizada: ${existingListId}`);
      } else {
        // Criar nova lista (com orçamento calculado corretamente)
        const { data, error: listError } = await this.supabase
          .from('shopping_lists')
          .insert({
            menu_id: menuId,
            client_name: clientName,
            budget_predicted: computedBudget,
            cost_actual: custoTotal,
            status: 'generated'
          })
          .select()
          .single();

        if (listError || !data) {
          console.error('Erro ao salvar lista:', listError);
          throw new Error('Erro ao salvar lista de compras');
        }
        
        shoppingList = data;
      }

      // Salvar itens (sempre inserir, mesmo placeholders)
      const itemsToInsert = listaCompras.map(item => {
        console.log('🔍 Mapeando item:', item);
        return {
          shopping_list_id: shoppingList.id,
          product_id_legado: item.produto_base_id?.toString() || 'unknown',
          product_name: item.nome_ingrediente || 'Produto sem nome',
          category: item.categoria_estimada || 'DIVERSOS',
          quantity: parseFloat(item.quantidade_comprar) || 0,
          unit: item.unidade || 'UN',
          unit_price: parseFloat(item.preco_unitario) || 0,
          total_price: parseFloat(item.custo_total_compra) || 0,
          promocao: Boolean(item.em_promocao),
          optimized: true,
          available: item.available !== undefined ? item.available : true
        };
      });

      if (itemsToInsert.length > 0) {
        console.log(`💾 Tentando salvar ${itemsToInsert.length} itens...`);
        console.log('🔍 Exemplo do primeiro item:', itemsToInsert[0]);
        
        try {
          const { data: insertedItems, error: itemsError } = await this.supabase
            .from('shopping_list_items')
            .insert(itemsToInsert)
            .select();

          if (itemsError) {
            console.error('❌ Erro ao salvar itens:', itemsError);
            throw new Error(`Erro ao salvar itens: ${itemsError.message}`);
          } else {
            console.log(`✅ ${insertedItems?.length || itemsToInsert.length} itens salvos com sucesso no banco`);
          }
        } catch (error) {
          console.error('❌ Exceção ao salvar itens:', error);
          throw error;
        }
      } else {
        console.log('⚠️ Nenhum item para salvar');
      }
      
      const resultado = {
        success: true,
        shopping_list_id: shoppingList.id,
        lista_compras: {
          total_itens: listaCompras.length,
          custo_total: custoTotal.toFixed(2),
          itens_promocao: itensPromocao,
          economia_promocoes: economiaPromocoes.toFixed(2),
          
          itens: listaCompras,
          itens_por_categoria: listaAgrupada,
          ingredientes_nao_encontrados: ingredientesNaoEncontrados,
          
          resumo_orcamento: {
            orcamento_previsto: computedBudget,
            custo_real: custoTotal,
            diferenca: computedBudget - custoTotal,
            status_orcamento: custoTotal <= computedBudget ? 'dentro_limite' : 'acima_limite'
          },
          
          observacoes: {
            menu_id: menuId,
            cliente: clientName,
            porcoes_por_dia: servingsPerDay,
            data_geracao: new Date().toISOString(),
            metodo: 'consolidacao_corrigida_v2'
          }
        }
      };
      
      console.log(`✅ Lista gerada: ${listaCompras.length} itens, R$ ${custoTotal.toFixed(2)}`);
      console.log(`⚠️ ${ingredientesNaoEncontrados.length} ingredientes não encontrados`);
      
      return resultado;
      
    } catch (error) {
      console.error('❌ Erro na geração da lista:', error);
      throw error;
    }
  }

  consolidarIngredientes(ingredientesReceitas: any[], servingsPerDay: number) {
    const consolidados = new Map();
    
    for (const ingrediente of ingredientesReceitas) {
      try {
        // Validar dados básicos (permitir itens sem produto_base_id para gerar placeholders)
        const qtdVal = typeof ingrediente.quantidade === 'number' ? ingrediente.quantidade : parseFloat(ingrediente.quantidade);
        const unidadeVal = ingrediente.unidade;
        if (!qtdVal || isNaN(qtdVal) || !unidadeVal || qtdVal <= 0) {
          console.warn(`⚠️ Ingrediente inválido ignorado:`, {
            nome: ingrediente.produto_base_descricao || ingrediente.nome,
            quantidade: ingrediente.quantidade,
            unidade: ingrediente.unidade,
            produto_id: ingrediente.produto_base_id
          });
          continue;
        }
        
        const produtoId: number | null = ingrediente.produto_base_id ?? null;
        const nomeDesc = (ingrediente.produto_base_descricao || ingrediente.nome || 'Ingrediente').toString().trim();
        const quantidadeBase = parseFloat(String(qtdVal));
        const porcoeBase = parseInt(ingrediente.quantidade_refeicoes) || 100;
        const unidadeOriginal = (unidadeVal || 'UN').toUpperCase();
        
        // CALCULAR QUANTIDADE NECESSÁRIA
        const fatorEscala = servingsPerDay / porcoeBase;
        const quantidadeNecessaria = quantidadeBase * fatorEscala;
        
        // NORMALIZAR UNIDADE
        const unidadePadrao = this.normalizarUnidade(unidadeOriginal, quantidadeNecessaria);
        
        console.log(`📦 ${nomeDesc}:`);
        console.log(`  - Qtd base: ${quantidadeBase} ${unidadeOriginal} para ${porcoeBase} porções`);
        console.log(`  - Fator escala: ${fatorEscala.toFixed(3)}`);
        console.log(`  - Qtd necessária: ${quantidadeNecessaria.toFixed(3)} ${unidadeOriginal}`);
        console.log(`  - Unidade normalizada: ${unidadePadrao.quantidade.toFixed(3)} ${unidadePadrao.unidade}`);
        
        // CONSOLIDAR (usar chave por ID ou por nome quando sem ID)
        const chave: any = (produtoId ?? `NM:${nomeDesc.toUpperCase()}`);
        if (consolidados.has(chave)) {
          const existing = consolidados.get(chave);
          existing.quantidade_total += unidadePadrao.quantidade;
          existing.receitas.add(ingrediente.nome || 'Receita');
        } else {
          consolidados.set(chave, {
            produto_base_id: produtoId,
            nome: nomeDesc,
            quantidade_total: unidadePadrao.quantidade,
            unidade_padrao: unidadePadrao.unidade,
            receitas: new Set([ingrediente.nome || 'Receita'])
          });
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar ingrediente:`, ingrediente.produto_base_descricao, error);
      }
    }
    
    return consolidados;
  }

  normalizarUnidade(unidade: string, quantidade: number) {
    const unidadeUpper = unidade.toUpperCase();
    const conversao = this.CONVERSOES_UNIDADES[unidadeUpper];
    
    if (!conversao) {
      console.warn(`⚠️ Unidade não reconhecida: ${unidade}, usando como está`);
      return { quantidade: quantidade, unidade: unidade };
    }
    
    // Converter para unidade padrão
    if (conversao.tipo === 'peso') {
      return { 
        quantidade: quantidade * conversao.para_kg, 
        unidade: 'KG' 
      };
    } else if (conversao.tipo === 'volume') {
      return { 
        quantidade: quantidade * conversao.para_litro, 
        unidade: 'L' 
      };
    } else {
      return { 
        quantidade: quantidade, 
        unidade: 'UN' 
      };
    }
  }

  /**
   * Calcula melhor combinação de embalagens com otimização inteligente
   */
  private calcularMelhorCombinacao(
    qtdNecessaria: number,
    opcoes: any[]
  ): { pacotes: any[], sobra: number, custoTotal: number } {
    
    // Configuração de otimização inteligente
    const config = {
      prioridade_promocao: 'alta' as const,
      tolerancia_sobra_percentual: 15, // Aceitar até 15% de sobra
      preferir_produtos_integrais: true,
      maximo_tipos_embalagem_por_produto: 3,
      considerar_custo_compra: false
    };

    // Transformar opções no formato esperado
    const opcoesFormatadas = opcoes.map(o => ({
      produto_id: o.solicitacao_produto_listagem_id || 0,
      produto_base_id: o.produto_base_id,
      descricao: o.descricao || 'Sem descrição',
      quantidade_embalagem: parseFloat(o.produto_base_quantidade_embalagem) || 1,
      unidade: o.unidade || 'UN',
      preco: parseFloat(o.preco) || 0,
      preco_compra: parseFloat(o.preco) || 0,
      promocao: o.em_promocao_sim_nao || false,
      em_promocao: o.em_promocao_sim_nao || false,
      apenas_valor_inteiro: o.apenas_valor_inteiro_sim_nao || false,
      disponivel: true
    }));

    // Filtrar opções disponíveis
    const opcoesDisponiveis = opcoesFormatadas.filter(o => o.disponivel && o.quantidade_embalagem > 0);
    
    if (opcoesDisponiveis.length === 0) {
      return { pacotes: [], sobra: qtdNecessaria, custoTotal: 0 };
    }

    // Ordenar por prioridade: promoção, custo por unidade, tamanho
    const opcoesOrdenadas = [...opcoesDisponiveis].sort((a, b) => {
      // 1. Priorizar promoções
      if (config.prioridade_promocao === 'alta') {
        if (a.promocao && !b.promocao) return -1;
        if (!a.promocao && b.promocao) return 1;
      }
      
      // 2. Comparar custo por unidade
      const custoUnitarioA = a.preco / a.quantidade_embalagem;
      const custoUnitarioB = b.preco / b.quantidade_embalagem;
      
      return custoUnitarioA - custoUnitarioB;
    });

    const pacotes: any[] = [];
    let quantidadeRestante = qtdNecessaria;

    // Algoritmo inteligente para seleção de embalagens
    for (const opcao of opcoesOrdenadas) {
      if (quantidadeRestante <= 0) break;
      if (pacotes.length >= config.maximo_tipos_embalagem_por_produto) break;

      const preco = opcao.preco;
      
      // Se o produto só aceita valores inteiros
      if (opcao.apenas_valor_inteiro) {
        const pacotesNecessarios = Math.ceil(quantidadeRestante / opcao.quantidade_embalagem);
        const quantidadeTotal = pacotesNecessarios * opcao.quantidade_embalagem;
        const sobra = quantidadeTotal - quantidadeRestante;
        const sobraPercentual = (sobra / qtdNecessaria) * 100;
        
        // Verificar se a sobra está dentro da tolerância
        if (sobraPercentual <= config.tolerancia_sobra_percentual) {
          pacotes.push({
            opcao: opcao,
            quantidade: pacotesNecessarios,
            motivo_selecao: this.getSelectionReason(opcao, config, sobraPercentual)
          });
          
          quantidadeRestante = 0;
          console.log(`   ✅ Selecionado (INTEGRAL): ${pacotesNecessarios}× ${opcao.quantidade_embalagem}${opcao.unidade} | Sobra: ${sobra.toFixed(2)} (${sobraPercentual.toFixed(1)}%)`);
        } else {
          console.log(`   ⚠️ Rejeitado (SOBRA ALTA): sobra de ${sobraPercentual.toFixed(1)}% excede tolerância`);
        }
      } else {
        // Produto pode ser fracionado
        const quantidadeDesejada = Math.min(quantidadeRestante, opcao.quantidade_embalagem * 10);
        const pacotesNecessarios = Math.ceil(quantidadeDesejada / opcao.quantidade_embalagem);
        
        pacotes.push({
          opcao: opcao,
          quantidade: pacotesNecessarios,
          motivo_selecao: this.getSelectionReason(opcao, config, 0)
        });
        
        quantidadeRestante -= pacotesNecessarios * opcao.quantidade_embalagem;
        console.log(`   ✅ Selecionado (FRACIONADO): ${pacotesNecessarios}× ${opcao.quantidade_embalagem}${opcao.unidade}`);
      }
    }

    const custoTotal = pacotes.reduce((sum, p) => 
      sum + (p.quantidade * p.opcao.preco), 0
    );
    
    const sobra = Math.max(0, -quantidadeRestante);
    
    return { pacotes, sobra, custoTotal };
  }

  private getSelectionReason(opcao: any, config: any, sobraPercentual: number): string {
    const reasons: string[] = [];
    
    if (opcao.promocao || opcao.em_promocao) {
      reasons.push("em promoção");
    }
    
    if (opcao.apenas_valor_inteiro) {
      reasons.push("produto integral");
      if (sobraPercentual > 0) {
        reasons.push(`sobra de ${sobraPercentual.toFixed(1)}%`);
      }
    }
    
    const custoUnitario = opcao.preco / opcao.quantidade_embalagem;
    reasons.push(`R$ ${custoUnitario.toFixed(2)}/unidade`);
    
    return reasons.join(", ");
  }

  processarIngredienteParaCompra(ingrediente: any, produtosMercado: any[]) {
    // 🔍 CORREÇÃO 3: Buscar opções no mercado com comparação Type-Safe
    const opcoes = produtosMercado.filter(p => {
      const idMercado = Number(p.produto_base_id);
      const idIngrediente = Number(ingrediente.produto_base_id);
      
      return !isNaN(idMercado) && 
             !isNaN(idIngrediente) && 
             idMercado === idIngrediente;
    });
    
    console.log(`   - Opções encontradas no mercado: ${opcoes.length}`);
    if (opcoes.length > 0) {
      console.log(`   - Primeiro match: ${opcoes[0].descricao} | R$ ${opcoes[0].preco}`);
    }
    
    // 🔍 CORREÇÃO 4: Diagnóstico para IDs Não Encontrados
    if (opcoes.length === 0) {
      console.warn(`⚠️ ${ingrediente.nome}: Nenhuma opção encontrada no mercado`);
      console.warn(`   produto_base_id procurado: ${ingrediente.produto_base_id} (tipo: ${typeof ingrediente.produto_base_id})`);
      console.warn(`   Total produtos no mercado: ${produtosMercado.length}`);
      
      // Verificar se existe produto com ID similar (manual fallback check)
      const matchManual = produtosMercado.find(p => 
        Number(p.produto_base_id) === Number(ingrediente.produto_base_id)
      );
      
      if (matchManual) {
        console.error(`   ❌ BUG DETECTADO: Produto existe mas filtro falhou!`);
        console.error(`   Match manual encontrou: ${matchManual.descricao} (ID: ${matchManual.produto_base_id})`);
        console.error(`   Comparação: ${matchManual.produto_base_id} (${typeof matchManual.produto_base_id}) vs ${ingrediente.produto_base_id} (${typeof ingrediente.produto_base_id})`);
      }
      
      return { encontrado: false };
    }
    
    // Selecionar melhor opção (promoção ou mais barato)
    const melhorOpcao = opcoes.find(o => o.em_promocao_sim_nao) || opcoes[0];
    
    // 🎯 Otimização de embalagens
    const { pacotes, sobra, custoTotal } = this.calcularMelhorCombinacao(
      ingrediente.quantidade_total,
      opcoes
    );

    // Calcular quantidade total comprada
    const qtdComprar = pacotes.reduce((sum, p) => 
      sum + (p.quantidade * parseFloat(p.opcao.produto_base_quantidade_embalagem)), 0
    );

    // Log de otimização
    console.log(`📦 ${ingrediente.nome}: ${ingrediente.quantidade_total.toFixed(2)} ${ingrediente.unidade_padrao}`);
    pacotes.forEach(p => {
      console.log(`   ${p.quantidade}× ${p.opcao.produto_base_quantidade_embalagem}${p.opcao.produto_base_unidade_medida || ingrediente.unidade_padrao} (R$ ${parseFloat(p.opcao.preco).toFixed(2)})`);
    });
    if (sobra > 0) {
      console.log(`   Sobra: ${sobra.toFixed(2)} ${ingrediente.unidade_padrao}`);
    }

    const embalagem = parseFloat(melhorOpcao.produto_base_quantidade_embalagem) || 1;
    const precoUnitario = parseFloat(melhorOpcao.preco);
    
    // Economia em promoção (estimar 10%)
    const economiaPromocao = melhorOpcao.em_promocao_sim_nao ? custoTotal * 0.1 : 0;
    
    return {
      encontrado: true,
      item: {
        produto_base_id: ingrediente.produto_base_id,
        nome_ingrediente: ingrediente.nome,
        produto_mercado: melhorOpcao.descricao,
        quantidade_necessaria: ingrediente.quantidade_total.toFixed(3),
        quantidade_comprar: qtdComprar.toFixed(3),
        unidade: ingrediente.unidade_padrao,
        preco_unitario: (custoTotal / qtdComprar).toFixed(2), // Preço médio por unidade
        custo_total_compra: custoTotal.toFixed(2),
        sobra: sobra.toFixed(3),
        percentual_sobra: qtdComprar > 0 ? ((sobra / qtdComprar) * 100).toFixed(1) : '0.0',
        em_promocao: melhorOpcao.em_promocao_sim_nao || false,
        economia_promocao: economiaPromocao.toFixed(2),
        receitas_usando: Array.from(ingrediente.receitas),
        categoria_estimada: this.estimarCategoria(ingrediente.nome)
      }
    };
  }

  agruparPorCategoria(itens: any[]) {
    const grupos = {};
    for (const item of itens) {
      const categoria = item.categoria_estimada;
      if (!grupos[categoria]) grupos[categoria] = [];
      grupos[categoria].push(item);
    }
    return grupos;
  }

  estimarCategoria(nome: string) {
    const nomeUpper = nome.toUpperCase();
    
    if (nomeUpper.includes('ARROZ') || nomeUpper.includes('FEIJAO')) return 'GRÃOS E CEREAIS';
    if (nomeUpper.includes('CARNE') || nomeUpper.includes('FRANGO')) return 'PROTEÍNAS';
    if (nomeUpper.includes('OLEO') || nomeUpper.includes('MARGARINA')) return 'ÓLEOS E GORDURAS';
    if (nomeUpper.includes('TOMATE') || nomeUpper.includes('CEBOLA') || nomeUpper.includes('PEPINO')) return 'VEGETAIS';
    if (nomeUpper.includes('SAL') || nomeUpper.includes('TEMPERO')) return 'TEMPEROS E CONDIMENTOS';
    if (nomeUpper.includes('LEITE') || nomeUpper.includes('QUEIJO')) return 'LATICÍNIOS';
    if (nomeUpper.includes('AGUA') || nomeUpper.includes('SUCO')) return 'BEBIDAS';
    
    return 'DIVERSOS';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== INICIANDO GERAÇÃO DE LISTA CORRIGIDA ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // PARSE DA REQUISIÇÃO
    const { menuId, clientName, budgetPredicted = 0, servingsPerDay = 50, existingListId } = await req.json();

    // Validação de entrada
    if (!menuId || !clientName) {
      throw new Error('menuId e clientName são obrigatórios');
    }

    console.log('🛒 Gerando lista corrigida para cardápio:', menuId);
    console.log('👤 Cliente:', clientName, '💰 Orçamento:', budgetPredicted, '🍽️ Porções/dia:', servingsPerDay);
    console.log('✅ Parâmetro servingsPerDay recebido corretamente:', typeof servingsPerDay, 'valor:', servingsPerDay);

    // USAR A NOVA CLASSE CORRIGIDA
    const generator = new ShoppingListGeneratorFixed(supabase);
    const resultado = await generator.gerarListaComprasCorrigida(menuId, clientName, budgetPredicted, servingsPerDay, existingListId);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na geração da lista:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});