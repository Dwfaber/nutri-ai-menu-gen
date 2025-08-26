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
        version: 'CORRIGIDA-COMPLETA-v2.0',
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

    // ============ FUNÇÃO PARA BUSCAR ORÇAMENTO DA FILIAL ============
    async function buscarOrcamentoFilial(filialId) {
      console.log(`💰 Buscando orçamento para filial ${filialId}`);
      
      try {
        const { data, error } = await supabase
          .from('custos_filiais')
          .select('*')
          .eq('filial_id', filialId)
          .single();
        
        if (error || !data) {
          console.warn(`⚠️ Filial ${filialId} sem dados de orçamento, usando padrão`);
          return { custo_diario: 9.00 };
        }
        
        // Pegar o dia da semana atual
        const diasSemana = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
        const hoje = new Date();
        const diaSemana = diasSemana[hoje.getDay()];
        
        // Buscar custo do dia específico
        const campoCusto = `RefCusto${diaSemana}`;
        const custoHoje = data[campoCusto] || data.RefCustoSegunda || 9.00;
        
        // Calcular média semanal se disponível
        const custoMedio = data.custo_medio_semanal ? 
          (data.custo_medio_semanal / 7) : custoHoje;
        
        console.log(`✅ Filial ${filialId} (${data.nome_fantasia}): R$ ${custoMedio.toFixed(2)}/dia`);
        
        return {
          custo_diario: custoMedio,
          nome_filial: data.nome_fantasia || data.razao_social,
          custos_semana: {
            segunda: data.RefCustoSegunda,
            terca: data.RefCustoTerca,
            quarta: data.RefCustoQuarta,
            quinta: data.RefCustoQuinta,
            sexta: data.RefCustoSexta,
            sabado: data.RefCustoSabado,
            domingo: data.RefCustoDomingo
          }
        };
        
      } catch (error) {
        console.error('❌ Erro ao buscar orçamento:', error);
        return { custo_diario: 9.00 };
      }
    }

    // ============ FUNÇÃO MELHORADA PARA BUSCAR RECEITAS ============
    async function buscarReceitasPorCategoria(categoria, budget, mealQuantity) {
      console.log(`🔍 Buscando ${categoria} com orçamento R$${budget.toFixed(2)}`);
      
      try {
        // PALAVRAS-CHAVE EXPANDIDAS E MELHORADAS
        const palavrasChave = {
          'Proteína Principal 1': ['FRANGO', 'CARNE', 'PEIXE', 'BOVINA', 'SUINA', 'PEITO', 'COXA', 'FILE'],
          'Proteína Principal 2': ['LINGUICA', 'OVO', 'HAMBURGUER', 'ALMONDEGA', 'SALSICHA', 'CARNE MOIDA'],
          'Salada 1 (Verduras)': [
            'SALADA', 'ALFACE', 'ACELGA', 'COUVE', 'ESPINAFRE', 'RUCULA', 'AGRIAO',
            'FOLHAS', 'VERDURA', 'FOLHOSO', 'SALADA VERDE', 'SALADA MISTA'
          ],
          'Salada 2 (Legumes)': [
            'TOMATE', 'PEPINO', 'CENOURA', 'BETERRABA', 'ABOBRINHA', 'CHUCHU',
            'LEGUME', 'SALADA COLORIDA', 'VINAGRETE', 'SALADA DE LEGUMES'
          ],
          'Suco 1': ['SUCO', 'LARANJA', 'LIMAO', 'MARACUJA', 'ABACAXI', 'UVA', 'REFRESCO'],
          'Suco 2': ['GOIABA', 'MANGA', 'CAJU', 'ACEROLA', 'AGUA SABORIZADA', 'MELANCIA', 'MORANGO']
        };
        
        const keywords = palavrasChave[categoria] || [categoria.toUpperCase()];
        let todasReceitas = new Set();
        
        // BUSCA MELHORADA: Tentar múltiplas estratégias
        
        // 1. Buscar por nome da receita
        for (const keyword of keywords.slice(0, 5)) {
          const { data: receitasPorNome } = await supabase
            .from('receita_ingredientes')
            .select('receita_id_legado, nome')
            .ilike('nome', `%${keyword}%`)
            .limit(10);
          
          if (receitasPorNome) {
            receitasPorNome.forEach(r => {
              if (r.receita_id_legado) {
                todasReceitas.add(JSON.stringify({
                  id: r.receita_id_legado,
                  nome: r.nome
                }));
              }
            });
          }
        }
        
        // 2. Se não encontrou nada, buscar IDs conhecidos para saladas
        if (todasReceitas.size === 0 && categoria.includes('Salada')) {
          console.log('🥗 Buscando IDs conhecidos de saladas...');
          const saladasConhecidas = [
            { id: 1018, nome: 'SALADA COLORIDA' },
            { id: 18, nome: 'SALADA MISTA' },
            { id: 1020, nome: 'PEPINO COM TOMATE' },
            { id: 933, nome: 'ALFACE CROCANTE' },
            { id: 934, nome: 'ALFACE LISA' },
            { id: 935, nome: 'ALFACE MIMOSA' }
          ];
          
          for (const salada of saladasConhecidas) {
            todasReceitas.add(JSON.stringify(salada));
          }
        }
        
        // Converter Set para Array de objetos únicos
        const receitasUnicas = Array.from(todasReceitas).map(r => JSON.parse(r));
        
        if (receitasUnicas.length === 0) {
          console.warn(`⚠️ Nenhuma receita encontrada para ${categoria}`);
          return null;
        }
        
        console.log(`📦 ${receitasUnicas.length} receitas encontradas para ${categoria}`);
        
        // Testar receitas até encontrar uma adequada
        for (const receita of receitasUnicas.slice(0, 5)) {
          const custo = await calculateSimpleCost(receita.id, mealQuantity);
          
          if (custo && custo.custo_por_refeicao > 0 && custo.custo_por_refeicao <= budget) {
            console.log(`  ✅ Selecionada: ${custo.nome} - R$${custo.custo_por_refeicao.toFixed(2)}`);
            return custo;
          }
        }
        
        // Se não encontrou nada no orçamento, pegar a mais barata
        console.log(`⚠️ Nenhuma ${categoria} dentro do orçamento, pegando mais barata...`);
        let maisBarata = null;
        
        for (const receita of receitasUnicas.slice(0, 3)) {
          const custo = await calculateSimpleCost(receita.id, mealQuantity);
          if (!maisBarata || (custo.custo_por_refeicao > 0 && custo.custo_por_refeicao < maisBarata.custo_por_refeicao)) {
            maisBarata = custo;
          }
        }
        
        return maisBarata;
        
      } catch (error) {
        console.error(`❌ Erro ao buscar ${categoria}:`, error);
        return null;
      }
    }

    // ============ FUNÇÃO DE CÁLCULO (MANTIDA MAS MELHORADA) ============
    async function calculateSimpleCost(recipeId, mealQuantity = 100) {
      try {
        const { data: ingredients, error } = await supabase
          .from('receita_ingredientes')
          .select('nome, produto_base_id, produto_base_descricao, quantidade, unidade')
          .eq('receita_id_legado', recipeId)
          .limit(10);
        
        if (error || !ingredients || ingredients.length === 0) {
          return {
            id: recipeId,
            nome: `Receita ${recipeId}`,
            custo: 0,
            custo_por_refeicao: 0,
            ingredientes: [],
            erro: 'Sem ingredientes'
          };
        }
        
        const recipeName = ingredients[0].nome;
        
        const productIds = ingredients
          .map(i => i.produto_base_id)
          .filter(id => id && Number(id) > 0)
          .slice(0, 10);
        
        if (productIds.length === 0) {
          return {
            id: recipeId,
            nome: recipeName,
            custo: 0,
            custo_por_refeicao: 0,
            ingredientes: [],
            erro: 'Sem IDs de produtos'
          };
        }
        
        const { data: prices } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('produto_base_id, preco, descricao')
          .in('produto_base_id', productIds)
          .gt('preco', 0)
          .limit(10);
        
        let totalCost = 0;
        let foundPrices = 0;
        const ingredientesCalculados = [];
        
        for (const ingredient of ingredients) {
          const price = prices?.find(p => Number(p.produto_base_id) === Number(ingredient.produto_base_id));
          
          if (price && ingredient.quantidade) {
            const qty = Number(ingredient.quantidade) || 0;
            const unitPrice = Number(price.preco) || 0;
            let cost = qty * unitPrice;
            
            // Ajustes para unidades
            if (ingredient.unidade === 'ML' && cost > 100) {
              cost = cost / 10;
            }
            if (cost > 1000) {
              cost = cost / 100;
            }
            
            totalCost += cost;
            foundPrices++;
            
            ingredientesCalculados.push({
              nome: ingredient.produto_base_descricao,
              quantidade: qty,
              unidade: ingredient.unidade,
              preco_unitario: unitPrice,
              custo_total: cost,
              produto_mercado: price.descricao
            });
          }
        }
        
        const costPerMeal = mealQuantity > 0 ? totalCost / mealQuantity : 0;
        
        return {
          id: recipeId,
          nome: recipeName,
          custo: totalCost,
          custo_por_refeicao: costPerMeal,
          ingredientes: ingredientesCalculados,
          ingredientes_total: ingredients.length,
          ingredientes_com_preco: foundPrices,
          precisao: ingredients.length > 0 ? Math.round((foundPrices / ingredients.length) * 100) : 0
        };
        
      } catch (error) {
        console.error(`❌ Erro ao calcular receita ${recipeId}:`, error);
        return null;
      }
    }

    // ============ GERAÇÃO DE MENU PRINCIPAL ============
    if (requestData.action === 'generate_menu') {
      const mealQuantity = requestData.refeicoesPorDia || requestData.meal_quantity || 100;
      const filialId = requestData.filialIdLegado || requestData.filial_id || null;
      const clientName = requestData.cliente || requestData.clientName || 'Cliente';
      
      console.log(`🍽️ Gerando cardápio para ${mealQuantity} refeições`);
      
      try {
        // PASSO 1: Buscar orçamento da filial
        let budget = 9.00; // Valor padrão
        let dadosFilial = null;
        
        if (filialId) {
          dadosFilial = await buscarOrcamentoFilial(filialId);
          budget = dadosFilial.custo_diario || 9.00;
          console.log(`💰 Orçamento da filial ${filialId}: R$ ${budget.toFixed(2)}/dia`);
        } else {
          console.log(`💰 Usando orçamento padrão: R$ ${budget.toFixed(2)}/dia`);
        }
        
        // PASSO 2: Gerar cardápio estruturado
        const cardapioCompleto = [];
        let custoTotalAcumulado = 0;
        const listaCompras = new Map();
        
        for (const [codigo, config] of Object.entries(ESTRUTURA_CARDAPIO)) {
          const orcamentoItem = budget * (config.budget_percent / 100);
          
          console.log(`\n📋 ${codigo}: ${config.categoria} (R$ ${orcamentoItem.toFixed(2)})`);
          
          let receita = null;
          
          // Receitas fixas (arroz e feijão)
          if (config.receita_id) {
            receita = await calculateSimpleCost(config.receita_id, mealQuantity);
          } else {
            // Buscar receita por categoria
            receita = await buscarReceitasPorCategoria(config.categoria, orcamentoItem, mealQuantity);
          }
          
          if (receita && receita.custo_por_refeicao > 0) {
            cardapioCompleto.push({
              codigo: codigo,
              categoria: config.categoria,
              receita: receita,
              orcamento_alocado: orcamentoItem,
              custo_real: receita.custo_por_refeicao,
              economia: orcamentoItem - receita.custo_por_refeicao,
              status: '✅'
            });
            
            custoTotalAcumulado += receita.custo_por_refeicao;
            
            // Adicionar ingredientes à lista de compras
            if (receita.ingredientes && Array.isArray(receita.ingredientes)) {
              for (const ing of receita.ingredientes) {
                const key = ing.nome;
                if (listaCompras.has(key)) {
                  const existing = listaCompras.get(key);
                  existing.quantidade += ing.quantidade;
                  existing.custo_total += ing.custo_total;
                } else {
                  listaCompras.set(key, {
                    nome: ing.nome,
                    quantidade: ing.quantidade,
                    unidade: ing.unidade,
                    custo_total: ing.custo_total,
                    produto_mercado: ing.produto_mercado
                  });
                }
              }
            }
            
            console.log(`  ✅ ${receita.nome}: R$ ${receita.custo_por_refeicao.toFixed(2)}`);
          } else {
            cardapioCompleto.push({
              codigo: codigo,
              categoria: config.categoria,
              receita: { 
                nome: `${config.categoria} (não disponível)`, 
                custo_por_refeicao: 0,
                ingredientes: []
              },
              orcamento_alocado: orcamentoItem,
              custo_real: 0,
              economia: orcamentoItem,
              status: '❌'
            });
            
            console.log(`  ❌ Não encontrada`);
          }
        }
        
        // PASSO 3: Preparar lista de compras
        const itensListaCompras = Array.from(listaCompras.values())
          .sort((a, b) => b.custo_total - a.custo_total)
          .map(item => ({
            ...item,
            quantidade: item.quantidade.toFixed(3),
            custo_total: item.custo_total.toFixed(2)
          }));
        
        // PASSO 4: Montar resposta completa
        const response = {
          success: true,
          version: 'CORRIGIDA-COMPLETA-v2.0',
          
          solicitacao: {
            cliente: dadosFilial?.nome_filial || clientName,
            filial_id: filialId,
            quantidade_refeicoes: mealQuantity,
            orcamento_por_refeicao: budget,
            orcamento_total: (budget * mealQuantity).toFixed(2)
          },
          
          cardapio: {
            receitas: cardapioCompleto.map((item, index) => ({
              id: item.receita.id || `${Date.now()}-${index}`,
              nome: item.receita.nome,
              categoria: item.categoria,
              codigo: item.codigo,
              custo_total: (item.receita.custo || 0).toFixed(2),
              custo_por_refeicao: item.custo_real.toFixed(2),
              orcamento_alocado: item.orcamento_alocado.toFixed(2),
              economia_item: item.economia.toFixed(2),
              precisao: item.receita.precisao ? `${item.receita.precisao}%` : '0%',
              status: item.status,
              posicao: index + 1,
              ingredientes_count: item.receita.ingredientes?.length || 0
            })),
            
            resumo: {
              total_receitas: cardapioCompleto.length,
              receitas_encontradas: cardapioCompleto.filter(i => i.status === '✅').length,
              receitas_faltantes: cardapioCompleto.filter(i => i.status === '❌').length
            }
          },
          
          analise_financeira: {
            custo_total_cardapio: (custoTotalAcumulado * mealQuantity).toFixed(2),
            custo_por_refeicao: custoTotalAcumulado.toFixed(2),
            orcamento_total: budget.toFixed(2),
            economia_total: ((budget - custoTotalAcumulado) * mealQuantity).toFixed(2),
            economia_por_refeicao: (budget - custoTotalAcumulado).toFixed(2),
            economia_percentual: ((budget - custoTotalAcumulado) / budget * 100).toFixed(1) + '%',
            dentro_orcamento: custoTotalAcumulado <= budget,
            situacao: custoTotalAcumulado <= budget ? 
              '✅ Dentro do orçamento' : 
              `❌ Acima em R$${(custoTotalAcumulado - budget).toFixed(2)}/refeição`
          },
          
          resumo_financeiro: {
            custo_total: (custoTotalAcumulado * mealQuantity).toFixed(2),
            custo_por_refeicao: custoTotalAcumulado.toFixed(2),
            economia: ((budget - custoTotalAcumulado) * mealQuantity).toFixed(2),
            dentro_orcamento: custoTotalAcumulado <= budget
          },
          
          lista_compras: {
            total_itens: itensListaCompras.length,
            custo_total: itensListaCompras.reduce((sum, item) => 
              sum + parseFloat(item.custo_total), 0).toFixed(2),
            itens: itensListaCompras
          },
          
          estrutura_aplicada: {
            descricao: 'PP1, PP2, Arroz, Feijão, Salada 1, Salada 2, Suco 1, Suco 2',
            distribuicao: Object.entries(ESTRUTURA_CARDAPIO).map(([key, val]) => ({
              codigo: key,
              categoria: val.categoria,
              percentual: val.budget_percent + '%',
              valor_alocado: (budget * val.budget_percent / 100).toFixed(2)
            }))
          },
          
          metadata: {
            data_geracao: new Date().toISOString(),
            tempo_processamento_ms: Date.now() - startTime,
            fonte_orcamento: filialId ? 'custos_filiais' : 'padrao',
            versao: 'CORRIGIDA-COMPLETA-v2.0'
          }
        };
        
        console.log(`\n✅ CARDÁPIO GERADO COM SUCESSO`);
        console.log(`💰 Custo total: R$ ${custoTotalAcumulado.toFixed(2)}/refeição`);
        console.log(`💰 Orçamento: R$ ${budget.toFixed(2)}/refeição`);
        console.log(`✅ Economia: R$ ${(budget - custoTotalAcumulado).toFixed(2)}/refeição`);
        
        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (error) {
        console.error('💥 ERRO:', error);
        
        return new Response(
          JSON.stringify({
            success: false,
            version: 'CORRIGIDA-COMPLETA-v2.0',
            erro: 'Erro na geração do cardápio',
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
          version: 'CORRIGIDA-COMPLETA-v2.0',
          tempo_ms: Date.now() - startTime,
          ...result
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ DEFAULT ============
    return new Response(
      JSON.stringify({
        success: true,
        version: 'CORRIGIDA-COMPLETA-v2.0',
        message: 'Sistema funcionando com todas as correções',
        features: [
          'Orçamento dinâmico por filial',
          'Busca melhorada de saladas',
          'Lista de compras integrada',
          'Estrutura fixa de 8 itens'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        version: 'CORRIGIDA-COMPLETA-v2.0',
        erro: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});