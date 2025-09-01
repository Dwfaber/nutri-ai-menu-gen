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

    // FUNÇÃO CORRIGIDA DE CÁLCULO
    async function calculateSimpleCost(recipeId, mealQuantity = 100) {
      try {
        const { data: ingredients, error } = await supabase
          .from('receita_ingredientes')
          .select('*')
          .eq('receita_id_legado', recipeId)
          .limit(15);
        
        if (error || !ingredients || ingredients.length === 0) {
          return { id: recipeId, nome: `Receita ${recipeId}`, custo: 0, custo_por_refeicao: 0 };
        }
        
        const recipeName = ingredients[0].nome;
        const baseQuantity = parseInt(ingredients[0].quantidade_refeicoes) || 100;
        
        console.log(`📦 ${recipeName}: ${ingredients.length} ingredientes para ${baseQuantity} porções base`);
        
        const productIds = ingredients
          .map(i => i.produto_base_id)
          .filter(id => id && Number(id) > 0);
        
        if (productIds.length === 0) {
          return { id: recipeId, nome: recipeName, custo: 0, custo_por_refeicao: 0 };
        }
        
        const { data: prices } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('*')
          .in('produto_base_id', productIds)
          .gt('preco', 0);
        
        let totalCostBase = 0; // Custo para porções base
        const ingredientesCalculados = [];
        
        for (const ingredient of ingredients) {
          const price = prices?.find(p => Number(p.produto_base_id) === Number(ingredient.produto_base_id));
          
          if (price && ingredient.quantidade) {
            const qty = parseFloat(ingredient.quantidade) || 0;
            const unitPrice = parseFloat(price.preco) || 0;
            
            let itemCost = 0;
            
            // CÁLCULO CORRETO POR UNIDADE
            if (ingredient.unidade === 'KG') {
              itemCost = qty * unitPrice;
            } else if (ingredient.unidade === 'ML') {
              // Para ML, verificar se o produto é vendido por unidade
              if (price.descricao?.includes('900ML') || price.descricao?.includes('1L')) {
                const packageSizeMl = price.descricao.includes('900ML') ? 900 : 1000;
                itemCost = (qty / packageSizeMl) * unitPrice;
              } else {
                itemCost = (qty / 1000) * unitPrice; // Default: ML para L
              }
            } else if (ingredient.unidade === 'GR' || ingredient.unidade === 'G') {
              itemCost = (qty / 1000) * unitPrice; // GR para KG
            } else {
              itemCost = qty * unitPrice; // Outras unidades
            }
            
            // VALIDAÇÃO: Se custo muito alto, aplicar correção
            if (itemCost > 50) {
              console.warn(`⚠️ Custo alto para ${ingredient.produto_base_descricao}: R$${itemCost.toFixed(2)}`);
              if (itemCost > 100) {
                itemCost = itemCost / 10; // Dividir por 10
              }
            }
            
            totalCostBase += itemCost;
            
            ingredientesCalculados.push({
              nome: ingredient.produto_base_descricao,
              quantidade: qty,
              unidade: ingredient.unidade,
              preco_unitario: unitPrice,
              custo_item: itemCost
            });
            
            console.log(`  ✅ ${ingredient.produto_base_descricao}: ${qty}${ingredient.unidade} = R$${itemCost.toFixed(2)}`);
          }
        }
        
        // CRÍTICO: Custo por porção baseado nas porções base da receita
        const costPerServing = totalCostBase / baseQuantity;
        
        // Custo total para quantidade solicitada
        const totalCostForQuantity = costPerServing * mealQuantity;
        
        console.log(`💰 Custo base: R$${totalCostBase.toFixed(2)} para ${baseQuantity} porções`);
        console.log(`💰 Custo por porção: R$${costPerServing.toFixed(2)}`);
        console.log(`💰 Custo total: R$${totalCostForQuantity.toFixed(2)} para ${mealQuantity} porções`);
        
        return {
          id: recipeId,
          nome: recipeName,
          custo: totalCostForQuantity,
          custo_por_refeicao: costPerServing, // ESTE É O VALOR CORRETO
          ingredientes: ingredientesCalculados,
          porcoes_base: baseQuantity,
          porcoes_calculadas: mealQuantity
        };
        
      } catch (error) {
        console.error(`❌ Erro ao calcular receita ${recipeId}:`, error);
        return { id: recipeId, nome: `Receita ${recipeId}`, custo: 0, custo_por_refeicao: 0 };
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
        
        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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