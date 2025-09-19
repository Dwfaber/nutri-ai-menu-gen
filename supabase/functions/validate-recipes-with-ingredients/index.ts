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

    // Função para identificar tipo de proteína
    function getProteinType(recipeName: string): string {
      const name = recipeName.toLowerCase();
      if (name.includes('frango') || name.includes('peito') || name.includes('coxa') || name.includes('sobrecoxa') || name.includes('asa')) {
        return 'frango';
      }
      if (name.includes('boi') || name.includes('carne') || name.includes('patinho') || name.includes('alcatra') || name.includes('maminha') || name.includes('picanha') || name.includes('contra filé') || name.includes('cupim')) {
        return 'bovina';
      }
      if (name.includes('porco') || name.includes('suíno') || name.includes('lombo') || name.includes('costeleta') || name.includes('linguiça') || name.includes('bacon')) {
        return 'suína';
      }
      if (name.includes('peixe') || name.includes('pescado') || name.includes('tilápia') || name.includes('salmão') || name.includes('sardinha')) {
        return 'peixe';
      }
      if (name.includes('ovo') || name.includes('mexido') || name.includes('cozido') || name.includes('frito')) {
        return 'ovo';
      }
      return 'outros';
    }

    // Função para selecionar receita com controle de variedade
    function selecionarReceitaComVariedade(receitasDisponiveis: any[], categoria: string, receitasUsadas: Set<string>, receitasDoDia: any[], budgetPerMeal?: number): any {
      console.log(`🎯 Selecionando receita para ${categoria}, disponíveis: ${receitasDisponiveis.length}`);
      
      // Filtrar receitas já usadas na semana
      let candidatas = receitasDisponiveis.filter(receita => !receitasUsadas.has(receita.id));
      
      // Se todas foram usadas, usar todas novamente
      if (candidatas.length === 0) {
        candidatas = [...receitasDisponiveis];
        console.log(`♻️ Todas as receitas de ${categoria} já foram usadas, reiniciando pool`);
      }

      // Aplicar filtro de orçamento se especificado
      if (budgetPerMeal) {
        const custoMaximoCategoria = getCustoMaximoCategoria(categoria, budgetPerMeal);
        const candidatasDentroOrcamento = candidatas.filter(receita => {
          const custoEstimado = getCustoEstimado(categoria);
          return custoEstimado <= custoMaximoCategoria;
        });
        
        if (candidatasDentroOrcamento.length > 0) {
          candidatas = candidatasDentroOrcamento;
        }
      }

      // Controle especial para proteínas para evitar repetição no mesmo dia
      if (categoria === 'Prato Principal 1' || categoria === 'Prato Principal 2') {
        const proteinaOposta = categoria === 'Prato Principal 1' ? 'Prato Principal 2' : 'Prato Principal 1';
        const proteinaOpostaDoMesmodia = receitasDoDia.find(r => r.category === proteinaOposta);
        
        if (proteinaOpostaDoMesmodia) {
          const tipoProteinaOposta = getProteinType(proteinaOpostaDoMesmodia.name);
          console.log(`🥩 Proteína oposta: ${proteinaOpostaDoMesmodia.name} (tipo: ${tipoProteinaOposta})`);
          
          // Filtrar para evitar mesmo tipo de proteína
          const candidatasDiferentesTipo = candidatas.filter(receita => {
            const tipo = getProteinType(receita.nome);
            return tipo !== tipoProteinaOposta;
          });
          
          if (candidatasDiferentesTipo.length > 0) {
            candidatas = candidatasDiferentesTipo;
            console.log(`✅ Filtrado para tipo diferente de proteína: ${candidatas.length} opções`);
          } else {
            console.log(`⚠️ Não foi possível evitar repetição de tipo de proteína`);
          }
        }
      }

      // Controle especial para saladas para evitar repetição
      if (categoria === 'Salada 1' || categoria === 'Salada 2') {
        const saladaOposta = categoria === 'Salada 1' ? 'Salada 2' : 'Salada 1';
        const saladaOpostaDoMesmoDia = receitasDoDia.find(r => r.category === saladaOposta);
        
        if (saladaOpostaDoMesmoDia) {
          console.log(`🥗 Salada oposta: ${saladaOpostaDoMesmoDia.name}`);
          
          // Filtrar para evitar salada idêntica no mesmo dia
          const candidatasDiferentes = candidatas.filter(receita => 
            receita.nome.toLowerCase() !== saladaOpostaDoMesmoDia.name.toLowerCase()
          );
          
          if (candidatasDiferentes.length > 0) {
            candidatas = candidatasDiferentes;
            console.log(`✅ Filtrado para salada diferente: ${candidatas.length} opções`);
          }
        }
      }

      // Selecionar aleatoriamente da lista filtrada
      const receitaSelecionada = candidatas[Math.floor(Math.random() * candidatas.length)];
      console.log(`✅ Selecionada: ${receitaSelecionada.nome} para ${categoria}`);
      
      return receitaSelecionada;
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

      // Controle de variedade - rastrear receitas usadas na semana
      const receitasUsadas = new Set<string>();

      // Gerar cardápio semanal (5 ou 7 dias dependendo da configuração)
      const diasSemana = includeWeekends 
        ? ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
        : ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
      const cardapioSemanal = [];

      for (const dia of diasSemana) {
        console.log(`📅 Gerando cardápio para ${dia}`);
        const receitasDia = [];

        // Selecionar uma receita de cada categoria (ou fallback se não houver)
        for (const categoria of categorias) {
          const receitasDisponiveis = receitasPorCategoria[categoria];
          
          if (receitasDisponiveis && receitasDisponiveis.length > 0) {
            // Usar seleção inteligente com controle de variedade
            const receitaSelecionada = selecionarReceitaComVariedade(
              receitasDisponiveis, 
              categoria, 
              receitasUsadas, 
              receitasDia, 
              budgetPerMeal
            );
            
            // Marcar receita como usada
            receitasUsadas.add(receitaSelecionada.id);
            
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
              console.log(`⚠️ Usando fallback para ${categoria}: ${fallback.nome}`);
              
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
            } else {
              console.error(`❌ Sem fallback para categoria ${categoria}`);
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

        // Validação pós-geração do dia
        const pp1 = receitasDia.find(r => r.category === 'Prato Principal 1');
        const pp2 = receitasDia.find(r => r.category === 'Prato Principal 2');
        
        if (pp1 && pp2) {
          const tipo1 = getProteinType(pp1.name);
          const tipo2 = getProteinType(pp2.name);
          if (tipo1 === tipo2 && tipo1 !== 'outros') {
            console.log(`⚠️ ${dia}: Dois ${tipo1} no mesmo dia (${pp1.name} e ${pp2.name})`);
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
    }

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