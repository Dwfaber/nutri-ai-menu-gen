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

    // Cache de custos para evitar recálculos
    const custoCache = new Map<string, number>();

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

    // Cache para custos calculados durante a execução
    const costCache = new Map<string, number>();

    // Função para calcular custo real da receita - APENAS CÁLCULO REAL
    async function calcularCustoReal(receitaId: string): Promise<number | null> {
      const cacheKey = `cost_${receitaId}`;
      
      // Verificar cache primeiro
      if (costCache.has(cacheKey)) {
        return costCache.get(cacheKey)!;
      }

      try {
        console.log(`💰 Calculando custo real para receita ${receitaId}`);
        
        // Buscar ingredientes da receita
        const { data: ingredientes, error: ingredientesError } = await supabase
          .from('receita_ingredientes')
          .select('produto_base_id, quantidade, unidade')
          .eq('receita_id_legado', receitaId);
        
        if (ingredientesError || !ingredientes?.length) {
          console.log(`❌ PULANDO receita ${receitaId} - sem ingredientes`);
          return null; // PULAR receita - não usar fallback
        }

        // Buscar preços atuais para todos os ingredientes
        const produtoBaseIds = ingredientes.map(ing => ing.produto_base_id);
        const { data: precos, error: precosError } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('produto_base_id, preco, produto_base_quantidade_embalagem, em_promocao_sim_nao')
          .in('produto_base_id', produtoBaseIds)
          .order('criado_em', { ascending: false });

        if (precosError || !precos?.length) {
          console.log(`❌ PULANDO receita ${receitaId} - sem preços`);
          return null; // PULAR receita - não usar fallback
        }

        let custoTotal = 0;
        let ingredientesComPreco = 0;
        
        for (const ingrediente of ingredientes) {
          const preco = precos.find(p => p.produto_base_id === ingrediente.produto_base_id);
          if (preco && preco.preco > 0) {
            const quantidadeEmbalagem = preco.produto_base_quantidade_embalagem || 1000;
            const custoIngrediente = (ingrediente.quantidade / quantidadeEmbalagem) * preco.preco;
            
            // Aplicar desconto se em promoção
            const custoFinal = preco.em_promocao_sim_nao ? custoIngrediente * 0.9 : custoIngrediente;
            custoTotal += custoFinal;
            ingredientesComPreco++;
            
            console.log(`  📊 ${ingrediente.produto_base_id}: ${ingrediente.quantidade}/${quantidadeEmbalagem} * R$${preco.preco} = R$${custoFinal.toFixed(2)} ${preco.em_promocao_sim_nao ? '(PROMOÇÃO)' : ''}`);
          }
        }

        // Só aceitar se conseguiu calcular pelo menos 80% dos ingredientes
        const percentualCalculado = (ingredientesComPreco / ingredientes.length) * 100;
        if (percentualCalculado < 80) {
          console.log(`❌ PULANDO receita ${receitaId} - apenas ${percentualCalculado.toFixed(1)}% dos ingredientes têm preço`);
          return null;
        }

        // Cache do resultado
        costCache.set(cacheKey, custoTotal);
        console.log(`✅ CUSTO REAL calculado para ${receitaId}: R$ ${custoTotal.toFixed(2)} (${ingredientesComPreco}/${ingredientes.length} ingredientes)`);
        
        return custoTotal;
      } catch (error) {
        console.log(`❌ ERRO ao calcular custo real para ${receitaId}:`, error);
        return null; // PULAR receita - não usar fallback
      }
    }

    // Função para distribuir orçamento por categoria
    function getCustoMaximoCategoria(categoria: string, budgetPerMeal: number): number {
      const distribuicaoOrcamento = {
        'Prato Principal 1': 0.35,
        'Prato Principal 2': 0.30,
        'Arroz Branco': 0.08,
        'Feijão': 0.07,
        'Guarnição': 0.08,
        'Salada 1': 0.05,
        'Salada 2': 0.05,
        'Suco 1': 0.01,
        'Suco 2': 0.01
      };
      
      return budgetPerMeal * (distribuicaoOrcamento[categoria] || 0.1);
    }

    // Função para selecionar receita com controle de variedade (otimizada)
    async function selecionarReceitaComVariedade(receitasDisponiveis: any[], categoria: string, receitasUsadas: Set<string>, receitasDoDia: any[], budgetPerMeal?: number): Promise<any> {
      console.log(`🎯 Selecionando receita para ${categoria}, disponíveis: ${receitasDisponiveis.length}`);
      
      // Filtrar receitas já usadas na semana
      let candidatas = receitasDisponiveis.filter(receita => !receitasUsadas.has(receita.id));
      
      // Se todas foram usadas, usar todas novamente
      if (candidatas.length === 0) {
        candidatas = [...receitasDisponiveis];
        console.log(`♻️ Todas as receitas de ${categoria} já foram usadas, reiniciando pool`);
      }

      // Se há orçamento, aplicar filtro mais simples para evitar timeout
      if (budgetPerMeal) {
        const custoMaximoCategoria = getCustoMaximoCategoria(categoria, budgetPerMeal);
        console.log(`💰 Orçamento máximo para ${categoria}: R$ ${custoMaximoCategoria.toFixed(2)}`);
        
        // Filtrar por orçamento usando apenas receitas com custo calculável
        const candidatasDentroOrcamento = [];
        for (const receita of candidatas) {
          const custoReal = await calcularCustoReal(receita.id);
          if (custoReal !== null && custoReal <= custoMaximoCategoria) {
            candidatasDentroOrcamento.push(receita);
          }
        }
        
        if (candidatasDentroOrcamento.length > 0) {
          candidatas = candidatasDentroOrcamento;
          console.log(`💰 ${candidatasDentroOrcamento.length} receitas dentro do orçamento estimado para ${categoria}`);
        } else {
          console.log(`⚠️ Usando orçamento flexível para ${categoria}`);
          // Manter todas as candidatas se nenhuma passar no filtro
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

    // Gerar cardápio usando apenas receitas com ingredientes (otimizado)
    async function gerarCardapioValidado(proteinConfig = {}, includeWeekends = false, budgetPerMeal = null) {
      const startTime = Date.now();
      console.log('🚀 Iniciando geração de cardápio otimizada');
      
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
            const receitaSelecionada = await selecionarReceitaComVariedade(
              receitasDisponiveis, 
              categoria, 
              receitasUsadas, 
              receitasDia, 
              budgetPerMeal
            );
            
            // Marcar receita como usada
            receitasUsadas.add(receitaSelecionada.id);
            
            // Calcular custo real da receita - PULAR se não conseguir
            const custoReal = await calcularCustoReal(receitaSelecionada.id);
            if (custoReal === null) {
              console.log(`❌ PULANDO receita ${receitaSelecionada.nome} - custo não calculável`);
              continue; // Pular para próxima categoria
            }
            
            let custoAjustado = custoReal;
            console.log(`💰 Usando custo real para ${receitaSelecionada.nome}: R$ ${custoReal.toFixed(2)}`);
            
            // Aplicar gramagem das proteínas
            let displayName = receitaSelecionada.nome;
            
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
            // PULAR categoria se não houver receitas com ingredientes calculáveis
            console.log(`❌ PULANDO categoria ${categoria} - sem receitas com custos calculáveis`);
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

      const endTime = Date.now();
      console.log(`⏱️ Cardápio gerado em ${endTime - startTime}ms`);

      return {
        cardapio_semanal: cardapioSemanal,
        resumo: {
          categorias_com_receitas: Object.keys(receitasPorCategoria).filter(cat => 
            receitasPorCategoria[cat] && receitasPorCategoria[cat].length > 0
          ).length,
          total_categorias: categorias.length,
          receitas_por_categoria: Object.fromEntries(
            Object.entries(receitasPorCategoria).map(([cat, receitas]) => [cat, receitas?.length || 0])
          ),
          tempo_execucao_ms: endTime - startTime
        }
      };
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