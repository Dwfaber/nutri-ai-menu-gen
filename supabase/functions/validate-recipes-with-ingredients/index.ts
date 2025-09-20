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
        // JOIN com receitas_legado para filtrar apenas receitas ativas
        const { data: receitasComIngredientes, error } = await supabase
          .from('receita_ingredientes')
          .select(`
            receita_id_legado,
            nome,
            categoria_descricao,
            produto_base_id,
            receitas_legado!inner(inativa)
          `)
          .eq('categoria_descricao', categoriaMapeada)
          .eq('receitas_legado.inativa', false)
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
        console.log(`✅ ${categoria}: ${receitas.length} receitas ATIVAS com ingredientes encontradas`);
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

    // 🚀 Função OTIMIZADA para calcular custo usando custos pré-calculados
    async function calcularCustoReal(receitaId: string, mealQuantity: number = 50): Promise<number | null> {
      const cacheKey = `cost_${receitaId}_${mealQuantity}`;
      
      // Verificar cache primeiro
      if (costCache.has(cacheKey)) {
        return costCache.get(cacheKey)!;
      }

      try {
        // 💰 NOVA LÓGICA: Verificar se existe custo pré-calculado
        const { data: receitaCompleta } = await supabase
          .from('receitas_legado')
          .select('custo_total, porcoes, nome_receita')
          .eq('receita_id_legado', receitaId)
          .single();

        // Se tem custo pré-calculado (para 100 pessoas), fazer ajuste proporcional
        if (receitaCompleta?.custo_total && receitaCompleta.custo_total > 0) {
          const custoBase = receitaCompleta.custo_total; // Custo para 100 pessoas
          const custoPorPorcao = (custoBase * mealQuantity) / (100 * mealQuantity); // = custoBase / 100
          
          console.log(`💰 PRÉ-CALCULADO: ${receitaCompleta.nome_receita} - R$ ${custoPorPorcao.toFixed(4)} por porção (base: R$ ${custoBase.toFixed(2)}/100 pessoas)`);
          
          costCache.set(cacheKey, custoPorPorcao);
          return custoPorPorcao;
        }

        // 🔄 FALLBACK: Cálculo em tempo real (compatibilidade)
        console.log(`⚡ FALLBACK - Calculando custo em tempo real para receita ${receitaId} (${mealQuantity} porções) - custo_total = ${receitaCompleta?.custo_total || 'NULL'}`);
        
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

        // Calcular preço médio por produto_base_id
        const precosAgrupados = new Map();
        
        // Agrupar preços por produto_base_id
        for (const preco of todosPrecos) {
          const key = preco.produto_base_id;
          if (!precosAgrupados.has(key)) {
            precosAgrupados.set(key, []);
          }
          precosAgrupados.get(key).push(preco);
        }
        
        // Calcular média e criar mapa de melhores preços
        const melhoresPrecos = new Map();
        for (const [produtoBaseId, precos] of precosAgrupados) {
          if (precos.length === 1) {
            // Único fornecedor, usar preço direto
            melhoresPrecos.set(produtoBaseId, precos[0]);
          } else {
            // Múltiplos fornecedores, calcular média
            const somaPrecos = precos.reduce((sum, p) => sum + p.preco, 0);
            const precoMedio = somaPrecos / precos.length;
            
            // Criar objeto com preço médio baseado no primeiro produto
            const precoMedioObj = {
              ...precos[0],
              preco: precoMedio
            };
            
            melhoresPrecos.set(produtoBaseId, precoMedioObj);
            console.log(`📊 Produto ${produtoBaseId}: ${precos.length} fornecedores, preço médio R$${precoMedio.toFixed(2)} (preços: ${precos.map(p => `R$${p.preco}`).join(', ')})`);
          }
        }

        // Filtrar ingredientes duplicados na receita 580 (arroz) - manter apenas produto 558
        let ingredientesFiltrados = ingredientesUnicos;
        if (receitaId === '580') {
          ingredientesFiltrados = ingredientesUnicos.filter(ing => ing.produto_base_id !== 38); // Remover Arroz emergência
          console.log(`🍚 Receita 580: Removido produto 38 (Arroz emergência), mantendo apenas produto 558`);
        }

        // Fator de escala baseado em receitas para 100 pessoas
        const fatorEscala = mealQuantity / 100;
        let custoTotal = 0;
        let ingredientesComPreco = 0;
        
        for (const ingrediente of ingredientesFiltrados) {
          // Tratamento especial para água (produto_base_id = 17)
          if (ingrediente.produto_base_id === 17) {
            const custoAgua = 0.01; // Custo simbólico para água
            custoTotal += custoAgua;
            ingredientesComPreco++;
            console.log(`  💧 ${ingrediente.produto_base_id}: Água - custo simbólico R$${custoAgua.toFixed(2)}`);
            continue;
          }

          const melhorPreco = melhoresPrecos.get(ingrediente.produto_base_id);
          if (melhorPreco && melhorPreco.preco > 0) {
            const quantidadeEmbalagem = melhorPreco.produto_base_quantidade_embalagem || 1000;
            // Aplicar escalonamento na quantidade do ingrediente
            const quantidadeEscalonada = ingrediente.quantidade * fatorEscala;
            const custoIngrediente = (quantidadeEscalonada / quantidadeEmbalagem) * melhorPreco.preco;
            
            // Aplicar desconto se em promoção
            const custoFinal = melhorPreco.em_promocao_sim_nao ? custoIngrediente * 0.9 : custoIngrediente;
            custoTotal += custoFinal;
            ingredientesComPreco++;
            
            console.log(`  📊 ${ingrediente.produto_base_id}: ${quantidadeEscalonada.toFixed(2)}/${quantidadeEmbalagem} * R$${melhorPreco.preco} = R$${custoFinal.toFixed(2)} ${melhorPreco.em_promocao_sim_nao ? '(PROMOÇÃO)' : ''}`);
          }
        }

        // Só aceitar se conseguiu calcular pelo menos 80% dos ingredientes filtrados
        const percentualCalculado = (ingredientesComPreco / ingredientesFiltrados.length) * 100;
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
      
      // Limitar a 10 receitas por categoria para otimizar velocidade
      const receitasLimitadas = receitas.slice(0, 10);
      
      // Buscar todos os ingredientes de uma vez (apenas receitas ativas)
      const receitaIds = receitasLimitadas.map(r => r.id);
      const { data: todosIngredientes } = await supabase
        .from('receita_ingredientes')
        .select(`
          receita_id_legado, 
          produto_base_id, 
          quantidade, 
          unidade, 
          nome,
          receitas_legado!inner(inativa)
        `)
        .in('receita_id_legado', receitaIds)
        .eq('receitas_legado.inativa', false);
      
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
        
        // Filtrar ingredientes duplicados na receita 580 (arroz) - manter apenas produto 558
        let ingredientesFiltrados = ingredientesUnicos;
        if (receita.id === '580') {
          ingredientesFiltrados = ingredientesUnicos.filter(ing => ing.produto_base_id !== 38); // Remover Arroz emergência
          console.log(`🍚 Batch Receita 580: Removido produto 38 (Arroz emergência), mantendo apenas produto 558`);
        }

        // Fator de escala baseado em receitas para 100 pessoas
        const fatorEscala = mealQuantity / 100;
        let custoTotal = 0;
        let ingredientesComPreco = 0;
        
        for (const ingrediente of ingredientesFiltrados) {
          // Tratamento especial para água (produto_base_id = 17)
          if (ingrediente.produto_base_id === 17) {
            const custoAgua = 0.01 * fatorEscala; // Custo simbólico para água escalado
            custoTotal += custoAgua;
            ingredientesComPreco++;
            console.log(`  💧 ${ingrediente.produto_base_id}: Água - custo simbólico R$${custoAgua.toFixed(2)} (escala ${fatorEscala})`);
            continue;
          }

          const melhorPreco = melhoresPrecos.get(ingrediente.produto_base_id);
          if (melhorPreco && melhorPreco.preco > 0) {
            const quantidadeEmbalagem = melhorPreco.produto_base_quantidade_embalagem || 1000;
            // Aplicar fator de escala na quantidade
            const quantidadeEscalada = ingrediente.quantidade * fatorEscala;
            const custoIngrediente = (quantidadeEscalada / quantidadeEmbalagem) * melhorPreco.preco;
            const custoFinal = melhorPreco.em_promocao_sim_nao ? custoIngrediente * 0.9 : custoIngrediente;
            custoTotal += custoFinal;
            ingredientesComPreco++;
            console.log(`  📊 ${ingrediente.produto_base_id}: ${quantidadeEscalada.toFixed(2)}/${quantidadeEmbalagem} * R$${melhorPreco.preco} = R$${custoFinal.toFixed(2)} `);
          }
        }
        
        // Só aceitar se conseguiu calcular pelo menos 80% dos ingredientes filtrados
        const percentualCalculado = (ingredientesComPreco / ingredientesFiltrados.length) * 100;
        if (percentualCalculado >= 80) {
          // Custo por porção já está correto pois aplicamos o fator de escala nos ingredientes
          const custoPorPorcao = custoTotal / mealQuantity;
          resultados.set(receita.id, custoPorPorcao);
          console.log(`✅ ${receita.id}: R$ ${custoTotal.toFixed(2)} ÷ ${mealQuantity} = R$ ${custoPorPorcao.toFixed(2)} por porção`);
        }
      }
      
      batchCache.set(cacheKey, resultados);
      console.log(`📦 Batch ${categoria}: ${resultados.size}/${receitasLimitadas.length} receitas calculadas`);
      return resultados;
    }

    // Função para selecionar receita com controle de variedade (com timeout e logs detalhados)
    async function selecionarReceitaComVariedade(receitasDisponiveis: any[], categoria: string, receitasUsadas: Set<string>, receitasDoDia: any[], budgetPerMeal?: number, mealQuantity: number = 50, timeoutStart?: number): Promise<any> {
      const stepStart = Date.now();
      console.log(`🎯 [${categoria}] Iniciando seleção - ${receitasDisponiveis?.length || 0} receitas disponíveis`);
      
      // Verificar timeout antes de iniciar (reduzido para 25 segundos)
      if (timeoutStart && (Date.now() - timeoutStart) > 25000) {
        console.log(`⏰ [${categoria}] Timeout preventivo - usando primeira receita disponível`);
        if (receitasDisponiveis && receitasDisponiveis.length > 0) {
          const primeiraReceita = receitasDisponiveis[0];
          return {
            id: primeiraReceita.receita_id_legado,
            nome: primeiraReceita.nome_receita,
            category: categoria,
            cost: 1.00 // Custo fallback
          };
        }
        return null;
      }

      try {
        console.log(`🎯 [${categoria}] Selecionando receita, disponíveis: ${receitasDisponiveis.length}`);
        
        // Calcular custos em batch primeiro com quantidade correta
        console.log(`💰 [${categoria}] Calculando custos em batch...`);
        const custosBatch = await calcularCustosBatch(receitasDisponiveis, categoria, mealQuantity);
        console.log(`💰 [${categoria}] Custos calculados: ${custosBatch.size} receitas`);
        
        // Verificar timeout após cálculo de custos (reduzido para 25 segundos)
        if (timeoutStart && (Date.now() - timeoutStart) > 25000) {
          console.log(`⏰ [${categoria}] Timeout após cálculo de custos - usando receita mais barata`);
          const receitaComCusto = receitasDisponiveis.find(r => custosBatch.has(r.id));
          if (receitaComCusto) {
            const custo = custosBatch.get(receitaComCusto.id) || 1.00;
            return {
              id: receitaComCusto.id,
              nome: receitaComCusto.nome,
              category: categoria,
              cost: custo
            };
          }
          return null;
        }
        
        // Filtrar apenas receitas com custos calculáveis
        let candidatas = receitasDisponiveis.filter(receita => 
          custosBatch.has(receita.id) && !receitasUsadas.has(receita.id)
        );
        
        // Se todas foram usadas, usar todas com custos calculáveis
        if (candidatas.length === 0) {
          candidatas = receitasDisponiveis.filter(receita => custosBatch.has(receita.id));
          console.log(`♻️ [${categoria}] Reiniciando pool: ${candidatas.length} receitas`);
        }
        
        if (candidatas.length === 0) {
          console.log(`❌ [${categoria}] Nenhuma receita calculável`);
          return null;
        }

        console.log(`✅ [${categoria}] ${candidatas.length} candidatas inicial`);

        // Aplicar filtro de orçamento
        if (budgetPerMeal) {
          const custoMaximoCategoria = getCustoMaximoCategoria(categoria, budgetPerMeal);
          console.log(`💰 [${categoria}] Orçamento máximo: R$ ${custoMaximoCategoria.toFixed(2)}`);
          
          const candidatasDentroOrcamento = candidatas.filter(receita => {
            const custo = custosBatch.get(receita.id)!;
            return custo <= custoMaximoCategoria;
          });
          
          if (candidatasDentroOrcamento.length > 0) {
            candidatas = candidatasDentroOrcamento;
            console.log(`💰 [${categoria}] ${candidatasDentroOrcamento.length} receitas dentro do orçamento`);
          } else {
            console.log(`⚠️ [${categoria}] Usando orçamento flexível`);
          }
        }

        // Controle especial para proteínas para evitar repetição no mesmo dia
        if (categoria === 'Prato Principal 1' || categoria === 'Prato Principal 2') {
          const proteinaOposta = categoria === 'Prato Principal 1' ? 'Prato Principal 2' : 'Prato Principal 1';
          const proteinaOpostaDoMesmodia = receitasDoDia.find(r => r.category === proteinaOposta);
          
          if (proteinaOpostaDoMesmodia) {
            const tipoProteinaOposta = getProteinType(proteinaOpostaDoMesmodia.name);
            console.log(`🥩 [${categoria}] Proteína oposta: ${proteinaOpostaDoMesmodia.name} (tipo: ${tipoProteinaOposta})`);
            
            // Filtrar para evitar mesmo tipo de proteína
            const candidatasDiferentesTipo = candidatas.filter(receita => {
              const tipo = getProteinType(receita.nome);
              return tipo !== tipoProteinaOposta;
            });
            
            if (candidatasDiferentesTipo.length > 0) {
              candidatas = candidatasDiferentesTipo;
              console.log(`✅ [${categoria}] Filtrado para tipo diferente de proteína: ${candidatas.length} opções`);
            } else {
              console.log(`⚠️ [${categoria}] Não foi possível evitar repetição de tipo de proteína`);
            }
          }
        }

        // Controle especial para saladas para evitar repetição
        if (categoria === 'Salada 1' || categoria === 'Salada 2') {
          const saladaOposta = categoria === 'Salada 1' ? 'Salada 2' : 'Salada 1';
          const saladaOpostaDoMesmoDia = receitasDoDia.find(r => r.category === saladaOposta);
          
          if (saladaOpostaDoMesmoDia) {
            console.log(`🥗 [${categoria}] Salada oposta: ${saladaOpostaDoMesmoDia.name}`);
            
            // Filtrar para evitar salada idêntica no mesmo dia
            const candidatasDiferentes = candidatas.filter(receita => 
              receita.nome.toLowerCase() !== saladaOpostaDoMesmoDia.name.toLowerCase()
            );
            
            if (candidatasDiferentes.length > 0) {
              candidatas = candidatasDiferentes;
              console.log(`✅ [${categoria}] Filtrado para salada diferente: ${candidatas.length} opções`);
            }
          }
        }

        console.log(`🔄 [${categoria}] Candidatas finais: ${candidatas.length}`);

        // Selecionar da lista filtrada com variação inteligente
        const candidatasComCusto = candidatas.map(receita => ({
          receita,
          custo: custosBatch.get(receita.id) || 999
        })).filter(item => item.custo < 999); // Só receitas com custo calculado

        let receitaSelecionada;
        
        if (candidatasComCusto.length > 0) {
          // Ordenar por custo e pegar as 3 mais baratas para dar variação
          const topCandidatas = candidatasComCusto
            .sort((a, b) => a.custo - b.custo)
            .slice(0, Math.min(3, candidatasComCusto.length));
          
          // Selecionar aleatoriamente entre as top 3 mais baratas
          const indiceAleatorio = Math.floor(Math.random() * topCandidatas.length);
          receitaSelecionada = topCandidatas[indiceAleatorio].receita;
        } else {
          // Fallback: pegar aleatoriamente da lista original
          const indiceAleatorio = Math.floor(Math.random() * candidatas.length);
          receitaSelecionada = candidatas[indiceAleatorio];
        }
        
        if (receitaSelecionada) {
          const tempoProcessamento = Date.now() - stepStart;
          console.log(`✅ [${categoria}] Selecionada: ${receitaSelecionada.nome} (${tempoProcessamento}ms)`);
          return receitaSelecionada;
        }

        console.log(`❌ [${categoria}] Falha na seleção`);
        return null;
        
      } catch (error) {
        console.error(`💥 [${categoria}] Erro na seleção:`, error);
        
        // Fallback: usar primeira receita disponível
        if (receitasDisponiveis && receitasDisponiveis.length > 0) {
          const receitaFallback = receitasDisponiveis[0];
          console.log(`🆘 [${categoria}] Usando receita fallback: ${receitaFallback.nome}`);
          return {
            id: receitaFallback.receita_id_legado || receitaFallback.id,
            nome: receitaFallback.nome_receita || receitaFallback.nome,
            category: categoria,
            cost: 1.00 // Custo fallback
          };
        }
        
        return null;
      }
    }

    // Função com timeout para evitar CPU exceeded (otimizado)
    async function gerarCardapioComTimeout(proteinConfig = {}, includeWeekends = false, budgetPerMeal = null, mealQuantity = 50) {
      const TIMEOUT_MS = 90000; // 90 segundos - timeout dobrado
      const startTime = Date.now();
      console.log(`⏰ Iniciando geração com timeout de ${TIMEOUT_MS}ms`);
      
      return Promise.race([
        gerarCardapioValidado(proteinConfig, includeWeekends, budgetPerMeal, mealQuantity, {}),
        new Promise((_, reject) => 
          setTimeout(() => {
            console.log(`💥 TIMEOUT! Geração excedeu ${TIMEOUT_MS}ms`);
            reject(new Error('Timeout na geração do cardápio - tente um período menor'));
          }, TIMEOUT_MS)
        )
      ]);
    }

    // Gerar cardápio usando apenas receitas com ingredientes (otimizado)
    async function gerarCardapioValidado(proteinConfig = {}, includeWeekends = false, budgetPerMeal = null, mealQuantity = 50, receitasFixas = {}) {
      const startTime = Date.now();
      console.log(`🚀 Iniciando geração de cardápio otimizada para ${mealQuantity} porções`);
      
      // Receitas fixas padrão para arroz, feijão e café
      const fixedRecipes = {
        'Arroz Branco': { id: '580', nome: 'ARROZ' },
        'Feijão': { id: '581', nome: 'FEIJÃO MIX (CARIOCA + BANDINHA) 50%' },
        'Base': { id: '1724', nome: 'CAFÉ CORTESIA' },
        ...receitasFixas
      };
      
      console.log('🔒 Receitas fixas configuradas:', fixedRecipes);
      
      const categorias = [
        'Prato Principal 1',
        'Prato Principal 2', 
        'Arroz Branco',
        'Feijão',
        'Base',  // Café cortesia
        'Sobremesa',  // Movida para antes para evitar timeout
        'Guarnição',
        'Salada 1',
        'Salada 2',
        'Suco 1',
        'Suco 2'
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
        console.log(`📅 [DIA] Gerando cardápio para ${dia}`);
        const receitasDia = [];

        // Verificar timeout antes de cada dia
        if (Date.now() - startTime > 20000) {
          console.log(`⏰ [DIA] Timeout antes de ${dia}, finalizando cardápio`);
          break;
        }

        // Selecionar uma receita de cada categoria (ou fallback se não houver)
        for (const categoria of categorias) {
          console.log(`🔄 [DIA] ${dia} - Processando categoria: ${categoria}`);
          
          // Verificar se há receita fixa para esta categoria
          if (fixedRecipes[categoria]) {
            const receitaFixa = fixedRecipes[categoria];
            console.log(`🔒 [DIA] ${dia} - Usando receita fixa para ${categoria}: ${receitaFixa.nome} (ID: ${receitaFixa.id})`);
            
            // Calcular custo da receita fixa
            const custoReal = await calcularCustoReal(receitaFixa.id, mealQuantity);
            
            if (custoReal && custoReal > 0) {
              receitasDia.push({
                id: receitaFixa.id,
                name: receitaFixa.nome,
                category: categoria,
                day: dia,
                cost: custoReal
              });
              
              console.log(`✅ [DIA] ${dia} - ${categoria}: ${receitaFixa.nome} (R$ ${custoReal.toFixed(2)})`);
              continue; // Pular para próxima categoria
            } else {
              console.log(`⚠️ [DIA] ${dia} - Receita fixa ${receitaFixa.nome} não tem custo calculável, usando seleção normal`);
            }
          }
          
          const receitasDisponiveis = receitasPorCategoria[categoria];
          
          // Verificar timeout durante processamento de categorias
          if (Date.now() - startTime > 21000) {
            console.log(`⏰ [DIA] Timeout durante ${categoria} em ${dia}, finalizando`);
            break;
          }
          
          if (receitasDisponiveis && receitasDisponiveis.length > 0) {
            try {
              // Usar seleção inteligente com controle de variedade e timeout
              const receitaSelecionada = await selecionarReceitaComVariedade(
                receitasDisponiveis, 
                categoria, 
                receitasUsadas, 
                receitasDia, 
                budgetPerMeal,
                mealQuantity,
                startTime // Passar tempo inicial para verificação de timeout
              );
              
              if (!receitaSelecionada) {
                console.log(`❌ [DIA] ${dia} - Não foi possível selecionar receita para ${categoria}`);
                continue;
              }
              
              // Marcar receita como usada
              receitasUsadas.add(receitaSelecionada.id);
              
              // Obter custo do batch cache (já calculado por porção)
              const custosBatch = await calcularCustosBatch(receitasDisponiveis, categoria, mealQuantity);
              const custoReal = custosBatch.get(receitaSelecionada.id);
              
              if (custoReal === undefined) {
                console.log(`❌ [DIA] ${dia} - PULANDO receita ${receitaSelecionada.nome} - custo não calculável`);
                continue;
              }
              
              let custoAjustado = custoReal;
              console.log(`💰 [DIA] ${dia} - Usando custo real para ${receitaSelecionada.nome}: R$ ${custoReal.toFixed(2)}`);
              
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
              
              console.log(`✅ [DIA] ${dia} - ${categoria}: ${displayName} (R$ ${custoAjustado.toFixed(2)})`);
              
            } catch (error) {
              console.error(`💥 [DIA] ${dia} - Erro ao processar ${categoria}:`, error);
              // Continuar com próxima categoria
              continue;
            }
          } else {
            // PULAR categoria se não houver receitas com ingredientes calculáveis
            console.log(`❌ [DIA] ${dia} - PULANDO categoria ${categoria} - sem receitas com custos calculáveis`);
          }
        }

        // Verificar timeout após cada dia
        if (Date.now() - startTime > 22000) {
          console.log(`⏰ [DIA] Timeout após ${dia}, finalizando cardápio`);
          break;
        }
        
        console.log(`✅ [DIA] ${dia} finalizado - ${receitasDia.length} receitas selecionadas`);
        if (receitasDia.length > 0) {
          cardapioSemanal.push({ dia, receitas: receitasDia });
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
      const categorias = ['Prato Principal 1', 'Prato Principal 2', 'Arroz Branco', 'Feijão', 'Base', 'Guarnição', 'Salada 1', 'Salada 2', 'Suco 1', 'Suco 2', 'Sobremesa'];
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
            cardapio: resultado,
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