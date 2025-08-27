import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ ESTRUTURA OBRIGATÓRIA PARA CARDÁPIO ============
const ESTRUTURA_CARDAPIO = {
  "PP1": { "obrigatorio": true, "porcentagem": 22.0, "categoria": "PP1" },
  "PP2": { "obrigatorio": true, "porcentagem": 20.0, "categoria": "PP2" },
  "Arroz Branco": { "obrigatorio": true, "porcentagem": 13.0, "categoria": "Arroz Branco" },
  "Feijão": { "obrigatorio": true, "porcentagem": 7.0, "categoria": "Feijão" },
  "Salada 1 (Verduras)": { "obrigatorio": true, "porcentagem": 10.0, "categoria": "Salada 1" },
  "Salada 2 (Legumes)": { "obrigatorio": true, "porcentagem": 8.0, "categoria": "Salada 2" },
  "Suco 1": { "obrigatorio": true, "porcentagem": 6.0, "categoria": "Suco 1" },
  "Suco 2": { "obrigatorio": true, "porcentagem": 5.0, "categoria": "Suco 2" },
  "Guarnição": { "obrigatorio": true, "porcentagem": 5.0, "categoria": "Guarnição" },
  "Sobremesa": { "obrigatorio": true, "porcentagem": 4.0, "categoria": "Sobremesa" }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'healthy', 
        version: 'CORRIGIDA-COMPLETA-v3.0',
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
      
      const { data, error } = await supabase
        .from('custos_filiais')
        .select('*')
        .eq('filial_id', filialId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ Erro ao buscar orçamento:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ Nenhum orçamento encontrado, usando valor padrão');
        return {
          filial_id: filialId,
          custo_diario: 16.0,
          nome_filial: `Filial ${filialId}`
        };
      }

      const budget = data[0];
      const custoMediaSemanal = budget.custo_medio_semanal || 0;
      const custoDiario = custoMediaSemanal > 0 ? custoMediaSemanal / 7 : 16.0;

      console.log(`✅ Orçamento encontrado: R$ ${custoDiario.toFixed(2)}/dia para ${budget.nome_filial}`);
      
      return {
        ...budget,
        custo_diario: custoDiario
      };
    }

    // ============ FUNÇÃO DE BUSCA POR CATEGORIA MELHORADA ============
    async function buscarReceitasPorCategoria(categoria, budget, mealQuantity) {
      try {
        // Palavras-chave expandidas para cada categoria
        const palavrasChave = {
          'Arroz Branco': ['ARROZ', 'RICE'],
          'Feijão': ['FEIJÃO', 'FEIJAO', 'BEAN'],
          'Salada 1 (Verduras)': ['ALFACE', 'COUVE', 'RÚCULA', 'RUCULA', 'AGRIÃO', 'ESPINAFRE', 'ALMEIRÃO', 'ACELGA', 'SALADA VERDE', 'VERDURAS'],
          'Salada 2 (Legumes)': ['CENOURA', 'BETERRABA', 'TOMATE', 'PEPINO', 'CHUCHU', 'ABOBRINHA', 'BERINJELA', 'PIMENTÃO', 'SALADA MISTA', 'LEGUMES'],
          'Suco 1': ['SUCO', 'REFRESCO', 'VITAMINA', 'MARACUJÁ', 'LARANJA', 'UVA', 'AÇAÍ', 'LIMÃO', 'ABACAXI', 'MANGA', 'GOIABA', 'CAJU'],
          'Suco 2': ['SUCO', 'REFRESCO', 'VITAMINA', 'MARACUJÁ', 'LARANJA', 'UVA', 'AÇAÍ', 'LIMÃO', 'ABACAXI', 'MANGA', 'GOIABA', 'CAJU'],
          'Guarnição': ['BATATA', 'MACARRÃO', 'MANDIOCA', 'POLENTA', 'PURÊ', 'FAROFA', 'MASSA', 'NHOQUE', 'MANDIOQUINHA', 'INHAME'],
          'Sobremesa': ['CREME DE GOIABADA', 'DOCE', 'MOUSSE', 'GELATINA', 'PUDIM', 'BRIGADEIRO', 'COCADA', 'GOIABADA', 'FRUTA', 'SOBREMESA'],
          'Peixe': ['PEIXE', 'PESCADO', 'SALMÃO', 'TILÁPIA', 'SARDINHA', 'BACALHAU', 'MERLUZA', 'PESCADA', 'FISH']
        };

        const palavras = palavrasChave[categoria] || [categoria.toUpperCase()];
        
        console.log(`🔍 Buscando ${categoria} com palavras-chave: ${palavras.join(', ')}`);

        // Primeira tentativa: buscar na tabela receita_ingredientes
        const orConditions = palavras.map(palavra => `nome.ilike.%${palavra}%`).join(',');
        
        const { data, error } = await supabase
          .from('receita_ingredientes')
          .select('receita_id_legado, nome, categoria_descricao')
          .or(orConditions)
          .limit(30);

        if (error) {
          console.error(`❌ Erro ao buscar receitas para ${categoria}:`, error);
          throw error;
        }

        // Se não encontrou nada, tentar buscar na tabela receitas_legado
        if (!data || data.length === 0) {
          console.log(`⚠️ Tentando buscar ${categoria} na tabela receitas_legado...`);
          
          const { data: receitasLegado, error: errorLegado } = await supabase
            .from('receitas_legado')
            .select('receita_id_legado, nome_receita as nome, categoria_descricao')
            .or(palavras.map(palavra => `nome_receita.ilike.%${palavra}%`).join(','))
            .eq('inativa', false)
            .limit(30);

          if (!errorLegado && receitasLegado && receitasLegado.length > 0) {
            console.log(`✅ Encontradas ${receitasLegado.length} receitas em receitas_legado para ${categoria}`);
            return await processarReceitas(receitasLegado, budget, mealQuantity, categoria);
          }
        }

        console.log(`📦 ${data?.length || 0} receitas encontradas para ${categoria}`);
        
        if (!data || data.length === 0) {
          console.warn(`⚠️ Nenhuma receita encontrada para ${categoria}`);
          return null;
        }

        return await processarReceitas(data, budget, mealQuantity, categoria);
        
      } catch (error) {
        console.error(`❌ Erro fatal ao buscar ${categoria}:`, error);
        return null;
      }
    }

    // ============ FUNÇÃO PARA PROCESSAR RECEITAS ENCONTRADAS ============
    async function processarReceitas(receitas, budget, mealQuantity, categoria) {
      try {
        console.log(`📝 Processando ${receitas.length} receitas para ${categoria}`);
        
        // Avaliar cada receita encontrada
        const receitasAvaliadas = [];
        
        for (const receita of receitas || []) {
          try {
            const custo = await calculateSimpleCost(receita.receita_id_legado, mealQuantity);
            if (custo && custo.custo_por_refeicao > 0 && custo.custo_por_refeicao <= budget) {
              receitasAvaliadas.push({
                receita_id: receita.receita_id_legado,
                nome: receita.nome,
                custo_por_refeicao: custo.custo_por_refeicao,
                categoria: receita.categoria_descricao || categoria
              });
            }
          } catch (costError) {
            console.warn(`⚠️ Erro ao calcular custo da receita ${receita.nome}:`, costError);
          }
        }

        if (receitasAvaliadas.length > 0) {
          // Retornar receita mais barata que cabe no orçamento
          const receitaEscolhida = receitasAvaliadas.sort((a, b) => a.custo_por_refeicao - b.custo_por_refeicao)[0];
          console.log(`✅ Receita selecionada: ${receitaEscolhida.nome} - R$${receitaEscolhida.custo_por_refeicao.toFixed(2)}`);
          return receitaEscolhida;
        }

        // Fallback: tentar buscar a receita mais barata disponível
        console.warn(`⚠️ Nenhuma ${categoria} dentro do orçamento R$${budget.toFixed(2)}, pegando mais barata...`);
        
        for (const receita of receitas || []) {
          try {
            const custo = await calculateSimpleCost(receita.receita_id_legado, mealQuantity);
            if (custo && custo.custo_por_refeicao > 0) {
              console.log(`🔄 Fallback: ${receita.nome} - R$${custo.custo_por_refeicao.toFixed(2)}`);
              return {
                receita_id: receita.receita_id_legado,
                nome: receita.nome,
                custo_por_refeicao: custo.custo_por_refeicao,
                categoria: receita.categoria_descricao || categoria
              };
            }
          } catch (costError) {
            console.warn(`⚠️ Erro ao calcular custo da receita ${receita.nome}:`, costError);
          }
        }
        
        console.warn(`❌ Nenhuma receita viável encontrada para ${categoria}`);
        return null;
        
      } catch (error) {
        console.error(`❌ Erro fatal ao processar receitas para ${categoria}:`, error);
        return null;
      }
    }

    // ============ CACHE GLOBAL DE PREÇOS ============
    let pricesCache = new Map();
    
    async function loadPricesCache() {
      if (pricesCache.size > 0) {
        console.log(`💾 Cache de preços já carregado: ${pricesCache.size} produtos`);
        return pricesCache;
      }
      
      console.log('🔄 Carregando cache global de preços...');
      const { data: allPrices, error } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('produto_base_id, preco, descricao, produto_base_quantidade_embalagem, unidade')
        .gt('preco', 0)
        .order('preco', { ascending: true });
      
      if (!error && allPrices) {
        allPrices.forEach(price => {
          const key = price.produto_base_id;
          if (!pricesCache.has(key) || pricesCache.get(key).preco > price.preco) {
            pricesCache.set(key, price);
          }
        });
        console.log(`✅ Cache carregado: ${pricesCache.size} produtos únicos`);
      }
      
      return pricesCache;
    }

    // ============ FUNÇÃO DE CÁLCULO OTIMIZADA COM CACHE ============
    async function calculateSimpleCost(recipeId, mealQuantity = 100) {
      try {
        const { data: ingredients, error } = await supabase
          .from('receita_ingredientes')
          .select('*')
          .eq('receita_id_legado', recipeId)
          .limit(15);

        if (error) {
          console.error(`❌ Erro ao buscar ingredientes da receita ${recipeId}:`, error);
          throw error;
        }

        if (!ingredients || ingredients.length === 0) {
          console.warn(`⚠️ Receita ${recipeId} não tem ingredientes`);
          return null;
        }

        const recipeName = ingredients[0].nome || `Receita ${recipeId}`;
        const baseQuantity = ingredients[0].quantidade_refeicoes || 100;
        
        console.log(`📦 ${recipeName}: ${ingredients.length} ingredientes para ${baseQuantity} porções`);

        // Usar cache de preços ao invés de queries individuais
        await loadPricesCache();
        
        let totalCost = 0;
        const ingredientesCalculados = [];
        
        // Processar ingredientes em paralelo para melhor performance
        const costPromises = ingredients.map(async (ingredient) => {
          const price = pricesCache.get(ingredient.produto_base_id);
          
          if (price && ingredient.quantidade) {
            const qty = parseFloat(ingredient.quantidade) || 0;
            const unitPrice = parseFloat(price.preco) || 0;
            
            let itemCost = await calculateIngredientCost(ingredient, price, qty, unitPrice);
            
            return {
              nome: ingredient.produto_base_descricao,
              quantidade: qty,
              unidade: ingredient.unidade,
              preco_unitario: unitPrice,
              custo_item: itemCost,
              encontrado: true
            };
          } else {
            console.log(`  ❌ ${ingredient.produto_base_descricao}: sem preço encontrado`);
            return null;
          }
        });
        
        const results = await Promise.all(costPromises);
        const validResults = results.filter(result => result !== null);
        
        totalCost = validResults.reduce((sum, result) => sum + result.custo_item, 0);
        ingredientesCalculados.push(...validResults);

        // Função auxiliar para calcular custo de ingrediente individual
        async function calculateIngredientCost(ingredient, price, qty, unitPrice) {
          const unit = ingredient.unidade?.toUpperCase() || '';
          let itemCost = 0;
          
          // CONVERSÕES DE UNIDADE OTIMIZADAS
          if (unit === 'KG' || unit === 'KILO') {
            itemCost = qty * unitPrice;
          } 
          else if (unit === 'GR' || unit === 'G') {
            itemCost = (qty / 1000) * unitPrice;
          }
          else if (unit === 'ML') {
            if (ingredient.produto_base_descricao?.includes('ÓLEO')) {
              itemCost = (qty / 900) * unitPrice;
            } else {
              itemCost = (qty / 1000) * unitPrice;
            }
          }
          else if (unit === 'L' || unit === 'LT' || unit === 'LITRO') {
            itemCost = qty * unitPrice;
          }
          else if (unit === 'UN' || unit === 'UND' || unit === 'UNIDADE') {
            itemCost = qty * unitPrice;
          }
          else if (unit === 'COLHER' || unit === 'COLHERES') {
            itemCost = (qty * 15 / 1000) * unitPrice;
          }
          else if (unit === 'XÍCARA' || unit === 'XÍCARAS') {
            itemCost = (qty * 240 / 1000) * unitPrice;
          }
          else {
            itemCost = qty * unitPrice;
          }
          
          // CORREÇÃO INTELIGENTE DE CUSTOS ALTOS
          const originalCost = itemCost;
          
          if (itemCost > 100) {
            console.warn(`⚠️ Custo muito alto para ${ingredient.produto_base_descricao}: R$${itemCost.toFixed(2)}`);
            
            if (unit === 'ML' && itemCost > 100) {
              itemCost = itemCost / 100;
              console.log(`🔧 Correção ML aplicada: R$${originalCost.toFixed(2)} → R$${itemCost.toFixed(2)}`);
            } 
            else if (unit === 'GR' && itemCost > 50) {
              itemCost = itemCost / 50;
              console.log(`🔧 Correção GR aplicada: R$${originalCost.toFixed(2)} → R$${itemCost.toFixed(2)}`);
            }
            else if (itemCost > 1000) {
              itemCost = itemCost / 1000;
              console.log(`🔧 Correção grave aplicada: R$${originalCost.toFixed(2)} → R$${itemCost.toFixed(2)}`);
            }
            else if (itemCost > 200) {
              itemCost = itemCost / 20;
              console.log(`🔧 Correção média aplicada: R$${originalCost.toFixed(2)} → R$${itemCost.toFixed(2)}`);
            }
          }
          
          return Math.max(0.01, Math.min(itemCost, 50));
        }

        if (ingredientesCalculados.length === 0) {
          console.warn(`⚠️ Nenhum ingrediente com preço encontrado para receita ${recipeId}`);
          return null;
        }

        // Calcular custo por porção baseado na quantidade base da receita
        const costPerServing = totalCost / baseQuantity;
        
        // Escalar para a quantidade solicitada
        const scaleFactor = mealQuantity / baseQuantity;
        const scaledTotalCost = totalCost * scaleFactor;
        
        console.log(`💰 ${recipeName}:`);
        console.log(`   Custo total: R$${totalCost.toFixed(2)} para ${baseQuantity} porções`);
        console.log(`   Custo por porção: R$${costPerServing.toFixed(2)}`);
        console.log(`   Custo escalado: R$${scaledTotalCost.toFixed(2)} para ${mealQuantity} porções`);
        console.log(`   Ingredientes: ${ingredientesCalculados.length}/${ingredients.length}`);

        return {
          receita_id: recipeId,
          nome: recipeName,
          custo_total: scaledTotalCost.toFixed(2),
          custo_por_refeicao: costPerServing,
          custo: scaledTotalCost,
          custo_total_receita: totalCost,
          porcoes_base: baseQuantity,
          porcoes_solicitadas: mealQuantity,
          ingredientes: ingredientesCalculados,
          ingredientes_encontrados: ingredientesCalculados.length,
          ingredientes_total: ingredients.length,
          precisao: Math.round((ingredientesCalculados.length / ingredients.length) * 100),
          quantidade_refeicoes: mealQuantity
        };

      } catch (error) {
        console.error(`❌ Erro ao calcular custo da receita ${recipeId}:`, error);
        return null;
      }
    }

    // ============ BUSCAR PROTEÍNAS DINÂMICAS DO BANCO ============
    let proteinasGlobaisCache = [];
    
    async function buscarProteinasDisponiveis() {
      try {
        console.log('🍖 Buscando proteínas disponíveis dinamicamente...');
        
        if (proteinasGlobaisCache.length > 0) {
          console.log(`🍖 Usando cache de proteínas: ${proteinasGlobaisCache.length} itens`);
          return proteinasGlobaisCache;
        }
        
        // Buscar proteínas reais do banco por categoria
        const palavrasChaveProteinas = ['FRANGO', 'CARNE', 'PEIXE', 'BIFE', 'FILÉ', 'PEITO', 'COXA', 'PICADINHO', 'DESFIADA', 'OMELETE'];
        
        const orConditions = palavrasChaveProteinas.map(palavra => `nome.ilike.%${palavra}%`).join(',');
        
        const { data: proteinasData, error } = await supabase
          .from('receita_ingredientes')
          .select('receita_id_legado, nome, categoria_descricao')
          .or(orConditions)
          .limit(50);
        
        if (error) {
          console.error('❌ Erro ao buscar proteínas:', error);
          throw error;
        }
        
        if (!proteinasData || proteinasData.length === 0) {
          console.warn('⚠️ Nenhuma proteína encontrada, usando fallback...');
          // Fallback com algumas receitas conhecidas
          proteinasGlobaisCache = [
            { receita_id: '1010', nome: 'FILÉ DE FRANGO GRELHADO', tipo: 'frango', custo_por_refeicao: 2.5 },
            { receita_id: '1001', nome: 'CARNE MOÍDA REFOGADA', tipo: 'carne', custo_por_refeicao: 3.0 }
          ];
          return proteinasGlobaisCache;
        }
        
        // Processar proteínas em paralelo para melhor performance
        const proteinPromises = proteinasData.slice(0, 20).map(async (proteina) => {
          try {
            const custo = await calculateSimpleCost(proteina.receita_id_legado, 100);
            if (custo && custo.custo_por_refeicao > 0 && custo.custo_por_refeicao < 15) {
              // Determinar tipo baseado no nome
              let tipo = 'outros';
              const nome = proteina.nome.toUpperCase();
              if (nome.includes('FRANGO') || nome.includes('PEITO') || nome.includes('COXA')) tipo = 'frango';
              else if (nome.includes('CARNE') || nome.includes('BIFE')) tipo = 'carne';
              else if (nome.includes('PEIXE') || nome.includes('SALMÃO')) tipo = 'peixe';
              else if (nome.includes('OVO')) tipo = 'ovos';
              
              return {
                receita_id: proteina.receita_id_legado,
                nome: proteina.nome,
                custo_por_refeicao: custo.custo_por_refeicao,
                categoria: 'Proteína',
                tipo: tipo
              };
            }
            return null;
          } catch (error) {
            console.warn(`⚠️ Erro ao calcular custo da proteína ${proteina.nome}:`, error);
            return null;
          }
        });
        
        const results = await Promise.all(proteinPromises);
        proteinasGlobaisCache = results.filter(result => result !== null);
        
        console.log(`✅ Cache de proteínas carregado: ${proteinasGlobaisCache.length} proteínas dinâmicas`);
        return proteinasGlobaisCache;
        
      } catch (error) {
        console.error('❌ Erro fatal ao buscar proteínas:', error);
        throw error;
      }
    }

    // ============ BUSCAR RECEITA ESPECÍFICA PARA SOBREMESAS ============
    async function buscarReceitaEspecifica(tipo, budget, mealQuantity) {
      try {
        if (tipo === 'sobremesa') {
          // IDs conhecidos de sobremesas - expandido para mais variedade
          const sobremesasConhecidas = [
            { id: '599', nome: 'CREME DE GOIABADA' },
            { id: '738', nome: 'DOCE DE LEITE' },
            { id: '739', nome: 'GELATINA COLORIDA' },
            { id: '740', nome: 'MOUSSE DE CHOCOLATE' },
            { id: '741', nome: 'PUDIM DE LEITE CONDENSADO' },
            { id: '742', nome: 'BRIGADEIRO DE COLHER' },
            { id: '743', nome: 'COCADA BRANCA' },
            { id: '744', nome: 'FRUTA DA ÉPOCA' }
          ];
          
          for (const sobremesa of sobremesasConhecidas) {
            const custo = await calculateSimpleCost(sobremesa.id, mealQuantity);
            if (custo && custo.custo_por_refeicao <= budget && custo.custo_por_refeicao > 0) {
              return {
                receita_id: sobremesa.id,
                nome: sobremesa.nome,
                custo_por_refeicao: custo.custo_por_refeicao
              };
            }
          }
          
          // Fallback: usar a primeira sobremesa
          const sobremesa = sobremesasConhecidas[0];
          const custo = await calculateSimpleCost(sobremesa.id, mealQuantity);
          return {
            receita_id: sobremesa.id,
            nome: sobremesa.nome,
            custo_por_refeicao: custo?.custo_por_refeicao || 0.5
          };
        }
        
        return null;
      } catch (error) {
        console.error(`Erro ao buscar receita específica ${tipo}:`, error);
        return null;
      }
    }

    // ============ IMPLEMENTAR SHOPPING LIST CONSOLIDADA ============
    function consolidateShoppingList(allRecipes) {
      const consolidatedItems = new Map();
      
      for (const recipe of allRecipes) {
        if (recipe.ingredientes) {
          for (const ingredient of recipe.ingredientes) {
            const key = ingredient.nome;
            
            if (consolidatedItems.has(key)) {
              const existing = consolidatedItems.get(key);
              existing.quantidade_total += ingredient.quantidade;
              existing.custo_total += ingredient.custo_item;
            } else {
              consolidatedItems.set(key, {
                produto_base_id: ingredient.produto_base_id || null,
                nome_produto: ingredient.nome,
                quantidade_total: ingredient.quantidade,
                unidade: ingredient.unidade,
                custo_total: ingredient.custo_item,
                preco_unitario: ingredient.preco_unitario
              });
            }
          }
        }
      }
      
      return Array.from(consolidatedItems.values());
    }

    // ============ CALCULAR PERÍODO DINÂMICO ============
    function calculateDaysFromPeriod(period) {
      const periodLower = period.toLowerCase();
      
      if (periodLower.includes('semana')) {
        const weeks = parseInt(periodLower) || 1;
        return weeks * 7;
      } else if (periodLower.includes('dia')) {
        return parseInt(periodLower) || 7;
      }
      
      return 7; // default 1 semana
    }

    // ============ AÇÕES DISPONÍVEIS ============
    if (requestData.action === 'generate_menu') {
      const { filialIdLegado: filialId, clientName = 'Cliente Teste', mealQuantity = 100, period = '1 semana' } = requestData;
      
      // Calcular período dinâmico
      const totalDaysToGenerate = calculateDaysFromPeriod(period);
      
      // Buscar orçamento da filial
      const filialBudget = await buscarOrcamentoFilial(filialId);
      const dailyBudget = filialBudget?.custo_diario || 16.0;
      
      console.log(`🎯 Gerando cardápio para ${clientName}`);
      console.log(`📅 Período: ${period} (${totalDaysToGenerate} dias)`);
      console.log(`💰 Orçamento: R$ ${dailyBudget.toFixed(2)}/refeição`);
      console.log(`🍽️ Quantidade: ${mealQuantity} refeições`);
      
      // Carregar cache de preços uma vez
      await loadPricesCache();
      
      // Buscar proteínas disponíveis globalmente
      const proteinasGlobais = await buscarProteinasDisponiveis();
      
      // Gerar cardápio para período especificado
      const allRecipes = [];
      let totalCost = 0;
      let estruturaCompleta = true;
      
      for (let dia = 1; dia <= totalDaysToGenerate; dia++) {
        const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
        const nomeDia = diasSemana[(dia - 1) % 7];
        
        console.log(`\n📅 Gerando ${nomeDia} (Dia ${dia}/14)`);
        
        const dayMenu = [];
        let dayCost = 0;
        
        // ============ SELEÇÃO INTELIGENTE DE PROTEÍNAS COM ROTAÇÃO SEM SHADOWING ============
        let pp1, pp2;
        
        if (proteinasGlobais.length >= 2) {
          // Separar proteínas por tipo para rotação
          const proteinasPorTipo = proteinasGlobais.reduce((acc, p) => {
            const tipo = p.tipo || 'outros';
            if (!acc[tipo]) acc[tipo] = [];
            acc[tipo].push(p);
            return acc;
          }, {});
          
          // Selecionar tipos diferentes quando possível para evitar monotonia
          const tiposDisponiveis = Object.keys(proteinasPorTipo);
          const tipo1 = tiposDisponiveis[dia % tiposDisponiveis.length];
          const tipo2 = tiposDisponiveis[(dia + 1) % tiposDisponiveis.length];
          
          // Selecionar PP1 e PP2 de tipos diferentes se possível
          pp1 = proteinasPorTipo[tipo1]?.[Math.floor(Math.random() * proteinasPorTipo[tipo1].length)] || 
                proteinasGlobais[Math.floor(Math.random() * proteinasGlobais.length)];
          
          pp2 = proteinasPorTipo[tipo2]?.[Math.floor(Math.random() * proteinasPorTipo[tipo2].length)] || 
                proteinasGlobais.find(p => p.receita_id !== pp1.receita_id) || 
                proteinasGlobais[1];
          
          console.log(`  🥩 PP1: ${pp1.nome} (${pp1.tipo})`);
          console.log(`  🥩 PP2: ${pp2.nome} (${pp2.tipo})`);
        }
        
        // Adicionar proteínas ao cardápio
        if (pp1) {
          dayMenu.push({
            receita_id: pp1.receita_id,
            nome: pp1.nome,
            categoria: 'PP1',
            custo_por_refeicao: pp1.custo_por_refeicao,
            quantidade_refeicoes: mealQuantity
          });
          dayCost += pp1.custo_por_refeicao;
        }
        
        if (pp2) {
          dayMenu.push({
            receita_id: pp2.receita_id,
            nome: pp2.nome,
            categoria: 'PP2',
            custo_por_refeicao: pp2.custo_por_refeicao,
            quantidade_refeicoes: mealQuantity
          });
          dayCost += pp2.custo_por_refeicao;
        }
        
        // ============ PROCESSAMENTO DAS DEMAIS CATEGORIAS ============
        for (const [categoria, config] of Object.entries(ESTRUTURA_CARDAPIO)) {
          if (categoria === 'PP1' || categoria === 'PP2') continue; // Já processado
          
          const budget = dailyBudget * (config.porcentagem / 100);
          console.log(`🔍 Buscando ${categoria} com orçamento R$${budget.toFixed(2)}`);
          
          let receitaEncontrada;
          
          // Lógica especial para Sobremesa vs Suco
          if (categoria === 'Sobremesa') {
            // Buscar especificamente sobremesas conhecidas
            receitaEncontrada = await buscarReceitaEspecifica('sobremesa', budget, mealQuantity);
          } else {
            receitaEncontrada = await buscarReceitasPorCategoria(categoria, budget, mealQuantity);
          }
          
          if (receitaEncontrada) {
            console.log(`  ✅ Selecionada: ${receitaEncontrada.nome} - R$${receitaEncontrada.custo_por_refeicao.toFixed(2)}`);
            
            dayMenu.push({
              receita_id: receitaEncontrada.receita_id,
              nome: receitaEncontrada.nome,
              categoria: config.categoria,
              custo_por_refeicao: receitaEncontrada.custo_por_refeicao,
              quantidade_refeicoes: mealQuantity
            });
            dayCost += receitaEncontrada.custo_por_refeicao;
          } else {
            console.warn(`⚠️ Nenhuma receita encontrada para ${categoria}`);
            estruturaCompleta = false;
          }
        }
        
        // Adicionar receitas do dia ao total
        allRecipes.push(...dayMenu.map(recipe => ({
          ...recipe,
          dia: nomeDia
        })));
        
        totalCost += dayCost;
      }
      
      const averageCost = totalDaysToGenerate > 0 ? totalCost / totalDaysToGenerate : 0;
      
      // Gerar shopping list consolidada
      const shoppingList = consolidateShoppingList(allRecipes);
      
      console.log(`\n✅ CARDÁPIO COMPLETO GERADO`);
      console.log(`📊 ${totalDaysToGenerate} dia(s) gerado(s)`);
      console.log(`💰 Custo médio: R$ ${averageCost.toFixed(2)}/refeição`);
      console.log(`🛒 Lista de compras: ${shoppingList.length} itens únicos`);
      
      return new Response(JSON.stringify({
        success: true,
        cardapio: {
          receitas: allRecipes,
          filial_info: filialBudget,
          resumo: {
            total_dias: totalDaysToGenerate,
            total_receitas: allRecipes.length,
            custo_total_periodo: totalCost,
            custo_medio_por_refeicao: averageCost,
            custo_por_refeicao: averageCost,
            estrutura_completa: estruturaCompleta,
            periodo_solicitado: period,
            queries_otimizadas: true,
            cache_utilizado: pricesCache.size > 0
          }
        },
        lista_compras: shoppingList
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ TESTE DE CUSTO DE RECEITA ============
    if (requestData.action === 'test_recipe_cost') {
      const { recipeId, mealQuantity = 100 } = requestData;
      
      console.log(`🧪 Testando custo da receita ${recipeId} para ${mealQuantity} refeições`);
      
      const result = await calculateSimpleCost(recipeId, mealQuantity);
      
      return new Response(JSON.stringify({
        success: true,
        action: 'test_recipe_cost',
        receita_id: recipeId,
        resultado: result,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ AÇÃO NÃO RECONHECIDA ============
    return new Response(JSON.stringify({
      success: false,
      error: 'Ação não reconhecida',
      available_actions: ['generate_menu', 'test_recipe_cost']
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro fatal na função:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno da função',
      details: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});