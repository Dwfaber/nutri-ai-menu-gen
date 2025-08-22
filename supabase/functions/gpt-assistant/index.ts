// index.ts - NOVA VERSÃO com estrutura fixa de cardápio

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ ESTRUTURA FIXA DO CARDÁPIO ============
const ESTRUTURA_CARDAPIO = {
  PP1: { categoria: 'Proteína Principal 1', obrigatorio: true, budget_percent: 25 },
  PP2: { categoria: 'Proteína Principal 2', obrigatorio: true, budget_percent: 20 },
  ARROZ: { categoria: 'Arroz Branco', obrigatorio: true, budget_percent: 15, receita_id: 580 },
  FEIJAO: { categoria: 'Feijão', obrigatorio: true, budget_percent: 15, receita_id: 1600 },
  SALADA1: { categoria: 'Salada 1 (Verduras)', obrigatorio: true, budget_percent: 8 },
  SALADA2: { categoria: 'Salada 2 (Legumes)', obrigatorio: true, budget_percent: 7 },
  SUCO1: { categoria: 'Suco 1', obrigatorio: true, budget_percent: 5 },
  SUCO2: { categoria: 'Suco 2', obrigatorio: true, budget_percent: 5 }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'healthy', 
        version: 'ESTRUTURA-FIXA-v1.0',
        cardapio_estrutura: Object.keys(ESTRUTURA_CARDAPIO),
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const startTime = Date.now();
    const requestData = await req.json();
    
    console.log('📥 REQUEST:', requestData.action);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ============ FUNÇÃO DE BUSCA DE RECEITAS POR CATEGORIA ============
    async function buscarReceitasPorCategoria(categoria: string, budget: number, mealQuantity: number) {
      console.log(`🔍 Buscando receitas para ${categoria} com orçamento R$${budget.toFixed(2)}`);
      
      try {
        // Palavras-chave para cada categoria
        const palavrasChave = {
          'Proteína Principal 1': ['FRANGO', 'CARNE', 'PEIXE', 'PORCO', 'ALCATRA', 'PEITO', 'COXA'],
          'Proteína Principal 2': ['LINGUIÇA', 'SALSICHA', 'OVO', 'HAMBURGUER', 'ALMONDEGA', 'FILÉ'],
          'Salada 1 (Verduras)': ['ALFACE', 'ACELGA', 'COUVE', 'ESPINAFRE', 'RUCULA', 'AGRIÃO'],
          'Salada 2 (Legumes)': ['ABOBRINHA', 'CENOURA', 'BETERRABA', 'PEPINO', 'TOMATE', 'ABOBORA'],
          'Suco 1': ['LARANJA', 'LIMÃO', 'MARACUJA', 'UVA', 'ABACAXI'],
          'Suco 2': ['GOIABA', 'MANGA', 'CAJU', 'ACEROLA', 'AGUA SABORIZADA']
        };
        
        const keywords = palavrasChave[categoria] || [categoria.toUpperCase()];
        
        // Buscar receitas que contenham as palavras-chave
        let receitasEncontradas = [];
        
        for (const keyword of keywords) {
          const { data: receitas, error } = await supabase
            .from('receita_ingredientes')
            .select('receita_id_legado, nome, produto_base_descricao')
            .or(`nome.ilike.%${keyword}%,produto_base_descricao.ilike.%${keyword}%`)
            .limit(5);
          
          if (!error && receitas) {
            // Pegar IDs únicos
            const idsUnicos = [...new Set(receitas.map(r => r.receita_id_legado))];
            receitasEncontradas.push(...idsUnicos);
          }
        }
        
        // Remover duplicatas
        receitasEncontradas = [...new Set(receitasEncontradas)];
        
        if (receitasEncontradas.length === 0) {
          console.warn(`⚠️ Nenhuma receita encontrada para ${categoria}`);
          return null;
        }
        
        console.log(`📦 ${receitasEncontradas.length} receitas candidatas para ${categoria}`);
        
        // Testar receitas até encontrar uma dentro do orçamento
        for (const receitaId of receitasEncontradas.slice(0, 3)) {
          const custo = await calculateSimpleCost(receitaId, mealQuantity);
          
          if (custo.custo_por_refeicao > 0 && custo.custo_por_refeicao <= budget) {
            console.log(`  ✅ Selecionada: ${custo.nome} - R$${custo.custo_por_refeicao.toFixed(2)}`);
            return custo;
          } else {
            console.log(`  ❌ Rejeitada: ${custo.nome} - R$${custo.custo_por_refeicao.toFixed(2)} (fora do orçamento)`);
          }
        }
        
        return null;
        
      } catch (error) {
        console.error(`❌ Erro ao buscar ${categoria}:`, error.message);
        return null;
      }
    }

    // ============ FUNÇÃO BÁSICA DE CÁLCULO (MANTIDA) ============
    async function calculateSimpleCost(recipeId, mealQuantity = 100) {
      console.log(`🧮 Calculando receita ${recipeId}`);
      
      try {
        const { data: ingredients, error: ingError } = await supabase
          .from('receita_ingredientes')
          .select('nome, produto_base_id, produto_base_descricao, quantidade, unidade')
          .eq('receita_id_legado', recipeId)
          .limit(10);
        
        if (ingError || !ingredients || ingredients.length === 0) {
          return {
            id: recipeId,
            nome: `Receita ${recipeId}`,
            custo: 0,
            custo_por_refeicao: 0,
            erro: 'Sem ingredientes'
          };
        }
        
        const recipeName = ingredients[0].nome;
        
        const productIds = ingredients
          .map(i => i.produto_base_id)
          .filter(id => id && Number(id) > 0)
          .slice(0, 5);
        
        if (productIds.length === 0) {
          return {
            id: recipeId,
            nome: recipeName,
            custo: 0,
            custo_por_refeicao: 0,
            erro: 'Sem IDs de produtos'
          };
        }
        
        const { data: prices } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('produto_base_id, preco, descricao')
          .in('produto_base_id', productIds)
          .gt('preco', 0)
          .limit(5);
        
        let totalCost = 0;
        let foundPrices = 0;
        
        for (const ingredient of ingredients.slice(0, 5)) {
          const price = prices?.find(p => Number(p.produto_base_id) === Number(ingredient.produto_base_id));
          
          if (price && ingredient.quantidade) {
            const qty = Number(ingredient.quantidade) || 0;
            const unitPrice = Number(price.preco) || 0;
            let cost = qty * unitPrice;
            
            if (ingredient.unidade === 'ML' && cost > 100) {
              cost = cost / 10;
            }
            if (cost > 1000) {
              cost = cost / 100;
            }
            
            totalCost += cost;
            foundPrices++;
          }
        }
        
        const costPerMeal = mealQuantity > 0 ? totalCost / mealQuantity : 0;
        const precisao = ingredients.length > 0 ? Math.round((foundPrices / ingredients.length) * 100) : 0;
        
        return {
          id: recipeId,
          nome: recipeName,
          custo: totalCost,
          custo_por_refeicao: costPerMeal,
          ingredientes: ingredients.length,
          ingredientes_com_preco: foundPrices,
          precisao: precisao
        };
        
      } catch (error) {
        return {
          id: recipeId,
          nome: `Receita ${recipeId}`,
          custo: 0,
          custo_por_refeicao: 0,
          erro: error.message
        };
      }
    }

    // ============ GERAÇÃO DE CARDÁPIO COM ESTRUTURA FIXA ============
    if (requestData.action === 'generate_menu') {
      const mealQuantity = requestData.refeicoesPorDia || requestData.meal_quantity || 100;
      const clientName = requestData.cliente || 'Cliente';
      const budget = requestData.orcamento_por_refeicao || 9.00;
      
      console.log(`🍽️ Gerando cardápio estruturado para ${mealQuantity} refeições, orçamento R$${budget}`);
      
      try {
        const cardapioCompleto = [];
        let custoTotalAcumulado = 0;
        const logs = [];
        
        // Percorrer estrutura fixa do cardápio
        for (const [codigo, config] of Object.entries(ESTRUTURA_CARDAPIO)) {
          const orcamentoItem = budget * (config.budget_percent / 100);
          
          console.log(`\n📋 Processando ${codigo} (${config.categoria})`);
          console.log(`💰 Orçamento alocado: R$${orcamentoItem.toFixed(2)}`);
          
          let receita = null;
          
          // Se tem receita_id específica (ARROZ, FEIJÃO)
          if (config.receita_id) {
            receita = await calculateSimpleCost(config.receita_id, mealQuantity);
            console.log(`🎯 Receita fixa: ${receita.nome}`);
          } else {
            // Buscar receita por categoria
            receita = await buscarReceitasPorCategoria(config.categoria, orcamentoItem, mealQuantity);
          }
          
          if (receita && receita.custo_por_refeicao > 0) {
            cardapioCompleto.push({
              codigo: codigo,
              categoria: config.categoria,
              receita: receita,
              orcamento_alocado: orcamentoItem.toFixed(2),
              custo_real: receita.custo_por_refeicao.toFixed(2),
              economia: (orcamentoItem - receita.custo_por_refeicao).toFixed(2),
              status: '✅'
            });
            
            custoTotalAcumulado += receita.custo_por_refeicao;
            logs.push(`✅ ${codigo}: ${receita.nome} - R$${receita.custo_por_refeicao.toFixed(2)}`);
          } else {
            cardapioCompleto.push({
              codigo: codigo,
              categoria: config.categoria,
              receita: { nome: `${config.categoria} (não encontrada)`, custo_por_refeicao: 0 },
              orcamento_alocado: orcamentoItem.toFixed(2),
              custo_real: '0.00',
              economia: orcamentoItem.toFixed(2),
              status: '❌'
            });
            
            logs.push(`❌ ${codigo}: Não encontrada`);
          }
        }
        
        // Resumo final
        const economiaTotal = budget - custoTotalAcumulado;
        const economiaPercentual = (economiaTotal / budget) * 100;
        
        console.log(`\n🎉 CARDÁPIO ESTRUTURADO GERADO:`);
        logs.forEach(log => console.log(`   ${log}`));
        console.log(`💰 Custo total: R$${custoTotalAcumulado.toFixed(2)}/refeição`);
        console.log(`💰 Economia: R$${economiaTotal.toFixed(2)} (${economiaPercentual.toFixed(1)}%)`);
        
        // Estrutura de resposta compatível com o frontend
        const response = {
          success: true,
          version: 'ESTRUTURA-FIXA-v1.0',
          
          solicitacao: {
            cliente: clientName,
            quantidade_refeicoes: mealQuantity,
            orcamento_por_refeicao: budget,
            estrutura_aplicada: 'PP1, PP2, Arroz, Feijão, Salada1, Salada2, Suco1, Suco2'
          },
          
          cardapio: {
            receitas: cardapioCompleto.map(item => ({
              id: item.receita.id || Date.now(),
              nome: item.receita.nome,
              categoria: item.categoria,
              codigo: item.codigo,
              tipo: item.categoria,
              custo_total: (item.receita.custo || 0).toFixed(2),
              custo_por_refeicao: item.custo_real,
              orcamento_alocado: item.orcamento_alocado,
              economia_item: item.economia,
              precisao: item.receita.precisao ? `${item.receita.precisao}%` : '0%',
              status: item.status,
              posicao: Object.keys(ESTRUTURA_CARDAPIO).indexOf(item.codigo) + 1
            })),
            
            resumo: {
              total_receitas: cardapioCompleto.length,
              receitas_encontradas: cardapioCompleto.filter(i => i.status === '✅').length,
              receitas_faltantes: cardapioCompleto.filter(i => i.status === '❌').length
            }
          },
          
          analise_financeira: {
            custo_total_por_refeicao: custoTotalAcumulado.toFixed(2),
            orcamento_total: budget.toFixed(2),
            economia_total: economiaTotal.toFixed(2),
            economia_percentual: economiaPercentual.toFixed(1) + '%',
            dentro_orcamento: custoTotalAcumulado <= budget,
            situacao: custoTotalAcumulado <= budget ? 
              '✅ Dentro do orçamento' : 
              `❌ Acima em R$${(custoTotalAcumulado - budget).toFixed(2)}`
          },
          
          estrutura_cardapio: {
            descricao: 'PP1, PP2, Arroz Branco, Feijão, Salada 1 (Verduras), Salada 2 (Legumes), Suco 1, Suco 2',
            distribuicao_orcamento: Object.fromEntries(
              Object.entries(ESTRUTURA_CARDAPIO).map(([key, val]) => [
                key, 
                `${val.budget_percent}% (R$${(budget * val.budget_percent / 100).toFixed(2)})`
              ])
            )
          },
          
          metadata: {
            data_geracao: new Date().toISOString(),
            tempo_processamento_ms: Date.now() - startTime,
            metodo_calculo: 'estrutura_fixa_8_itens',
            versao: 'ESTRUTURA-FIXA-v1.0'
          }
        };
        
        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (error) {
        console.error('💥 ERRO na geração estruturada:', error);
        
        return new Response(
          JSON.stringify({
            success: false,
            version: 'ESTRUTURA-FIXA-v1.0',
            erro: 'Falha na geração do cardápio estruturado',
            detalhes: error.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // ============ TESTE DE RECEITA (MANTIDO) ============
    if (requestData.action === 'test_recipe_cost') {
      const recipeId = requestData.receita_id || 580;
      const mealQuantity = requestData.meal_quantity || 100;
      
      const result = await calculateSimpleCost(recipeId, mealQuantity);
      
      return new Response(
        JSON.stringify({
          success: true,
          version: 'ESTRUTURA-FIXA-v1.0',
          tempo_ms: Date.now() - startTime,
          ...result
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default
    return new Response(
      JSON.stringify({
        success: true,
        version: 'ESTRUTURA-FIXA-v1.0',
        message: 'Sistema com estrutura fixa de cardápio funcionando',
        estrutura: Object.keys(ESTRUTURA_CARDAPIO),
        actions: ['test_recipe_cost', 'generate_menu']
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        version: 'ESTRUTURA-FIXA-v1.0',
        erro: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});