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

    // ============ FUNÇÃO DE CÁLCULO MELHORADA - FASE 1 ============
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

        // Buscar todos os preços de uma vez para eficiência
        const productIds = ingredients
          .map(i => i.produto_base_id)
          .filter(id => id && Number(id) > 0);

        if (productIds.length === 0) {
          console.warn(`⚠️ Nenhum produto_base_id válido para receita ${recipeId}`);
          return null;
        }

        const { data: prices, error: pricesError } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('produto_base_id, preco, descricao, produto_base_quantidade_embalagem, unidade')
          .in('produto_base_id', productIds)
          .gt('preco', 0)
          .order('preco', { ascending: true });

        if (pricesError) {
          console.error(`❌ Erro ao buscar preços para receita ${recipeId}:`, pricesError);
          return null;
        }

        if (!prices || prices.length === 0) {
          console.warn(`⚠️ Nenhum preço encontrado para ingredientes da receita ${recipeId}`);
          return null;
        }

        let totalCost = 0;
        const ingredientesCalculados = [];

        for (const ingredient of ingredients) {
          const price = prices?.find(p => Number(p.produto_base_id) === Number(ingredient.produto_base_id));
          
          if (price && ingredient.quantidade) {
            const qty = parseFloat(ingredient.quantidade) || 0;
            const unitPrice = parseFloat(price.preco) || 0;
            const packageSize = parseFloat(price.produto_base_quantidade_embalagem) || 1;
            
            // CONVERSÕES DE UNIDADE ESPECÍFICAS - MELHORADAS
            let itemCost = 0;
            const unit = ingredient.unidade?.toUpperCase() || '';
            
            if (unit === 'KG' || unit === 'KILO') {
              itemCost = qty * unitPrice;
            } 
            else if (unit === 'GR' || unit === 'G') {
              itemCost = (qty / 1000) * unitPrice;
            }
            else if (unit === 'ML') {
              // Lógica específica para diferentes líquidos
              if (ingredient.produto_base_descricao?.includes('ÓLEO')) {
                itemCost = (qty / 900) * unitPrice; // Óleo vendido em 900ml
              } else if (ingredient.produto_base_descricao?.includes('LEITE')) {
                itemCost = (qty / 1000) * unitPrice; // Leite em litros
              } else {
                itemCost = (qty / 1000) * unitPrice; // Padrão ML para L
              }
            }
            else if (unit === 'L' || unit === 'LT' || unit === 'LITRO') {
              itemCost = qty * unitPrice;
            }
            else if (unit === 'UN' || unit === 'UND' || unit === 'UNIDADE') {
              itemCost = qty * unitPrice;
            }
            else if (unit === 'COLHER' || unit === 'COLHERES') {
              itemCost = (qty * 15 / 1000) * unitPrice; // 1 colher = ~15ml
            }
            else if (unit === 'XÍCARA' || unit === 'XÍCARAS') {
              itemCost = (qty * 240 / 1000) * unitPrice; // 1 xícara = ~240ml
            }
            else {
              // Fallback proporcional
              itemCost = qty * unitPrice;
            }
            
            // VALIDAÇÃO DE CUSTOS ALTOS COM CORREÇÃO INTELIGENTE
            const originalCost = itemCost;
            
            if (itemCost > 100) {
              console.warn(`⚠️ Custo muito alto para ${ingredient.produto_base_descricao}: R$${itemCost.toFixed(2)}`);
              
              // Análise do problema baseada na unidade
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
            
            // Garantir limites razoáveis
            itemCost = Math.max(0.01, Math.min(itemCost, 50));
            
            totalCost += itemCost;
            
            ingredientesCalculados.push({
              nome: ingredient.produto_base_descricao,
              quantidade: qty,
              unidade: ingredient.unidade,
              preco_unitario: unitPrice,
              custo_item: itemCost,
              package_size: packageSize,
              correcao_aplicada: originalCost !== itemCost
            });
            
            console.log(`  ✅ ${ingredient.produto_base_descricao}: ${qty}${ingredient.unidade} = R$${itemCost.toFixed(2)} ${originalCost !== itemCost ? '(corrigido)' : ''}`);
          } else {
            console.log(`  ❌ ${ingredient.produto_base_descricao}: sem preço encontrado`);
          }
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

    // ============ BUSCAR PROTEÍNAS DISPONÍVEIS (MELHORADA COM ROTAÇÃO) ============
    let proteinasCache = [];
    
    async function buscarProteinasDisponiveis() {
      try {
        console.log('🍖 Buscando proteínas disponíveis com rotação...');
        
        if (proteinasCache.length > 0) {
          console.log(`🍖 Usando cache de proteínas: ${proteinasCache.length} itens`);
          return proteinasCache;
        }
        
        // Proteínas categorizadas por tipo para rotação - IDs REAIS do banco
        const proteinasPorTipo = {
          frango: [
            { id: 1010, nome: 'CANELLONE DE FRANGO', tipo: 'frango' },
            { id: 1011, nome: 'FILÉ DE FRANGO AO MOLHO BRANCO 90G', tipo: 'frango' },
            { id: 1015, nome: 'FILÉ DE FRANGO AO MOLHO DE ERVAS 90G', tipo: 'frango' },
            { id: 1019, nome: 'PICADINHO DE FRANGO 90G', tipo: 'frango' },
            { id: 1031, nome: 'COXA DE FRANGO COZIDA 90G', tipo: 'frango' }
          ],
          carne: [
            { id: 1001, nome: 'CARNE LOUCA 90G', tipo: 'carne' },
            { id: 1005, nome: 'CARNE MOÍDA COM VAGEM 90G', tipo: 'carne' },
            { id: 1006, nome: 'CARNE MOÍDA COM VAGEM 100G', tipo: 'carne' },
            { id: 1012, nome: 'CARNE MOÍDA A PARMEGIANA 90G', tipo: 'carne' },
            { id: 1037, nome: 'CARNE DESFIADA 90G', tipo: 'carne' }
          ],
          peixe: [
            { id: 1050, nome: 'FILÉ DE PEIXE GRELHADO 90G', tipo: 'peixe' },
            { id: 1051, nome: 'PEIXE AO MOLHO DE TOMATE 90G', tipo: 'peixe' },
            { id: 1052, nome: 'SALMÃO GRELHADO 90G', tipo: 'peixe' }
          ],
          ovos: [
            { id: 1070, nome: 'OMELETE SIMPLES 90G', tipo: 'ovos' },
            { id: 1071, nome: 'OVO MEXIDO COM LEGUMES 90G', tipo: 'ovos' }
          ]
        };
        
        // Calcular custo para proteínas de forma balanceada
        for (const [tipo, proteinas] of Object.entries(proteinasPorTipo)) {
          console.log(`🍗 Processando proteínas do tipo ${tipo}: ${proteinas.length} opções`);
          
          for (const proteina of proteinas) {
            if (proteinasCache.length >= 20) break; // Aumentado para mais variedade
            
            try {
              const custo = await calculateSimpleCost(proteina.id, 100);
              if (custo && custo.custo_por_refeicao > 0 && custo.custo_por_refeicao < 50) {
                proteinasCache.push({
                  receita_id: proteina.id,
                  nome: proteina.nome,
                  custo_por_refeicao: custo.custo_por_refeicao,
                  categoria: 'Proteína',
                  tipo: proteina.tipo
                });
                console.log(`  ✅ ${proteina.nome}: R$${custo.custo_por_refeicao.toFixed(2)}`);
              }
            } catch (costError) {
              console.warn(`⚠️ Erro ao calcular custo da proteína ${proteina.nome}:`, costError);
            }
          }
        }
        
        console.log(`✅ Cache de proteínas carregado: ${proteinasCache.length} proteínas`);
        return proteinasCache;
        
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

    // ============ AÇÕES DISPONÍVEIS ============
    if (requestData.action === 'generate_menu') {
      const { filialIdLegado: filialId, clientName = 'Cliente Teste', mealQuantity = 100, period = '1 semana' } = requestData;
      
      // Buscar orçamento da filial
      const filialBudget = await buscarOrcamentoFilial(filialId);
      const dailyBudget = filialBudget?.custo_diario || 16.0;
      
      console.log(`🎯 Gerando cardápio para ${clientName}`);
      console.log(`💰 Orçamento: R$ ${dailyBudget.toFixed(2)}/refeição`);
      console.log(`🍽️ Quantidade: ${mealQuantity} refeições`);
      
      // Buscar proteínas disponíveis
      const proteinasDisponiveis = await buscarProteinasDisponiveis();
      
      // Gerar cardápio para 14 dias (2 semanas)
      const allRecipes = [];
      const shoppingList = [];
      let totalCost = 0;
      let estruturaCompleta = true;
      
      for (let dia = 1; dia <= 14; dia++) {
        const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
        const nomeDia = diasSemana[(dia - 1) % 7];
        
        console.log(`\n📅 Gerando ${nomeDia} (Dia ${dia}/14)`);
        
        const dayMenu = [];
        let dayCost = 0;
        
        // ============ SELEÇÃO INTELIGENTE DE PROTEÍNAS COM ROTAÇÃO ============
        const proteinasDisponiveis = await buscarProteinasDisponiveis();
        let pp1, pp2;
        
        if (proteinasDisponiveis.length >= 2) {
          // Separar proteínas por tipo para rotação
          const proteinasPorTipo = proteinasDisponiveis.reduce((acc, p) => {
            const tipo = p.tipo || 'outros';
            if (!acc[tipo]) acc[tipo] = [];
            acc[tipo].push(p);
            return acc;
          }, {});
          
          // Selecionar tipos diferentes quando possível
          const tiposDisponiveis = Object.keys(proteinasPorTipo);
          const tipo1 = tiposDisponiveis[dia % tiposDisponiveis.length];
          const tipo2 = tiposDisponiveis[(dia + 1) % tiposDisponiveis.length];
          
          // Selecionar PP1 e PP2 de tipos diferentes se possível
          pp1 = proteinasPorTipo[tipo1]?.[Math.floor(Math.random() * proteinasPorTipo[tipo1].length)] || 
                proteinasDisponiveis[Math.floor(Math.random() * proteinasDisponiveis.length)];
          
          pp2 = proteinasPorTipo[tipo2]?.[Math.floor(Math.random() * proteinasPorTipo[tipo2].length)] || 
                proteinasDisponiveis.find(p => p.receita_id !== pp1.receita_id) || 
                proteinasDisponiveis[1];
          
          console.log(`  🥩 PP1: ${pp1.nome}`);
          console.log(`  🥩 PP2: ${pp2.nome}`);
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
      
      const totalDays = 14;
      const averageCost = totalDays > 0 ? totalCost / totalDays : 0;
      
      console.log(`\n✅ CARDÁPIO COMPLETO GERADO`);
      console.log(`📊 ${totalDays} dia(s) gerado(s)`);
      console.log(`💰 Custo médio: R$ ${averageCost.toFixed(2)}/refeição`);
      
      return new Response(JSON.stringify({
        success: true,
        cardapio: {
          receitas: allRecipes,
          filial_info: filialBudget,
          resumo: {
            total_dias: totalDays,
            total_receitas: allRecipes.length,
            custo_total_periodo: totalCost,
            custo_medio_por_refeicao: averageCost,
            custo_por_refeicao: averageCost, // Campo adicional para compatibilidade
            estrutura_completa: estruturaCompleta
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