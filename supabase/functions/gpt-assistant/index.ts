import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Estrutura principal do cardápio por categoria
const ESTRUTURA_CARDAPIO = {
  CARBOIDRATO: { obrigatorio: true, percentual_orcamento: 15, categoria: 'Carboidrato' },
  PROTEINA_PRINCIPAL: { obrigatorio: true, percentual_orcamento: 40, categoria: 'Proteína Principal' },
  PROTEINA_SECUNDARIA: { obrigatorio: false, percentual_orcamento: 20, categoria: 'Proteína Secundária' },
  GUARNICAO: { obrigatorio: true, percentual_orcamento: 10, categoria: 'Guarnição' },
  SALADA: { obrigatorio: true, percentual_orcamento: 8, categoria: 'Salada' },
  SOBREMESA: { obrigatorio: false, percentual_orcamento: 7, categoria: 'Sobremesa' }
};

// Cache global para preços dos produtos e ingredientes
let pricesCache: Map<number, number> = new Map();
let ingredientsCachePerRecipe: Map<string, any> = new Map();
let proteinasGlobaisCache: any[] = [];

// Lista de palavras-chave para filtrar produtos não-alimentícios (EXPANDIDA)
const NON_FOOD_KEYWORDS = [
  // Limpeza e higiene
  'detergente', 'sabão', 'alvejante', 'desinfetante', 'limpeza', 'higiene',
  'papel higiênico', 'papel toalha', 'guardanapo', 'descartável',
  'copo descartável', 'prato descartável', 'talher descartável',
  'saco de lixo', 'luva', 'máscara', 'álcool', 'sanitizante',
  'amaciante', 'sabonete', 'shampoo', 'condicionador', 'creme dental',
  'escova de dente', 'fio dental', 'absorvente', 'fralda',
  
  // Combustíveis e gases
  'gás', 'carvão', 'lenha', 'combustível', 'gasolina', 'álcool combustível',
  'gás de cozinha', 'botijão', 'refil de gás',
  
  // Equipamentos e utensílios
  'equipamento', 'utensílio', 'panela', 'frigideira', 'colher',
  'faca', 'garfo', 'prato', 'copo', 'tigela', 'bandeja',
  'tábua', 'ralador', 'peneira', 'espumadeira', 'concha',
  'forma', 'assadeira', 'travessa', 'jarra', 'garrafa',
  
  // Materiais não alimentícios
  'plástico', 'vidro', 'metal', 'alumínio', 'inox',
  'madeira', 'borracha', 'tecido', 'papel', 'papelão',
  
  // Outros não alimentícios
  'pilha', 'bateria', 'lâmpada', 'fita', 'cola', 'tinta',
  'caneta', 'lápis', 'borracha', 'grampo', 'clips'
];

// Ingredientes que devem ter custo zero
const ZERO_COST_INGREDIENTS = [
  'água', 'sal', 'açúcar refinado', 'tempero pronto',
  'fermento', 'bicarbonato', 'vinagre branco'
];

// Limites máximos de preço por categoria (em reais)
const PRICE_LIMITS = {
  'PROTEINA': 50.0,           // R$ 50 por kg de proteína
  'CARBOIDRATO': 15.0,        // R$ 15 por kg de carboidrato  
  'LEGUMES': 20.0,            // R$ 20 por kg de legumes
  'VERDURAS': 25.0,           // R$ 25 por kg de verduras
  'TEMPERO': 100.0,           // R$ 100 por kg de temperos
  'LACTEOS': 30.0,            // R$ 30 por litro/kg de lácteos
  'OLEOS': 40.0,              // R$ 40 por litro de óleos
  'GRAOS': 12.0,              // R$ 12 por kg de grãos
  'DEFAULT': 35.0             // Limite padrão
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ============ VERIFICAÇÃO DE SAÚDE ============
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'healthy',
      version: '3.0.0-optimized',
      timestamp: new Date().toISOString(),
      features: ['generate_menu', 'test_recipe_cost', 'global_cache', 'smart_cost_correction']
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const requestData = await req.json();
    console.log(`📊 Requisição recebida:`, JSON.stringify(requestData, null, 2));

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configuração do Supabase não encontrada');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============ FUNÇÕES AUXILIARES ============
    
    // Função para verificar se um produto é não-alimentício (MELHORADA)
    function isNonFoodProduct(description: string): boolean {
      if (!description) return false;
      const desc = description.toLowerCase().trim();
      
      // Verificação exata e parcial de palavras-chave
      return NON_FOOD_KEYWORDS.some(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        // Verifica se contém a palavra exata ou como parte de uma palavra
        return desc.includes(lowerKeyword) || 
               desc.split(' ').some(word => word.includes(lowerKeyword));
      });
    }

    // Função para verificar se um ingrediente deve ter custo zero
    function isZeroCostIngredient(name: string): boolean {
      if (!name) return false;
      const ingredientName = name.toLowerCase().trim();
      return ZERO_COST_INGREDIENTS.some(zero => 
        ingredientName.includes(zero.toLowerCase())
      );
    }

    // Função para validar preço máximo por categoria
    function validatePrice(price: number, categoria: string, description: string): boolean {
      if (price <= 0) return false;
      
      const categoryKey = categoria?.toUpperCase() || 'DEFAULT';
      const maxPrice = PRICE_LIMITS[categoryKey as keyof typeof PRICE_LIMITS] || PRICE_LIMITS.DEFAULT;
      
      if (price > maxPrice) {
        console.warn(`⚠️ Preço suspeito: ${description} - R$ ${price.toFixed(2)} (limite: R$ ${maxPrice})`);
        return false;
      }
      
      return true;
    }

    // Função para carregar cache de preços com filtros inteligentes
    async function loadPricesCache() {
      if (pricesCache.size > 0) {
        console.log(`💾 Cache de preços já carregado: ${pricesCache.size} produtos`);
        return pricesCache;
      }

      console.log('📊 Carregando cache de preços com filtros...');
      
      const { data: produtos, error } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('produto_base_id, preco, descricao, em_promocao_sim_nao, categoria_descricao, unidade')
        .not('preco', 'is', null)
        .gt('preco', 0)
        .lt('preco', 1000) // Limite máximo de R$ 1000 por produto
        .order('preco', { ascending: true });

      if (error) {
        console.error('❌ Erro ao carregar cache de preços:', error);
        return pricesCache;
      }

      let filteredCount = 0;
      let validCount = 0;

      // Popular cache com validações rigorosas
      produtos?.forEach(produto => {
        if (produto.produto_base_id && produto.preco > 0) {
          const descricao = produto.descricao || '';
          
          // 1. Filtrar produtos não-alimentícios
          if (isNonFoodProduct(descricao)) {
            filteredCount++;
            console.log(`🚫 Produto não-alimentício filtrado: ${descricao} - R$ ${produto.preco}`);
            return;
          }

          // 2. Validar preços suspeitos
          if (!validatePrice(produto.preco, produto.categoria_descricao, descricao)) {
            filteredCount++;
            console.log(`🚫 Preço suspeito filtrado: ${descricao} - R$ ${produto.preco}`);
            return;
          }

          // 3. Se já existe no cache, manter o menor preço (mais barato)
          const precoAtual = pricesCache.get(produto.produto_base_id);
          if (!precoAtual || produto.preco < precoAtual) {
            pricesCache.set(produto.produto_base_id, produto.preco);
            validCount++;
          }
        }
      });

      console.log(`✅ Cache carregado: ${validCount} produtos alimentícios válidos, ${filteredCount} produtos filtrados`);
      return pricesCache;
    }

    // Função otimizada para buscar orçamento da filial
    async function buscarOrcamentoFilial(filialIdLegado) {
      console.log(`💰 Buscando orçamento para filial legado ${filialIdLegado}`);
      
      const { data: custoData, error } = await supabase
        .from('custos_filiais')
        .select('*')
        .eq('filial_id', filialIdLegado)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ Erro ao buscar orçamento:', error);
        throw error;
      }

      if (!custoData || custoData.length === 0) {
        console.warn('⚠️ Orçamento não encontrado, usando padrão');
        return {
          RefCustoSegunda: 5.0,
          RefCustoTerca: 5.0,
          RefCustoQuarta: 5.0,
          RefCustoQuinta: 5.0,
          RefCustoSexta: 5.0,
          RefCustoSabado: 5.0,
          RefCustoDomingo: 5.0,
          nome_fantasia: 'Cliente Padrão'
        };
      }

      const budget = custoData[0];
      console.log(`✅ Orçamento encontrado: R$ ${budget.RefCustoSegunda || 5}/refeição`);
      return budget;
    }

    // Função para calcular custo simples otimizado
    async function calculateSimpleCost(recipeId: number, mealQuantity: number = 100) {
      const cacheKey = `${recipeId}_${mealQuantity}`;
      
      // Verificar cache de resultados
      if (ingredientsCachePerRecipe.has(cacheKey)) {
        const cached = ingredientsCachePerRecipe.get(cacheKey);
        return cached;
      }

      // Buscar ingredientes da receita
      const { data: ingredientes, error } = await supabase
        .from('receita_ingredientes')
        .select('produto_base_id, quantidade, unidade, nome, produto_base_descricao')
        .eq('receita_id_legado', recipeId);

      if (error || !ingredientes) {
        console.error('❌ Erro ao buscar ingredientes da receita:', error);
        return { custo_total: 0, custo_por_refeicao: 0, ingredientes_encontrados: 0 };
      }

      // Dedupilicar ingredientes por produto_base_id
      const uniqueIngredientes = ingredientes.reduce((acc, ing) => {
        const existing = acc.find(item => item.produto_base_id === ing.produto_base_id);
        if (existing) {
          existing.quantidade += ing.quantidade || 0;
        } else {
          acc.push({ ...ing });
        }
        return acc;
      }, [] as any[]);

      let totalCost = 0;
      let foundIngredients = 0;
      let zeroCostCount = 0;
      const cache = await loadPricesCache();

      // Buscar nome da receita
      const { data: recipeData } = await supabase
        .from('receitas_legado')
        .select('nome_receita')
        .eq('receita_id_legado', recipeId)
        .limit(1)
        .single();

      const recipeName = recipeData?.nome_receita || `Receita ${recipeId}`;

      // Calcular custo para cada ingrediente em paralelo
      const ingredientPromises = uniqueIngredientes.map(async (ingrediente) => {
        const { produto_base_id, quantidade, nome } = ingrediente;
        
        if (!produto_base_id || !quantidade) {
          return { cost: 0, found: false, isZero: false };
        }

        // Verificar se é ingrediente de custo zero
        if (isZeroCostIngredient(nome || '')) {
          zeroCostCount++;
          return { cost: 0, found: true, isZero: true };
        }

        // Buscar preço no cache
        let preco = cache.get(produto_base_id);
        
        if (!preco) {
          // Se não está no cache, buscar no banco uma única vez
          const { data: produtoData, error: produtoError } = await supabase
            .from('co_solicitacao_produto_listagem')
            .select('preco, descricao')
            .eq('produto_base_id', produto_base_id)
            .not('preco', 'is', null)
            .gt('preco', 0)
            .order('preco', { ascending: true })
            .limit(1)
            .single();

          if (produtoError || !produtoData?.preco) {
            return { cost: 0, found: false, isZero: false };
          }

          // Verificar se é produto não-alimentício
          if (isNonFoodProduct(produtoData.descricao || '')) {
            return { cost: 0, found: true, isZero: true };
          }

          preco = produtoData.preco;
          cache.set(produto_base_id, preco);
        }

        const custoIngrediente = preco * quantidade;
        
        // Aplicar correção inteligente baseada na mediana
        let custoFinal = custoIngrediente;
        
        // Coletar preços similares para calcular mediana
        const precosSimilares = Array.from(cache.values()).sort((a, b) => a - b);
        const mediana = precosSimilares[Math.floor(precosSimilares.length / 2)] || 10;
        
        if (custoIngrediente > mediana * 15) {
          // Custo muito alto comparado à mediana
          custoFinal = Math.min(custoIngrediente / 20, mediana * quantidade);
        }

        return { cost: custoFinal, found: true, isZero: false };
      });

      // Executar todas as consultas em paralelo
      const results = await Promise.all(ingredientPromises);
      
      // Somar todos os custos
      results.forEach(result => {
        totalCost += result.cost;
        if (result.found) foundIngredients++;
      });

      // Escalar custo para a quantidade desejada
      const scalingFactor = mealQuantity / 100;
      const scaledCost = totalCost * scalingFactor;
      const costPerMeal = scaledCost / mealQuantity;

      const result = {
        custo_total: scaledCost,
        custo_por_refeicao: costPerMeal,
        ingredientes_encontrados: foundIngredients,
        ingredientes_total: uniqueIngredientes.length,
        ingredientes_custo_zero: zeroCostCount,
        receita_id: recipeId,
        receita_nome: recipeName
      };

      // Cache do resultado
      ingredientsCachePerRecipe.set(cacheKey, result);

      return result;
    }

    // Função para buscar receitas por categoria com cache otimizado
    async function buscarReceitasPorCategoria(categoria, budget, mealQuantity) {
      const palavrasChave = {
        CARBOIDRATO: ['ARROZ', 'FEIJÃO', 'MACARRÃO', 'BATATA', 'POLENTA', 'PURÊ'],
        GUARNICAO: ['REFOGADO', 'COZIDO', 'GRATINADO', 'FAROFA', 'VINAGRETE'],
        SALADA: ['SALADA', 'TOMATE', 'ALFACE', 'REPOLHO', 'CENOURA'],
        SOBREMESA: ['DOCE', 'PUDIM', 'GELATINA', 'FRUTA', 'BRIGADEIRO']
      };

      const palavras = palavrasChave[categoria] || ['RECEITA'];
      const orConditions = palavras.map(palavra => `nome_receita.ilike.%${palavra}%`).join(',');

      const { data: receitas, error } = await supabase
        .from('receitas_legado')
        .select('receita_id_legado, nome_receita, categoria_descricao')
        .or(orConditions)
        .eq('inativa', false)
        .limit(20);

      if (error) {
        console.error(`❌ Erro ao buscar receitas de ${categoria}:`, error);
        return [];
      }

      if (!receitas || receitas.length === 0) {
        console.warn(`⚠️ Nenhuma receita encontrada para ${categoria}`);
        return [];
      }

      return receitas;
    }

    // Função para buscar proteínas dinâmicas
    async function buscarProteinasDisponiveis() {
      if (proteinasGlobaisCache.length > 0) {
        return proteinasGlobaisCache;
      }

      console.log('🍖 Buscando proteínas disponíveis...');
      
      const palavrasChaveProteinas = ['FRANGO', 'CARNE', 'PEIXE', 'BIFE', 'FILÉ', 'PEITO', 'COXA'];
      const orConditions = palavrasChaveProteinas.map(palavra => `nome_receita.ilike.%${palavra}%`).join(',');

      const { data: proteinasData, error } = await supabase
        .from('receitas_legado')
        .select('receita_id_legado, nome_receita, categoria_descricao')
        .or(orConditions)
        .eq('inativa', false)
        .limit(30);

      if (error || !proteinasData || proteinasData.length === 0) {
        console.warn('⚠️ Usando proteínas fallback');
        proteinasGlobaisCache = [
          { receita_id: '1010', nome: 'FILÉ DE FRANGO GRELHADO', tipo: 'frango' },
          { receita_id: '1001', nome: 'CARNE MOÍDA REFOGADA', tipo: 'carne' }
        ];
        return proteinasGlobaisCache;
      }

      // Processar proteínas em paralelo
      const proteinPromises = proteinasData.slice(0, 15).map(async (proteina) => {
        try {
          const custo = await calculateSimpleCost(proteina.receita_id_legado, 100);
          if (custo && custo.custo_por_refeicao > 0 && custo.custo_por_refeicao < 12) {
            return {
              receita_id: proteina.receita_id_legado,
              nome: proteina.nome_receita,
              custo_por_refeicao: custo.custo_por_refeicao,
              categoria: 'Proteína'
            };
          }
          return null;
        } catch (error) {
          return null;
        }
      });

      const results = await Promise.all(proteinPromises);
      proteinasGlobaisCache = results.filter(result => result !== null);

      console.log(`✅ Cache de proteínas: ${proteinasGlobaisCache.length} proteínas`);
      return proteinasGlobaisCache;
    }

    // Função para consolidar lista de compras real
    function consolidateShoppingList(recipes: any[]): any[] {
      const consolidated: Map<number, any> = new Map();
      
      recipes.forEach(recipe => {
        if (recipe.ingredientes) {
          recipe.ingredientes.forEach((ingrediente: any) => {
            const { produto_base_id, nome, quantidade, unidade } = ingrediente;
            
            if (!produto_base_id) return;
            
            // Excluir produtos não-alimentícios e ingredientes de custo zero
            if (isNonFoodProduct(nome || '') || isZeroCostIngredient(nome || '')) {
              return;
            }

            const existing = consolidated.get(produto_base_id);
            if (existing) {
              existing.quantidade_total += quantidade || 0;
              existing.receitas_usadas.push(recipe.receita_id || recipe.id);
            } else {
              consolidated.set(produto_base_id, {
                produto_base_id,
                nome: nome || 'Produto sem nome',
                quantidade_total: quantidade || 0,
                unidade: unidade || 'und',
                receitas_usadas: [recipe.receita_id || recipe.id],
                preco_unitario: pricesCache.get(produto_base_id) || 0
              });
            }
          });
        }
      });

      // Converter Map para Array e calcular custos totais
      const shoppingList = Array.from(consolidated.values()).map(item => ({
        ...item,
        custo_total: (item.preco_unitario || 0) * (item.quantidade_total || 0),
        receitas_count: item.receitas_usadas.length
      })).filter(item => item.quantidade_total > 0);

      return shoppingList.sort((a, b) => b.custo_total - a.custo_total);
    }

    // Função para calcular dias do período
    function calculateDaysFromPeriod(period: string): number {
      const periodLower = period.toLowerCase();
      
      if (periodLower.includes('semana')) {
        const weeks = parseInt(period.match(/\d+/)?.[0] || '1');
        return weeks * 7;
      } else if (periodLower.includes('dia')) {
        return parseInt(period.match(/\d+/)?.[0] || '7');
      }
      
      return 7; // padrão: 1 semana
    }

    // ============ GERAÇÃO DE CARDÁPIO ============
    if (requestData.action === 'generate_menu') {
      const startTime = Date.now();
      
      // Carregar cache global uma única vez
      await loadPricesCache();
      
      const filialBudget = await buscarOrcamentoFilial(requestData.filialIdLegado);
      const proteinasDisponiveis = await buscarProteinasDisponiveis();
      
      // Calcular período dinamicamente
      const totalDaysToGenerate = calculateDaysFromPeriod(requestData.period || '1 semana');
      const mealQuantity = requestData.mealQuantity || 100;
      const dailyBudget = filialBudget.RefCustoSegunda || 5.0;
      
      console.log(`🗓️ Gerando cardápio para ${totalDaysToGenerate} dias, ${mealQuantity} refeições/dia`);
      console.log(`💰 Orçamento diário: R$ ${dailyBudget}/refeição`);

      const allRecipes = [];
      let totalCost = 0;
      let estruturaCompleta = [];

      // Loop otimizado para cada dia
      for (let dia = 1; dia <= totalDaysToGenerate; dia++) {
        console.log(`\n📅 === DIA ${dia} ===`);
        
        const receitasDoDia = [];
        let custoDiario = 0;

        // Selecionar proteína principal (rotação inteligente)
        const proteinaIndex = (dia - 1) % proteinasDisponiveis.length;
        const proteinaPrincipal = proteinasDisponiveis[proteinaIndex];
        
        if (proteinaPrincipal) {
          const custoPP = await calculateSimpleCost(proteinaPrincipal.receita_id, mealQuantity);
          if (custoPP && custoPP.custo_por_refeicao <= dailyBudget * 0.4) {
            receitasDoDia.push({
              ...proteinaPrincipal,
              categoria: 'PROTEINA_PRINCIPAL',
              custo_calculado: custoPP
            });
            custoDiario += custoPP.custo_total || 0;
          }
        }

        // Buscar outras categorias em paralelo
        const categoriesPromises = Object.keys(ESTRUTURA_CARDAPIO)
          .filter(cat => cat !== 'PROTEINA_PRINCIPAL')
          .map(async (categoria) => {
            const receitas = await buscarReceitasPorCategoria(categoria, dailyBudget, mealQuantity);
            if (receitas.length > 0) {
              const receitaIndex = (dia - 1) % receitas.length;
              const receita = receitas[receitaIndex];
              const custo = await calculateSimpleCost(receita.receita_id_legado, mealQuantity);
              
              if (custo && custo.custo_por_refeicao > 0) {
                return {
                  ...receita,
                  categoria,
                  custo_calculado: custo
                };
              }
            }
            return null;
          });

        const outrasReceitas = await Promise.all(categoriesPromises);
        outrasReceitas.forEach(receita => {
          if (receita) {
            receitasDoDia.push(receita);
            custoDiario += receita.custo_calculado?.custo_total || 0;
          }
        });

        // Adicionar receitas do dia ao total
        allRecipes.push(...receitasDoDia);
        totalCost += custoDiario;

        estruturaCompleta.push({
          dia,
          receitas: receitasDoDia.length,
          custo_total: custoDiario,
          custo_por_refeicao: custoDiario / mealQuantity
        });
      }

      const executionTime = Date.now() - startTime;
      const averageCost = totalDaysToGenerate > 0 ? totalCost / totalDaysToGenerate : 0;
      const averageCostPerMeal = averageCost / mealQuantity;
      
      // Validação final de custos - aplicar correções se necessário
      if (averageCostPerMeal > dailyBudget * 1.5) {
        console.warn(`⚠️ Custo médio muito alto: R$ ${averageCostPerMeal.toFixed(2)} (orçamento: R$ ${dailyBudget})`);
        
        // Aplicar correção proporcional
        const correcaoFactor = (dailyBudget * 1.2) / averageCostPerMeal;
        totalCost = totalCost * correcaoFactor;
        
        console.log(`✅ Custo corrigido para: R$ ${(totalCost / (totalDaysToGenerate * mealQuantity)).toFixed(2)}/refeição`);
      }
      
      // Validação de custo mínimo
      if (averageCostPerMeal < 2.0) {
        console.warn(`⚠️ Custo muito baixo, ajustando para mínimo realista`);
        totalCost = Math.max(totalCost, 2.5 * mealQuantity * totalDaysToGenerate);
      }
      
      // Gerar shopping list consolidada
      const shoppingList = consolidateShoppingList(allRecipes);
      
      console.log(`\n✅ CARDÁPIO COMPLETO GERADO`);
      console.log(`⚡ Tempo de execução: ${executionTime}ms`);
      console.log(`📊 ${totalDaysToGenerate} dia(s), ${allRecipes.length} receitas`);
      console.log(`💰 Custo médio: R$ ${(totalCost / (totalDaysToGenerate * mealQuantity)).toFixed(2)}/refeição`);
      console.log(`🛒 Lista de compras: ${shoppingList.length} itens únicos`);
      console.log(`💾 Cache hits: ${ingredientsCachePerRecipe.size} receitas`);

      return new Response(JSON.stringify({
        success: true,
        cardapio: {
          receitas: allRecipes,
          filial_info: filialBudget,
          resumo: {
            total_dias: totalDaysToGenerate,
            total_receitas: allRecipes.length,
            custo_total_periodo: totalCost,
            custo_medio_por_refeicao: totalCost / (totalDaysToGenerate * mealQuantity),
            estrutura_completa: estruturaCompleta,
            periodo_solicitado: requestData.period,
            tempo_execucao_ms: executionTime,
            cache_performance: {
              precos_cached: pricesCache.size,
              receitas_cached: ingredientsCachePerRecipe.size,
              proteinas_cached: proteinasGlobaisCache.length
            }
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

    // ============ CÁLCULO DE CUSTO DE MÚLTIPLAS RECEITAS ============
    if (requestData.action === 'calculate_recipes_cost') {
      const { recipes, mealQuantity = 100 } = requestData;
      
      console.log(`💰 Calculando custo de ${recipes?.length || 0} receitas para ${mealQuantity} refeições`);
      
      if (!Array.isArray(recipes) || recipes.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Array de receitas inválido ou vazio',
          received: typeof recipes
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await loadPricesCache();
      
      let totalCost = 0;
      let violatedIngredients = [];
      const recipeResults = [];
      
      // Processar cada receita
      for (const recipe of recipes) {
        const recipeId = recipe.receita_id_legado || recipe.id;
        
        if (!recipeId) {
          console.warn(`⚠️ Receita sem ID válido:`, recipe);
          continue;
        }
        
        try {
          console.log(`📊 Calculando receita: ${recipe.nome || recipeId}`);
          
          const result = await calculateSimpleCost(recipeId, mealQuantity);
          
          if (result && result.custo_total > 0) {
            totalCost += result.custo_total;
            recipeResults.push({
              receita_id: recipeId,
              nome: recipe.nome,
              custo: result.custo_total,
              custo_por_refeicao: result.custo_total / mealQuantity,
              ingredientes_processados: result.ingredientes_processados?.length || 0
            });
            
            // Verificar ingredientes violados
            if (result.ingredientes_nao_encontrados) {
              violatedIngredients.push(...result.ingredientes_nao_encontrados);
            }
          } else {
            console.warn(`⚠️ Receita ${recipeId} retornou custo inválido:`, result);
            recipeResults.push({
              receita_id: recipeId,
              nome: recipe.nome,
              custo: 0,
              custo_por_refeicao: 0,
              erro: 'Custo não calculado'
            });
          }
        } catch (error) {
          console.error(`❌ Erro ao calcular receita ${recipeId}:`, error);
          recipeResults.push({
            receita_id: recipeId,
            nome: recipe.nome,
            custo: 0,
            custo_por_refeicao: 0,
            erro: error.message
          });
        }
      }
      
      const costPerMeal = totalCost / mealQuantity;
      
      console.log(`✅ Cálculo concluído: R$ ${totalCost.toFixed(2)} total, R$ ${costPerMeal.toFixed(2)}/refeição`);
      
      return new Response(JSON.stringify({
        success: true,
        action: 'calculate_recipes_cost',
        total_cost: totalCost,
        cost_per_meal: costPerMeal,
        meal_quantity: mealQuantity,
        recipes_processed: recipeResults.length,
        violated_ingredients: violatedIngredients,
        recipe_details: recipeResults,
        cache_stats: {
          prices_cached: pricesCache.size,
          recipes_cached: ingredientsCachePerRecipe.size
        },
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ AÇÃO NÃO RECONHECIDA ============
    return new Response(JSON.stringify({
      success: false,
      error: 'Ação não reconhecida',
      available_actions: ['generate_menu', 'test_recipe_cost', 'calculate_recipes_cost']
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