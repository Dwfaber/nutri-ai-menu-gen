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
        
        // Mapear categorias para nomes corretos no banco de dados
        const categoriaMapeada = categoria === 'Arroz Branco' ? 'Arroz' : categoria;
        
        if (categoriaMapeada !== categoria) {
          console.log(`🔄 Mapeando categoria '${categoria}' → '${categoriaMapeada}'`);
        }
        
        // Buscar receitas que têm ingredientes na tabela receita_ingredientes
        const { data: receitasComIngredientes, error } = await supabase
          .from('receita_ingredientes')
          .select(`
            receita_id_legado,
            nome,
            categoria_descricao,
            produto_base_id
          `)
          .eq('categoria_descricao', categoriaMapeada)
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

    // Função para calcular custo real da receita com quantidade de refeições
    async function calcularCustoReal(receitaId: string, mealQuantity: number = 50): Promise<number | null> {
      const cacheKey = `cost_${receitaId}_${mealQuantity}`;
      
      // Verificar cache primeiro
      if (costCache.has(cacheKey)) {
        return costCache.get(cacheKey)!;
      }

      try {
        console.log(`💰 Calculando custo real para receita ${receitaId} (${mealQuantity} porções)`);
        
        // Buscar ingredientes da receita
        const { data: ingredientes, error: ingredientesError } = await supabase
          .from('receita_ingredientes')
          .select('produto_base_id, quantidade, unidade, nome')
          .eq('receita_id_legado', receitaId);
        
        if (ingredientesError || !ingredientes?.length) {
          console.log(`❌ PULANDO receita ${receitaId} - sem ingredientes`);
          return null;
        }

        // Agrupar ingredientes similares (mesmo produto_base_id) e usar menor quantidade
        const ingredientesAgrupados = new Map();
        for (const ingrediente of ingredientes) {
          const key = ingrediente.produto_base_id;
          if (!ingredientesAgrupados.has(key)) {
            ingredientesAgrupados.set(key, ingrediente);
          } else {
            // Se já existe, manter o de menor quantidade (evita duplicação)
            const existente = ingredientesAgrupados.get(key);
            if (ingrediente.quantidade < existente.quantidade) {
              ingredientesAgrupados.set(key, ingrediente);
            }
          }
        }

        const ingredientesUnicos = Array.from(ingredientesAgrupados.values());
        console.log(`📦 ${ingredientes.length} ingredientes → ${ingredientesUnicos.length} únicos`);

        // Buscar preços atuais (sempre o menor preço por produto_base_id)
        const produtoBaseIds = ingredientesUnicos.map(ing => ing.produto_base_id);
        const { data: todosPrecos, error: precosError } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('produto_base_id, preco, produto_base_quantidade_embalagem, em_promocao_sim_nao')
          .in('produto_base_id', produtoBaseIds)
          .gt('preco', 0)
          .order('preco', { ascending: true }); // Ordem crescente para pegar menor preço

        if (precosError || !todosPrecos?.length) {
          console.log(`❌ PULANDO receita ${receitaId} - sem preços`);
          return null;
        }

        // Selecionar menor preço por produto_base_id
        const melhoresPrecos = new Map();
        for (const preco of todosPrecos) {
          const key = preco.produto_base_id;
          if (!melhoresPrecos.has(key)) {
            melhoresPrecos.set(key, preco);
          }
        }

        let custoTotal = 0;
        let ingredientesComPreco = 0;
        
        for (const ingrediente of ingredientesUnicos) {
          const melhorPreco = melhoresPrecos.get(ingrediente.produto_base_id);
          if (melhorPreco && melhorPreco.preco > 0) {
            const quantidadeEmbalagem = melhorPreco.produto_base_quantidade_embalagem || 1000;
            const custoIngrediente = (ingrediente.quantidade / quantidadeEmbalagem) * melhorPreco.preco;
            
            // Aplicar desconto se em promoção
            const custoFinal = melhorPreco.em_promocao_sim_nao ? custoIngrediente * 0.9 : custoIngrediente;
            custoTotal += custoFinal;
            ingredientesComPreco++;
            
            console.log(`  📊 ${ingrediente.produto_base_id}: ${ingrediente.quantidade}/${quantidadeEmbalagem} * R$${melhorPreco.preco} = R$${custoFinal.toFixed(2)} ${melhorPreco.em_promocao_sim_nao ? '(PROMOÇÃO)' : ''}`);
          }
        }

        // Só aceitar se conseguiu calcular pelo menos 80% dos ingredientes únicos
        const percentualCalculado = (ingredientesComPreco / ingredientesUnicos.length) * 100;
        if (percentualCalculado < 80) {
          console.log(`❌ PULANDO receita ${receitaId} - apenas ${percentualCalculado.toFixed(1)}% dos ingredientes têm preço`);
          return null;
        }

        // CRÍTICO: Dividir pelo número correto de porções
        const custoPorPorcao = custoTotal / mealQuantity;

        // Cache do resultado POR PORÇÃO
        costCache.set(cacheKey, custoPorPorcao);
        console.log(`✅ CUSTO CALCULADO para ${receitaId}: R$ ${custoTotal.toFixed(2)} ÷ ${mealQuantity} porções = R$ ${custoPorPorcao.toFixed(2)} por porção`);
        
        return custoPorPorcao;
      } catch (error) {
        console.log(`❌ ERRO ao calcular custo real para ${receitaId}:`, error);
        return null;
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

    // Cache para lotes de custos calculados por categoria
    const batchCache = new Map<string, Map<string, number>>();
    
    // Função otimizada para calcular custos em batch com quantidade de refeições
    async function calcularCustosBatch(receitas: any[], categoria: string, mealQuantity: number = 50): Promise<Map<string, number>> {
      const cacheKey = `batch_${categoria}_${mealQuantity}`;
      
      if (batchCache.has(cacheKey)) {
        return batchCache.get(cacheKey)!;
      }
      
      console.log(`📦 Calculando custos em batch para ${categoria}: ${receitas.length} receitas (${mealQuantity} porções)`);
      const resultados = new Map<string, number>();
      
      // Limitar a 15 receitas por categoria para controlar timeout
      const receitasLimitadas = receitas.slice(0, 15);
      
      // Buscar todos os ingredientes de uma vez
      const receitaIds = receitasLimitadas.map(r => r.id);
      const { data: todosIngredientes } = await supabase
        .from('receita_ingredientes')
        .select('receita_id_legado, produto_base_id, quantidade, unidade, nome')
        .in('receita_id_legado', receitaIds);
      
      if (!todosIngredientes?.length) {
        batchCache.set(cacheKey, resultados);
        return resultados;
      }
      
      // Buscar todos os preços ordenados por preço (menor primeiro)
      const todosProdutoIds = [...new Set(todosIngredientes.map(ing => ing.produto_base_id))];
      const { data: todosPrecos } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('produto_base_id, preco, produto_base_quantidade_embalagem, em_promocao_sim_nao')
        .in('produto_base_id', todosProdutoIds)
        .gt('preco', 0)
        .order('preco', { ascending: true }); // Menor preço primeiro
      
      // Criar mapa de melhores preços
      const melhoresPrecos = new Map();
      todosPrecos?.forEach(preco => {
        const key = preco.produto_base_id;
        if (!melhoresPrecos.has(key)) {
          melhoresPrecos.set(key, preco);
        }
      });
      
      // Processar cada receita
      for (const receita of receitasLimitadas) {
        const ingredientesReceita = todosIngredientes.filter(ing => ing.receita_id_legado === receita.id);
        
        if (!ingredientesReceita.length) continue;
        
        // Agrupar ingredientes similares (mesmo produto_base_id)
        const ingredientesAgrupados = new Map();
        for (const ingrediente of ingredientesReceita) {
          const key = ingrediente.produto_base_id;
          if (!ingredientesAgrupados.has(key)) {
            ingredientesAgrupados.set(key, ingrediente);
          } else {
            // Manter o de menor quantidade (evita duplicação)
            const existente = ingredientesAgrupados.get(key);
            if (ingrediente.quantidade < existente.quantidade) {
              ingredientesAgrupados.set(key, ingrediente);
            }
          }
        }
        
        const ingredientesUnicos = Array.from(ingredientesAgrupados.values());
        let custoTotal = 0;
        let ingredientesComPreco = 0;
        
        for (const ingrediente of ingredientesUnicos) {
          const melhorPreco = melhoresPrecos.get(ingrediente.produto_base_id);
          if (melhorPreco && melhorPreco.preco > 0) {
            const quantidadeEmbalagem = melhorPreco.produto_base_quantidade_embalagem || 1000;
            const custoIngrediente = (ingrediente.quantidade / quantidadeEmbalagem) * melhorPreco.preco;
            const custoFinal = melhorPreco.em_promocao_sim_nao ? custoIngrediente * 0.9 : custoIngrediente;
            custoTotal += custoFinal;
            ingredientesComPreco++;
          }
        }
        
        // Só aceitar se conseguiu calcular pelo menos 80% dos ingredientes únicos
        const percentualCalculado = (ingredientesComPreco / ingredientesUnicos.length) * 100;
        if (percentualCalculado >= 80) {
          // CRÍTICO: Dividir pelo número correto de porções
          const custoPorPorcao = custoTotal / mealQuantity;
          resultados.set(receita.id, custoPorPorcao);
          console.log(`✅ ${receita.id}: R$ ${custoTotal.toFixed(2)} ÷ ${mealQuantity} = R$ ${custoPorPorcao.toFixed(2)} por porção`);
        }
      }
      
      batchCache.set(cacheKey, resultados);
      console.log(`📦 Batch ${categoria}: ${resultados.size}/${receitasLimitadas.length} receitas calculadas`);
      return resultados;
    }

    // Função para selecionar receita com controle de variedade (otimizada)
    async function selecionarReceitaComVariedade(receitasDisponiveis: any[], categoria: string, receitasUsadas: Set<string>, receitasDoDia: any[], budgetPerMeal?: number, mealQuantity: number = 50): Promise<any> {
      console.log(`🎯 Selecionando receita para ${categoria}, disponíveis: ${receitasDisponiveis.length}`);
      
      // Calcular custos em batch primeiro com quantidade correta
      const custosBatch = await calcularCustosBatch(receitasDisponiveis, categoria, mealQuantity);
      
      // Filtrar apenas receitas com custos calculáveis
      let candidatas = receitasDisponiveis.filter(receita => 
        custosBatch.has(receita.id) && !receitasUsadas.has(receita.id)
      );
      
      // Se todas foram usadas, usar todas com custos calculáveis
      if (candidatas.length === 0) {
        candidatas = receitasDisponiveis.filter(receita => custosBatch.has(receita.id));
        console.log(`♻️ Reiniciando pool para ${categoria}: ${candidatas.length} receitas`);
      }
      
      if (candidatas.length === 0) {
        console.log(`❌ Nenhuma receita calculável para ${categoria}`);
        return null;
      }

      // Aplicar filtro de orçamento
      if (budgetPerMeal) {
        const custoMaximoCategoria = getCustoMaximoCategoria(categoria, budgetPerMeal);
        console.log(`💰 Orçamento máximo para ${categoria}: R$ ${custoMaximoCategoria.toFixed(2)}`);
        
        const candidatasDentroOrcamento = candidatas.filter(receita => {
          const custo = custosBatch.get(receita.id)!;
          return custo <= custoMaximoCategoria;
        });
        
        if (candidatasDentroOrcamento.length > 0) {
          candidatas = candidatasDentroOrcamento;
          console.log(`💰 ${candidatasDentroOrcamento.length} receitas dentro do orçamento`);
        } else {
          console.log(`⚠️ Usando orçamento flexível para ${categoria}`);
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

    // Função com timeout para evitar CPU exceeded
    async function gerarCardapioComTimeout(proteinConfig = {}, includeWeekends = false, budgetPerMeal = null, mealQuantity = 50) {
      const TIMEOUT_MS = 25000; // 25 segundos
      const startTime = Date.now();
      
      return Promise.race([
        gerarCardapioValidado(proteinConfig, includeWeekends, budgetPerMeal, mealQuantity),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na geração do cardápio')), TIMEOUT_MS)
        )
      ]);
    }

    // Gerar cardápio usando apenas receitas com ingredientes (otimizado)
    async function gerarCardapioValidado(proteinConfig = {}, includeWeekends = false, budgetPerMeal = null, mealQuantity = 50) {
      const startTime = Date.now();
      console.log(`🚀 Iniciando geração de cardápio otimizada para ${mealQuantity} porções`);
      
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
      
      // Buscar receitas para cada categoria com limite
      for (const categoria of categorias) {
        receitasPorCategoria[categoria] = await buscarReceitasComIngredientes(categoria);
        
        // Verificar timeout a cada categoria
        if (Date.now() - startTime > 20000) {
          console.log('⏰ Timeout detectado, finalizando busca de receitas');
          break;
        }
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
              budgetPerMeal,
              mealQuantity
            );
            
            // Marcar receita como usada
            receitasUsadas.add(receitaSelecionada.id);
            
            // Obter custo do batch cache (já calculado por porção)
            const custosBatch = await calcularCustosBatch(receitasDisponiveis, categoria, mealQuantity);
            const custoReal = custosBatch.get(receitaSelecionada.id);
            
            if (custoReal === undefined) {
              console.log(`❌ PULANDO receita ${receitaSelecionada.nome} - custo não calculável`);
              continue;
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

        // Verificar timeout durante geração
        if (Date.now() - startTime > 22000) {
          console.log('⏰ Timeout detectado durante geração do dia, finalizando');
          break;
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

    if (action === 'generate_validated_menu') {
      const { 
        protein_config = {}, 
        include_weekends = false, 
        budget_per_meal = null,
        meal_quantity = 50
      } = requestData;

      try {
        console.log(`🍽️ Gerando cardápio para ${meal_quantity} refeições`);
        
        // Usar função com timeout
        const resultado = await gerarCardapioComTimeout(
          protein_config, 
          include_weekends, 
          budget_per_meal,
          meal_quantity
        );

        return new Response(
          JSON.stringify({
            success: true,
            data: resultado
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('❌ Erro na geração do cardápio:', error);
        
        // Se for timeout, retornar cardápio parcial
        if (error.message.includes('Timeout')) {
          return new Response(
            JSON.stringify({
              success: false,
              timeout: true,
              error: 'Geração interrompida por timeout - use cardápio parcial ou tente novamente',
              data: {
                cardapio_semanal: [],
                resumo: {
                  erro: 'Timeout na geração - cálculos muito complexos'
                }
              }
            }),
            {
              status: 408,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
            data: {
              cardapio_semanal: [],
              resumo: {
                erro: 'Falha na geração do cardápio'
              }
            }
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Se chegou aqui, action não foi reconhecida
    return new Response(
      JSON.stringify({
        success: false,
        error: `Ação não reconhecida: ${action}`,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
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