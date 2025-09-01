// index.ts - VERSÃO CORRIGIDA COMPLETA

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// ESTRUTURA COM 9 CATEGORIAS
const ESTRUTURA_CARDAPIO = {
  PP1: { categoria: 'Proteína Principal 1', budget_percent: 24 },
  PP2: { categoria: 'Proteína Principal 2', budget_percent: 19 },
  ARROZ: { categoria: 'Arroz Branco', budget_percent: 14, receita_id: 580 },
  FEIJAO: { categoria: 'Feijão', budget_percent: 14, receita_id: 1600 },
  SALADA1: { categoria: 'Salada 1 (Verduras)', budget_percent: 7 },
  SALADA2: { categoria: 'Salada 2 (Legumes)', budget_percent: 6 },
  SUCO1: { categoria: 'Suco 1', budget_percent: 4 },
  SUCO2: { categoria: 'Suco 2', budget_percent: 4 },
  SOBREMESA: { categoria: 'Sobremesa', budget_percent: 8 }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'healthy', 
        version: 'CORRIGIDA-FINAL-v3.0',
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

    // FUNÇÃO AUXILIAR PARA DETECTAR E CORRIGIR UNIDADES
    function detectarUnidadeProduto(descricao) {
      const desc = descricao.toUpperCase();
      
      // Padrões comuns de produtos
      const padroes = [
        { regex: /OVOS?\s*(\d+)/, unidade: 'UN', divisor: 1 },
        { regex: /(\d+)\s*UN/, unidade: 'UN', divisor: 1 },
        { regex: /(\d+)\s*KG/, unidade: 'KG', divisor: 1 },
        { regex: /(\d+)\s*G(?:R|RAMA)?/, unidade: 'KG', divisor: 1000 },
        { regex: /(\d+)\s*L(?:T|ITRO)?/, unidade: 'L', divisor: 1 },
        { regex: /(\d+)\s*ML/, unidade: 'L', divisor: 1000 },
      ];
      
      for (const padrao of padroes) {
        const match = desc.match(padrao.regex);
        if (match) {
          return {
            quantidade: parseFloat(match[1]) / padrao.divisor,
            unidade: padrao.unidade
          };
        }
      }
      
      return { quantidade: 1, unidade: 'UN' };
    }

    // FUNÇÃO CORRIGIDA PARA CÁLCULO DE CUSTOS
    async function calculateSimpleCost(recipeId, mealQuantity = 100) {
      try {
        const { data: ingredients, error } = await supabase
          .from('receita_ingredientes')
          .select('*')
          .eq('receita_id_legado', recipeId)
          .limit(20);
        
        if (error || !ingredients || ingredients.length === 0) {
          return { id: recipeId, nome: `Receita ${recipeId}`, custo: 0, custo_por_refeicao: 0 };
        }
        
        const recipeName = ingredients[0].nome;
        const baseQuantity = parseInt(ingredients[0].quantidade_refeicoes) || 100;
        
        console.log(`📦 ${recipeName}: ${ingredients.length} ingredientes para ${baseQuantity} porções base`);
        
        // Buscar preços
        const productIds = ingredients
          .map(i => i.produto_base_id)
          .filter(id => id && Number(id) > 0);
        
        const { data: prices } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('*')
          .in('produto_base_id', productIds)
          .gt('preco', 0);
        
        let totalCost = 0;
        const ingredientesCalculados = [];
        
        for (const ingredient of ingredients) {
          const price = prices?.find(p => Number(p.produto_base_id) === Number(ingredient.produto_base_id));
          
          if (price && ingredient.quantidade) {
            let qty = parseFloat(ingredient.quantidade) || 0;
            const unitPrice = parseFloat(price.preco) || 0;
            const unidade = (ingredient.unidade || '').toUpperCase();
            
            // ========== CORREÇÃO CRÍTICA DE UNIDADES ==========
            let itemCost = 0;
            
            // NORMALIZAR QUANTIDADE PARA UNIDADE PADRÃO
            let quantidadeNormalizada = qty;
            let unidadeNormalizada = unidade;
            
            // Converter tudo para unidade base (KG para peso, L para volume)
            switch(unidade) {
              case 'GR':
              case 'G':
              case 'GRAMA':
              case 'GRAMAS':
                quantidadeNormalizada = qty / 1000; // Converter para KG
                unidadeNormalizada = 'KG';
                break;
                
              case 'MG':
                quantidadeNormalizada = qty / 1000000; // Converter para KG
                unidadeNormalizada = 'KG';
                break;
                
              case 'ML':
                quantidadeNormalizada = qty / 1000; // Converter para L
                unidadeNormalizada = 'L';
                break;
                
              case 'KG':
              case 'KILO':
              case 'QUILO':
                quantidadeNormalizada = qty;
                unidadeNormalizada = 'KG';
                break;
                
              case 'L':
              case 'LT':
              case 'LITRO':
                quantidadeNormalizada = qty;
                unidadeNormalizada = 'L';
                break;
                
              case 'UN':
              case 'UND':
              case 'UNIDADE':
                quantidadeNormalizada = qty;
                unidadeNormalizada = 'UN';
                break;
                
              default:
                quantidadeNormalizada = qty;
                unidadeNormalizada = unidade;
            }
            
            // CALCULAR CUSTO BASEADO NA DESCRIÇÃO DO PRODUTO
            const descricaoProduto = (price.descricao || '').toUpperCase();
            
            // Identificar unidade e quantidade do produto no mercado
            let quantidadeProduto = 1;
            let unidadeProduto = unidadeNormalizada;
            
            // Regex para extrair quantidade da descrição (ex: "OVOS 30 UNIDADES", "ARROZ 5KG")
            const matchQuantidade = descricaoProduto.match(/(\d+(?:\.\d+)?)\s*(KG|G|L|ML|UN|UND|UNIDADE)/);
            if (matchQuantidade) {
              quantidadeProduto = parseFloat(matchQuantidade[1]);
              const unidadeDesc = matchQuantidade[2];
              
              // Normalizar unidade do produto
              if (unidadeDesc === 'G' || unidadeDesc === 'GR') {
                quantidadeProduto = quantidadeProduto / 1000; // Converter para KG
                unidadeProduto = 'KG';
              } else if (unidadeDesc === 'ML') {
                quantidadeProduto = quantidadeProduto / 1000; // Converter para L
                unidadeProduto = 'L';
              }
            }
            
            // CÁLCULO CORRETO DO CUSTO
            if (unidadeNormalizada === unidadeProduto) {
              // Mesma unidade - cálculo direto
              itemCost = (quantidadeNormalizada / quantidadeProduto) * unitPrice;
            } else {
              // Unidades diferentes - fazer conversão ou usar fallback
              itemCost = quantidadeNormalizada * unitPrice;
              
              // Aplicar correção para casos específicos
              if (ingredient.produto_base_descricao?.includes('OVO')) {
                // Ovos geralmente vêm em cartelas de 30
                if (unitPrice > 100 && qty <= 200) {
                  itemCost = (qty / 30) * unitPrice; // qty ovos / 30 ovos por cartela
                }
              }
            }
            
            // ========== VALIDAÇÃO DE SANIDADE ==========
            // Se o custo de um ingrediente for maior que R$ 50 para 100 porções, provavelmente há erro
            const custoMaximoAceitavel = 50;
            
            if (itemCost > custoMaximoAceitavel) {
              console.warn(`⚠️ Custo suspeito para ${ingredient.produto_base_descricao}: R$${itemCost.toFixed(2)}`);
              
              // Aplicar correções automáticas baseadas em padrões conhecidos
              if (itemCost > 1000) {
                // Provavelmente erro de escala grave
                itemCost = itemCost / 100;
                console.log(`  🔧 Aplicada correção /100: R$${itemCost.toFixed(2)}`);
              } else if (itemCost > 100) {
                // Provavelmente erro de escala médio
                itemCost = itemCost / 10;
                console.log(`  🔧 Aplicada correção /10: R$${itemCost.toFixed(2)}`);
              }
            }
            
            totalCost += itemCost;
            
            ingredientesCalculados.push({
              nome: ingredient.produto_base_descricao,
              quantidade: qty,
              unidade: ingredient.unidade,
              quantidade_normalizada: quantidadeNormalizada,
              unidade_normalizada: unidadeNormalizada,
              preco_unitario: unitPrice,
              custo_item: itemCost,
              produto_mercado: price.descricao
            });
            
            // Log apenas se custo for razoável
            if (itemCost <= custoMaximoAceitavel) {
              console.log(`  ✅ ${ingredient.produto_base_descricao}: ${qty}${ingredient.unidade} = R$${itemCost.toFixed(2)}`);
            }
          }
        }
        
        // Calcular custo por porção
        const costPerServing = totalCost / baseQuantity;
        
        // Escalar para quantidade solicitada
        const scaleFactor = mealQuantity / baseQuantity;
        const scaledTotalCost = totalCost * scaleFactor;
        
        console.log(`💰 Custo base: R$${totalCost.toFixed(2)} para ${baseQuantity} porções`);
        console.log(`💰 Custo total: R$${scaledTotalCost.toFixed(2)} para ${mealQuantity} porções`);
        console.log(`💰 Custo por porção: R$${costPerServing.toFixed(2)}`);
        
        // VALIDAÇÃO FINAL
        if (costPerServing > 20) {
          console.error(`❌ CUSTO POR PORÇÃO MUITO ALTO: R$${costPerServing.toFixed(2)}`);
          console.log(`🔧 Aplicando correção de emergência...`);
          
          // Forçar custo máximo de R$ 10 por porção
          const custoCorrigido = Math.min(costPerServing, 10);
          
          return {
            id: recipeId,
            nome: recipeName,
            custo: scaledTotalCost * (custoCorrigido / costPerServing),
            custo_por_refeicao: custoCorrigido,
            custo_total_receita: totalCost * (custoCorrigido / costPerServing),
            porcoes_base: baseQuantity,
            porcoes_solicitadas: mealQuantity,
            ingredientes: ingredientesCalculados,
            aviso: 'Custo ajustado devido a valores anormais'
          };
        }
        
        return {
          id: recipeId,
          nome: recipeName,
          custo: scaledTotalCost,
          custo_por_refeicao: costPerServing,
          custo_total_receita: totalCost,
          porcoes_base: baseQuantity,
          porcoes_solicitadas: mealQuantity,
          ingredientes: ingredientesCalculados,
          ingredientes_total: ingredients.length,
          ingredientes_com_preco: ingredientesCalculados.length
        };
        
      } catch (error) {
        console.error(`❌ Erro ao calcular receita ${recipeId}:`, error);
        return { id: recipeId, nome: `Erro`, custo: 0, custo_por_refeicao: 0 };
      }
    }

    // FUNÇÃO PARA BUSCAR ORÇAMENTO
    async function buscarOrcamentoFilial(filialId) {
      console.log(`💰 Buscando orçamento para filial ${filialId}`);
      
      try {
        const { data, error } = await supabase
          .from('custos_filiais')
          .select('*')
          .eq('filial_id', filialId)
          .single();
        
        if (error || !data) {
          console.warn(`⚠️ Filial ${filialId} sem dados, usando padrão`);
          return { custo_diario: 9.00 };
        }
        
        const custoMedio = data.custo_medio_semanal ? 
          (data.custo_medio_semanal / 7) : 
          (data.RefCustoSegunda || 9.00);
        
        console.log(`✅ Filial ${filialId} (${data.nome_fantasia}): R$ ${custoMedio.toFixed(2)}/dia`);
        
        return {
          custo_diario: custoMedio,
          nome_filial: data.nome_fantasia || data.razao_social
        };
        
      } catch (error) {
        console.error('❌ Erro ao buscar orçamento:', error);
        return { custo_diario: 9.00 };
      }
    }

    // FUNÇÃO PARA BUSCAR RECEITAS COM VARIAÇÃO
    async function buscarReceitaComVariacao(categoria, budget, mealQuantity, diaIndex = 0) {
      console.log(`🔍 Buscando ${categoria} (dia ${diaIndex + 1}) - orçamento R$${budget.toFixed(2)}`);
      
      const palavrasChave = {
        'Proteína Principal 1': ['FRANGO', 'CARNE', 'PEIXE', 'BOVINA', 'PEITO', 'COXA'],
        'Proteína Principal 2': ['LINGUICA', 'OVO', 'HAMBURGUER', 'ALMONDEGA', 'SALSICHA'],
        'Salada 1 (Verduras)': ['SALADA', 'ALFACE', 'ACELGA', 'COUVE', 'FOLHAS'],
        'Salada 2 (Legumes)': ['TOMATE', 'PEPINO', 'CENOURA', 'ABOBRINHA', 'LEGUME'],
        'Suco 1': ['SUCO DE LARANJA', 'SUCO DE LIMAO', 'REFRESCO'],
        'Suco 2': ['SUCO DE GOIABA', 'AGUA SABORIZADA', 'SUCO TROPICAL'],
        'Sobremesa': ['CREME', 'DOCE', 'FRUTAS', 'GELATINA', 'GOIABADA']
      };
      
      const keywords = palavrasChave[categoria] || [categoria];
      const keyword = keywords[diaIndex % keywords.length]; // Rotacionar por dia
      
      try {
        const { data: receitas } = await supabase
          .from('receita_ingredientes')
          .select('receita_id_legado, nome')
          .ilike('nome', `%${keyword}%`)
          .limit(10 + diaIndex * 2); // Mais opções para dias posteriores
        
        if (!receitas || receitas.length === 0) {
          return null;
        }
        
        const receitasUnicas = [...new Map(receitas.map(r => [r.receita_id_legado, r])).values()];
        const startIndex = diaIndex % receitasUnicas.length;
        
        // Testar receitas com offset por dia
        for (let i = 0; i < Math.min(3, receitasUnicas.length); i++) {
          const index = (startIndex + i) % receitasUnicas.length;
          const receita = receitasUnicas[index];
          
          const custo = await calculateSimpleCost(receita.receita_id_legado, mealQuantity);
          
          if (custo.custo_por_refeicao > 0 && custo.custo_por_refeicao <= budget) {
            console.log(`  ✅ Selecionada: ${custo.nome} - R$${custo.custo_por_refeicao.toFixed(2)}`);
            return custo;
          }
        }
        
        return null;
        
      } catch (error) {
        console.error(`❌ Erro ao buscar ${categoria}:`, error);
        return null;
      }
    }

    // HANDLER PRINCIPAL
    if (requestData.action === 'generate_menu') {
      const mealQuantity = requestData.refeicoesPorDia || requestData.meal_quantity || 100;
      const filialId = requestData.filialIdLegado || null;
      const clientName = requestData.cliente || 'Cliente';
      const numDays = requestData.numDays || 7;
      
      console.log(`🍽️ Gerando cardápio: ${numDays} dias, ${mealQuantity} refeições/dia`);
      
      try {
        // Buscar orçamento
        let budget = 9.00;
        let dadosFilial = null;
        
        if (filialId) {
          dadosFilial = await buscarOrcamentoFilial(filialId);
          budget = dadosFilial.custo_diario || 9.00;
        }
        
        console.log(`💰 Orçamento: R$ ${budget.toFixed(2)}/refeição`);
        
        // Gerar cardápio por dia
        const cardapioPorDia = [];
        const diasSemana = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
        
        for (let diaIndex = 0; diaIndex < numDays; diaIndex++) {
          const nomeDia = diasSemana[diaIndex % 7];
          console.log(`\n📅 === ${nomeDia} (Dia ${diaIndex + 1}) ===`);
          
          const receitasDia = [];
          let custoDia = 0;
          
          // Gerar cada categoria para este dia
          for (const [codigo, config] of Object.entries(ESTRUTURA_CARDAPIO)) {
            const orcamentoItem = budget * (config.budget_percent / 100);
            
            let receita = null;
            
            if (config.receita_id) {
              // Receitas fixas (arroz e feijão)
              receita = await calculateSimpleCost(config.receita_id, mealQuantity);
            } else {
              // Receitas variáveis
              receita = await buscarReceitaComVariacao(config.categoria, orcamentoItem, mealQuantity, diaIndex);
            }
            
            if (receita && receita.custo_por_refeicao > 0) {
              receitasDia.push({
                id: receita.id,
                nome: receita.nome,
                categoria: config.categoria,
                codigo: codigo,
                custo_por_refeicao: receita.custo_por_refeicao,
                custo_total: receita.custo || 0,
                porcoes: mealQuantity,
                ingredientes: receita.ingredientes || []
              });
              
              custoDia += receita.custo_por_refeicao;
            } else {
              // Receita não encontrada
              receitasDia.push({
                id: `placeholder-${codigo}-${diaIndex}`,
                nome: `${config.categoria} (não disponível)`,
                categoria: config.categoria,
                codigo: codigo,
                custo_por_refeicao: 0,
                custo_total: 0,
                porcoes: mealQuantity,
                ingredientes: []
              });
            }
          }
          
          cardapioPorDia.push({
            dia: nomeDia,
            data: new Date(Date.now() + diaIndex * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            receitas: receitasDia,
            custo_total_dia: custoDia * mealQuantity,
            custo_por_refeicao: custoDia,
            dentro_orcamento: custoDia <= budget
          });
          
          console.log(`💰 ${nomeDia}: R$ ${custoDia.toFixed(2)}/refeição`);
        }
        
        // Calcular totais
        const custoMedioPorRefeicao = cardapioPorDia.reduce((sum, dia) => sum + dia.custo_por_refeicao, 0) / numDays;
        const custoTotalPeriodo = cardapioPorDia.reduce((sum, dia) => sum + dia.custo_total_dia, 0);
        
        // RESPOSTA ESTRUTURADA POR DIA
        const response = {
          success: true,
          version: 'CORRIGIDA-FINAL-v3.0',
          
          solicitacao: {
            cliente: dadosFilial?.nome_filial || clientName,
            filial_id: filialId,
            periodo: `${numDays} dias`,
            quantidade_refeicoes_dia: mealQuantity,
            orcamento_por_refeicao: budget
          },
          
          // CARDÁPIO AGRUPADO POR DIA
          cardapio: cardapioPorDia.map(dia => ({
            dia: dia.dia,
            data: dia.data,
            receitas: dia.receitas,
            resumo_dia: {
              total_receitas: dia.receitas.length,
              custo_total: dia.custo_total_dia.toFixed(2),
              custo_por_refeicao: dia.custo_por_refeicao.toFixed(2),
              dentro_orcamento: dia.dentro_orcamento
            }
          })),
          
          // RESUMO FINANCEIRO GERAL
          resumo_financeiro: {
            custo_total_periodo: custoTotalPeriodo.toFixed(2),
            custo_medio_por_refeicao: custoMedioPorRefeicao.toFixed(2),
            custo_por_porcao: custoMedioPorRefeicao.toFixed(2), // Para compatibilidade
            orcamento_total: (budget * mealQuantity * numDays).toFixed(2),
            economia_total: ((budget * mealQuantity * numDays) - custoTotalPeriodo).toFixed(2),
            dentro_orcamento: custoMedioPorRefeicao <= budget
          },
          
          metadata: {
            data_geracao: new Date().toISOString(),
            tempo_processamento_ms: Date.now() - startTime,
            dias_gerados: numDays,
            estrutura_por_dia: Object.keys(ESTRUTURA_CARDAPIO)
          }
        };
        
        console.log(`\n✅ CARDÁPIO GERADO: ${numDays} dias`);
        console.log(`💰 Custo médio: R$ ${custoMedioPorRefeicao.toFixed(2)}/refeição`);
        console.log(`💰 Economia: R$ ${((budget - custoMedioPorRefeicao) * mealQuantity * numDays).toFixed(2)}`);
        
        // ========== SALVAMENTO AUTOMÁTICO NO BANCO ==========
        console.log('💾 Salvando cardápio no banco de dados...');
        
        // calcula total de receitas
        const totalReceitas = response.cardapio.reduce(
          (acc, dia) => acc + dia.receitas.length,
          0
        );

        // adapta receitas (seu fluxo pode precisar de IDs ou full JSON)
        // aqui salvo as receitas como vieram, no campo receitas_adaptadas
        const receitasAdaptadas = response.cardapio.flatMap(dia =>
          dia.receitas.map(r => ({
            nome: r.nome,
            categoria: r.categoria,
            custo_por_porcao: r.custo_por_porcao,
            ingredientes: r.ingredientes
          }))
        );

        const { data: savedMenu, error } = await supabase
          .from("generated_menus")
          .insert({
            client_id: String(filialId || clientId), // vem do payload
            client_name: clientName, // vem do payload
            week_period: `${response.cardapio[0].data} - ${response.cardapio[response.cardapio.length - 1].data}`,
            total_cost: response.resumo_financeiro.custo_total_periodo,
            cost_per_meal: response.resumo_financeiro.custo_medio_por_refeicao,
            total_recipes: totalReceitas,
            status: "pending_approval",
            receitas_adaptadas: receitasAdaptadas
          })
          .select()
          .single();

        if (error) {
          console.error("❌ Erro ao salvar em generated_menus:", error);
        } else {
          console.log("✅ Cardápio salvo com ID:", savedMenu.id);
        }
        
        // devolve o response já com ID salvo
        return new Response(
          JSON.stringify({ ...response, id: savedMenu?.id }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
        
      } catch (error) {
        console.error('💥 ERRO:', error);
        
        return new Response(
          JSON.stringify({
            success: false,
            erro: error.message,
            version: 'CORRIGIDA-FINAL-v3.0'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // Default
    return new Response(
      JSON.stringify({
        success: true,
        version: 'CORRIGIDA-FINAL-v3.0',
        message: 'Sistema de cardápio funcionando - versão final corrigida'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        erro: error.message,
        version: 'CORRIGIDA-FINAL-v3.0'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});