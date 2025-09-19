import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar receitas que têm ingredientes por categoria
    async function buscarReceitasComIngredientes(categoria: string): Promise<any[]> {
      try {
        console.log(`🔍 Buscando receitas para categoria: ${categoria}`);
        
        // Buscar receitas que têm ingredientes na tabela receita_ingredientes
        const { data: receitasComIngredientes, error } = await supabase
          .from('receita_ingredientes')
          .select(`
            receita_id_legado,
            nome,
            categoria_descricao,
            produto_base_id
          `)
          .eq('categoria_descricao', categoria)
          .not('produto_base_id', 'is', null)
          .order('receita_id_legado');

        if (error) {
          console.error(`❌ Erro ao buscar receitas para ${categoria}:`, error);
          return [];
        }

        // Agrupar por receita_id_legado para evitar duplicatas
        const receitasUnicas = new Map();
        receitasComIngredientes?.forEach(r => {
          if (!receitasUnicas.has(r.receita_id_legado)) {
            receitasUnicas.set(r.receita_id_legado, {
              id: r.receita_id_legado,
              nome: r.nome,
              categoria: r.categoria_descricao
            });
          }
        });

        const receitas = Array.from(receitasUnicas.values());
        console.log(`✅ ${categoria}: ${receitas.length} receitas com ingredientes encontradas`);
        return receitas;
      } catch (error) {
        console.error(`❌ Erro ao buscar receitas com ingredientes para ${categoria}:`, error);
        return [];
      }
    }

    // Gerar cardápio usando apenas receitas com ingredientes
    async function gerarCardapioValidado(proteinConfig = {}, includeWeekends = false, budgetPerMeal = null) {
      const categorias = [
        'Prato Principal 1',
        'Prato Principal 2', 
        'Arroz Branco',
        'Feijão',
        'Guarnição',
        'Salada 1',
        'Salada 2',
        'Suco 1',
        'Suco 2',
        'Sobremesa'
      ];

      const receitasPorCategoria = {};
      
      // Buscar receitas para cada categoria
      for (const categoria of categorias) {
        receitasPorCategoria[categoria] = await buscarReceitasComIngredientes(categoria);
      }

      // Gerar cardápio semanal (5 ou 7 dias dependendo da configuração)
      const diasSemana = includeWeekends 
        ? ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
        : ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
      const cardapioSemanal = [];

      for (const dia of diasSemana) {
        const receitasDia = [];

        // Selecionar uma receita de cada categoria (ou fallback se não houver)
        for (const categoria of categorias) {
          const receitasDisponiveis = receitasPorCategoria[categoria];
          
          if (receitasDisponiveis && receitasDisponiveis.length > 0) {
            // Filtrar receitas por orçamento se especificado
            let receitasFiltradas = receitasDisponiveis;
            if (budgetPerMeal) {
              const custoMaximoCategoria = getCustoMaximoCategoria(categoria, budgetPerMeal);
              receitasFiltradas = receitasDisponiveis.filter(receita => {
                const custoEstimado = getCustoEstimado(categoria);
                return custoEstimado <= custoMaximoCategoria;
              });
              
              // Se não houver receitas dentro do orçamento, usar as mais baratas
              if (receitasFiltradas.length === 0) {
                receitasFiltradas = receitasDisponiveis;
              }
            }
            
            // Selecionar aleatoriamente uma receita da categoria filtrada
            const receitaSelecionada = receitasFiltradas[Math.floor(Math.random() * receitasFiltradas.length)];
            
            // Aplicar gramagem das proteínas
            let displayName = receitaSelecionada.nome;
            let custoAjustado = getCustoEstimado(categoria);
            
            if (categoria === 'Prato Principal 1' && proteinConfig.protein_grams_pp1) {
              displayName = `${receitaSelecionada.nome} ${proteinConfig.protein_grams_pp1}G`;
              // Ajustar custo baseado na gramagem (100g = custo base, 90g = 10% menor)
              if (proteinConfig.protein_grams_pp1 === 90) {
                custoAjustado = custoAjustado * 0.9;
              }
            } else if (categoria === 'Prato Principal 2' && proteinConfig.protein_grams_pp2) {
              displayName = `${receitaSelecionada.nome} ${proteinConfig.protein_grams_pp2}G`;
              // Ajustar custo baseado na gramagem (100g = custo base, 90g = 10% menor)
              if (proteinConfig.protein_grams_pp2 === 90) {
                custoAjustado = custoAjustado * 0.9;
              }
            }
            
            receitasDia.push({
              id: receitaSelecionada.id,
              name: displayName,
              category: categoria,
              day: dia,
              cost: custoAjustado
            });
          } else {
            // Fallback se não houver receitas com ingredientes
            const fallback = getFallbackReceita(categoria);
            if (fallback) {
              // Aplicar gramagem nas proteínas também para fallback
              let displayName = fallback.nome;
              let custoAjustado = fallback.custo;
              
              if (categoria === 'Prato Principal 1' && proteinConfig.protein_grams_pp1) {
                displayName = `${fallback.nome} ${proteinConfig.protein_grams_pp1}G`;
                if (proteinConfig.protein_grams_pp1 === 90) {
                  custoAjustado = custoAjustado * 0.9;
                }
              } else if (categoria === 'Prato Principal 2' && proteinConfig.protein_grams_pp2) {
                displayName = `${fallback.nome} ${proteinConfig.protein_grams_pp2}G`;
                if (proteinConfig.protein_grams_pp2 === 90) {
                  custoAjustado = custoAjustado * 0.9;
                }
              }
              
              receitasDia.push({
                id: fallback.id,
                name: displayName,
                category: categoria,
                day: dia,
                cost: custoAjustado,
                warning: `⚠️ Receita fallback - categoria ${categoria} sem ingredientes`
              });
            }
          }
        }

        // Verificar se o custo total do dia está dentro do orçamento
        if (budgetPerMeal) {
          const custoTotalDia = receitasDia.reduce((sum, receita) => sum + (receita.cost || 0), 0);
          if (custoTotalDia > budgetPerMeal) {
            console.log(`⚠️ ${dia}: Custo R$ ${custoTotalDia.toFixed(2)} excede orçamento R$ ${budgetPerMeal.toFixed(2)}`);
          }
        }

        cardapioSemanal.push({
          dia,
          receitas: receitasDia
        });
      }

      return {
        cardapio_semanal: cardapioSemanal,
        resumo: {
          categorias_com_receitas: Object.keys(receitasPorCategoria).filter(cat => 
            receitasPorCategoria[cat] && receitasPorCategoria[cat].length > 0
          ).length,
          total_categorias: categorias.length,
          receitas_por_categoria: Object.fromEntries(
            Object.entries(receitasPorCategoria).map(([cat, receitas]) => [cat, receitas?.length || 0])
          )
        }
      };
    }

    function getCustoEstimado(categoria: string): number {
      const custos = {
        'Prato Principal 1': 2.50,
        'Prato Principal 2': 2.00,
        'Arroz Branco': 0.30,
        'Feijão': 0.35,
        'Guarnição': 0.80,
        'Salada 1': 0.50,
        'Salada 2': 0.60,
        'Suco 1': 0.25,
        'Suco 2': 0.25,
        'Sobremesa': 0.50
      };
      return custos[categoria] || 1.00;
    }

    function getCustoMaximoCategoria(categoria: string, budgetTotal: number): number {
      // Distribuir orçamento proporcionalmente entre categorias
      const distribuicaoOrcamento = {
        'Prato Principal 1': 0.30,  // 30% do orçamento
        'Prato Principal 2': 0.25,  // 25% do orçamento
        'Arroz Branco': 0.05,       // 5% do orçamento
        'Feijão': 0.05,             // 5% do orçamento
        'Guarnição': 0.12,          // 12% do orçamento
        'Salada 1': 0.08,           // 8% do orçamento
        'Salada 2': 0.08,           // 8% do orçamento
        'Suco 1': 0.03,             // 3% do orçamento
        'Suco 2': 0.03,             // 3% do orçamento
        'Sobremesa': 0.08           // 8% do orçamento
      };
      
      const percentual = distribuicaoOrcamento[categoria] || 0.1;
      return budgetTotal * percentual;

    function getFallbackReceita(categoria: string) {
      const fallbacks = {
        'Prato Principal 1': { id: 1201, nome: "FRANGO GRELHADO SIMPLES", custo: 2.50 },
        'Prato Principal 2': { id: 1202, nome: "OVO REFOGADO", custo: 2.00 },
        'Arroz Branco': { id: 1301, nome: "ARROZ BRANCO SIMPLES", custo: 0.30 },
        'Feijão': { id: 1302, nome: "FEIJÃO CARIOCA", custo: 0.35 },
        'Guarnição': { id: 1401, nome: "BATATA COZIDA", custo: 0.80 },
        'Salada 1': { id: 1501, nome: "SALADA MISTA", custo: 0.50 },
        'Salada 2': { id: 1502, nome: "LEGUMES COZIDOS", custo: 0.60 },
        'Suco 1': { id: 1701, nome: "SUCO NATURAL", custo: 0.25 },
        'Suco 2': { id: 1702, nome: "ÁGUA AROMATIZADA", custo: 0.25 },
        'Sobremesa': { id: 1601, nome: "FRUTA DA ESTAÇÃO", custo: 0.50 }
      };
      return fallbacks[categoria] || null;
    }

    // Processar request
    const requestData = await req.json();
    const action = requestData.action || 'generate_validated_menu';

    if (action === 'check_recipes_with_ingredients') {
      // Retornar apenas estatísticas sobre receitas com ingredientes
      const categorias = ['Prato Principal 1', 'Prato Principal 2', 'Arroz Branco', 'Feijão', 'Guarnição', 'Salada 1', 'Salada 2', 'Suco 1', 'Suco 2', 'Sobremesa'];
      const resultado = {};
      
      for (const categoria of categorias) {
        resultado[categoria] = await buscarReceitasComIngredientes(categoria);
      }

      return new Response(
        JSON.stringify({
          success: true,
          receitas_por_categoria: resultado,
          resumo: Object.fromEntries(
            Object.entries(resultado).map(([cat, receitas]) => [cat, receitas?.length || 0])
          )
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar cardápio validado por padrão
    const proteinConfig = requestData.protein_config || {};
    const includeWeekends = requestData.include_weekends || false;
    const budgetPerMeal = requestData.budgetPerMeal || null;
    const cardapioValidado = await gerarCardapioValidado(proteinConfig, includeWeekends, budgetPerMeal);

    return new Response(
      JSON.stringify({
        success: true,
        cardapio: cardapioValidado,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na validação de receitas:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});