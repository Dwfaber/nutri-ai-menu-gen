// index.ts - VERSÃO COM REGRAS DA NUTRICIONISTA v4.0

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// ========== CONFIGURAÇÕES DA NUTRICIONISTA ==========
// const STANDARD_PROTEIN_GRAMS = 120; // REMOVIDO - agora configurable por cliente

const PROTEIN_TYPES: Record<string, string[]> = {
  "Carne Vermelha": ["carne bovina", "boi", "coxão", "acém", "maminha", "alcatra", "patinho", "carne moída", "hambúrguer", "almôndega", "almondega", "bife", "costela", "picanha", "suína", "porco", "lombo", "strogonoff", "estrogonofe", "iscas", "rabada", "cozido", "pernil", "bisteca", "cupim", "cassoulet"],
  "Frango": ["frango", "galinha", "peito", "coxa", "asa", "chester"],
  "Peixe": ["peixe", "tilápia", "salmão", "sardinha", "bacalhau", "pescada", "merluza"],
  "Ovo": ["ovo", "omelete", "fritada", "mexido"],
  "Vegetariano": ["soja", "lentilha", "grão-de-bico", "ervilha", "feijão branco", "vegetariano", "vegano", "proteína de soja", "quinoa"]
};

// ================= CORREÇÕES ESTRUTURAIS ADICIONADAS =================

// Limite semanal de proteínas
const LIMITE_PROTEINAS_SEMANA = { 
  "Carne Vermelha": 2, 
  "Frango": 2, 
  "Peixe": 2, 
  "Ovo": 1, 
  "Vegetariano": 1 
};

let contadorProteinas = {
  "Carne Vermelha": 0, 
  "Frango": 0, 
  "Peixe": 0, 
  "Ovo": 0, 
  "Vegetariano": 0
};

// ESTRUTURA COM 10 CATEGORIAS (INCLUINDO GUARNIÇÃO)
const ESTRUTURA_CARDAPIO = {
  PP1: { categoria: 'Proteína Principal 1', budget_percent: 22 },
  PP2: { categoria: 'Proteína Principal 2', budget_percent: 18 },
  ARROZ: { categoria: 'Arroz Branco', budget_percent: 12, receita_id: 580 },
  FEIJAO: { categoria: 'Feijão', budget_percent: 12, receita_id: 1600 },
  GUARNICAO: { categoria: 'Guarnição', budget_percent: 10 },
  SALADA1: { categoria: 'Salada 1 (Verduras)', budget_percent: 8 },
  SALADA2: { categoria: 'Salada 2 (Legumes)', budget_percent: 8 },
  SOBREMESA: { categoria: 'Sobremesa', budget_percent: 2 }
};

// ========== LISTAS MESTRE DE SUCOS ==========
const SUCOS_PRO_MIX = ["Pro Mix Laranja", "Pro Mix Goiaba", "Pro Mix Manga", "Pro Mix Uva", "Pro Mix Maracujá"];
const SUCOS_DIET = ["Diet Uva", "Diet Maracujá", "Diet Laranja", "Diet Limão"];
const SUCOS_NATURAIS = ["Suco Natural Laranja", "Suco Natural Limão", "Suco Natural Maracujá", "Suco Natural Goiaba"];
const SUCOS_VITA = ["Vita Suco Caju", "Vita Suco Acerola", "Vita Suco Manga", "Vita Suco Uva"];

const SOBREMESAS = [
  "Fruta da estação",
  "Gelatina colorida",
  "Mousse de maracujá",
  "Bolo simples",
  "Salada de frutas"
];

// ========== FUNÇÕES HELPER PARA SUCOS ==========

// Helper => escolhe 2 diferentes do pool
function sampleTwoDistinct(pool: string[]): [string, string] {
  if (pool.length < 2) {
    return [pool[0], pool[0]]; // fallback se só existir 1 no grupo
  }
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return [shuffled[0], shuffled[1]];
}

// Função para escolher os 2 sucos do dia
function escolherSucosDia(juiceConfig: any): [string, string] {
  if (!juiceConfig) return ["Suco Natural Laranja", "Suco Natural Maracujá"];

  const grupos = [];
  if (juiceConfig.use_pro_mix) grupos.push(SUCOS_PRO_MIX);
  if (juiceConfig.use_pro_vita) grupos.push(SUCOS_VITA);
  if (juiceConfig.use_suco_diet) grupos.push(SUCOS_DIET);
  if (juiceConfig.use_suco_natural) grupos.push(SUCOS_NATURAIS);

  if (grupos.length === 0) return sampleTwoDistinct(SUCOS_NATURAIS);

  if (grupos.length === 1) return sampleTwoDistinct(grupos[0]);

  // Se mais de um grupo foi marcado → mistura
  const pool = grupos.flat();
  return sampleTwoDistinct(pool);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
  return new Response(
    JSON.stringify({ 
      status: 'healthy', 
      version: 'ESTRUTURAL-FINAL-v4.0',
      timestamp: new Date().toISOString() 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
  }

  try {
    const startTime = Date.now();
    const requestData = await req.json();
    
    console.log('📥 REQUEST:', requestData.action, requestData.filialIdLegado || 'sem filial');
    console.log('🔍 CLIENT_ID DEBUG:', {
      client_id: requestData.client_id,
      clientId: requestData.clientId, 
      filial_id: requestData.filial_id,
      filialIdLegado: requestData.filialIdLegado
    });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ========== FUNÇÕES DE CONTROLE DA NUTRICIONISTA ==========
    
    // Identifica tipo da proteína baseado no nome (EXPANDIDO COM LOGGING)
    function getProteinType(name: string): string | null {
      const nomeLower = name.toLowerCase();
      console.log(`🔍 Analisando proteína: "${name}" → "${nomeLower}"`);
      
      for (const [tipo, palavras] of Object.entries(PROTEIN_TYPES)) {
        const match = palavras.find(p => nomeLower.includes(p));
        if (match) {
          console.log(`✅ Proteína "${name}" classificada como "${tipo}" (match: "${match}")`);
          return tipo;
        }
      }
      
      console.log(`❌ "${name}" rejeitada para proteína (sem proteína detectada)`);
      return null;
    }

    // Corrigir inferência PP1 vs PP2 e validação rigorosa
    function inferirCategoria(nome: string): string {
      const nomeUpper = nome.toUpperCase();
      const lower = nome.toLowerCase();
      
      // 1. PROTEÍNA
      if (getProteinType(nome)) {
        if (/(filé|bife|cox|peito|assado|grelhado|costela|cupim|ensopado|almôndega|almondega|pernil|acém|strogonoff|estrogonofe|cozido|rabada|iscas)/.test(lower)) {
          return 'Proteína Principal 1';
        }
        return 'Proteína Principal 2';
      }

      // 2. ARROZ
      if (lower.includes("arroz")) return "Arroz Branco";

      // 3. FEIJÃO
      if (lower.includes("feijão") || lower.includes("feijao")) return "Feijão";

      // 4. SUCOS
      if (/(suco|refresco|bebida)/.test(lower)) return "Suco 1";

      // 5. SOBREMESAS
      if (/(bolo|pudim|mousse|doce|fruta|gelatina|sobremesa|brigadeiro|torta)/.test(lower)) {
        return "Sobremesa";
      }

      // 6. Salada 2 (Legumes e maionese)
      if (/(abóbora|abobora|cenoura|beterraba|chuchu|macarronese|maionese|colorida|salada russa|salada mista)/.test(lower)) {
        return "Salada 2 (Legumes)";
      }

      // 7. Salada 1 (Verduras frescas)
      if (/(alface|rúcula|couve|espinafre|folha|verdura|agrião|acelga|almeirão)/.test(lower)) {
        return "Salada 1 (Verduras)";
      }

      // 8. Guarnição (sem carne)
      if (/(batata|mandioca|purê|polenta|farofa|macarrão|nhoque|refogado|escondidinho|quiche|lasanha)/.test(lower)) {
        return "Guarnição";
      }

      return "Guarnição";
    }

    // Fallback para categorias vazias
    function fallbackReceita(categoria: string) {
      switch (categoria) {
        case "Salada 1 (Verduras)": return { id: -1, nome: "Salada de folhas simples", custo_por_refeicao: 0.5 };
        case "Salada 2 (Legumes)": return { id: -2, nome: "Salada de legumes cozidos", custo_por_refeicao: 0.6 };
        case "Suco 1": return { id: -3, nome: "Suco de laranja natural", custo_por_refeicao: 0.4 };
        case "Suco 2": return { id: -4, nome: "Suco de uva", custo_por_refeicao: 0.4 };
        case "Sobremesa": 
          const idx = Math.floor(Math.random() * SOBREMESAS.length);
          return { id: -5, nome: SOBREMESAS[idx], custo_por_refeicao: 0.5 };
        default: return null;
      }
    }

    // Escolha de proteína com validação rigorosa usando tabela estruturada
    async function escolherProteina(categoria: string, receitasPool: any[], mealQuantity: number) {
      // NOVO: Primeiro tentar com tabela estruturada de proteínas
      if (proteinasDisponiveis) {
        for (let tentativa = 0; tentativa < 10; tentativa++) {
          const proteinaIndex = Math.floor(Math.random() * proteinasDisponiveis.length);
          const proteinaEstruturada = proteinasDisponiveis[proteinaIndex];
          
          const tipo = getProteinType(proteinaEstruturada.nome);
          if (tipo && contadorProteinas[tipo] < LIMITE_PROTEINAS_SEMANA[tipo]) {
            console.log(`✅ Proteína estruturada selecionada: ${proteinaEstruturada.nome} (${tipo})`);
            contadorProteinas[tipo]++;
            
            const custo = await calculateSimpleCost(proteinaEstruturada.receita_id_legado, mealQuantity);
            return {
              id: proteinaEstruturada.receita_id_legado,
              nome: proteinaEstruturada.nome,
              categoria: categoria,
              custo_por_refeicao: custo.custo_por_refeicao || 2.5
            };
          }
        }
      }

      // FALLBACK: Usar pool original com validação
      for (let tentativa = 0; tentativa < 10; tentativa++) {
        const receita = escolherReceita(categoria, receitasPool);
        if (!receita) break;
        
        const custo = await calculateSimpleCost(receita.id, mealQuantity);
        const tipo = getProteinType(receita.nome);

        if (tipo && contadorProteinas[tipo] < LIMITE_PROTEINAS_SEMANA[tipo]) {
          console.log(`✅ Proteína pool selecionada: ${receita.nome} (${tipo})`);
          contadorProteinas[tipo]++;
          return { ...receita, custo_por_refeicao: custo.custo_por_refeicao, nome: custo.nome };
        }
      }
      
      // FALLBACK CRÍTICO: Sempre retornar pelo menos uma proteína
      console.log('⚠️ FALLBACK CRÍTICO: Nenhuma proteína encontrada, usando fallback');
      return {
        id: '2000', // ID fixo para fallback
        nome: 'FRANGO GRELHADO',
        categoria: categoria,
        custo_por_refeicao: 3.0
      };
    }

    // Valida categoria para não cruzar (ex: sobremesa != frango) - FILTRO RIGOROSO
    function validarCategoriaReceita(receita: any, categoria: string): boolean {
      const nome = receita.nome?.toLowerCase() || receita.name?.toLowerCase() || '';
      
      if (categoria === "Guarnição") {
        // CORREÇÃO CRÍTICA: Verificar se é proteína usando tabela estruturada
        if (getProteinType(nome)) {
          console.log(`❌ ${receita.nome} rejeitada para guarnição (é proteína)`);
          return false;
        }
        
        // NOVO: Verificar se está na tabela de guarnições estruturada
        if (guarnicoesDisponiveis) {
          const isGuarnicao = guarnicoesDisponiveis.some(g => 
            g.nome.toLowerCase().includes(nome) || nome.includes(g.nome.toLowerCase())
          );
          if (!isGuarnicao) {
            console.log(`❌ ${receita.nome} rejeitada - não está na tabela de guarnições`);
            return false;
          }
        }
      }
      
      if (categoria.includes("sobremesa") || categoria.includes("Sobremesa")) {
        // Sobremesa RIGOROSA: rejeita qualquer prato salgado/proteína/massa
        if (/(carne|frango|peixe|ovo|arroz|feijão|massa|macarrão|nhoque|lasanha|strogonoff|hamburguer|proteína|sal)/.test(nome)) {
          console.log(`❌ ${receita.nome} rejeitada para sobremesa`);
          return false;
        }
      }
      
      if (categoria.includes("suco") || categoria.includes("Suco")) {
        // Suco NÃO pode ter salada
        if (["salada","alface","tomate","pepino"].some(w => nome.includes(w))) {
          console.log(`❌ ${receita.nome} rejeitada para suco (contém salada)`);
          return false;
        }
      }
      
      if (categoria.includes("salada") || categoria.includes("Salada")) {
        // Salada NÃO pode ter suco
        if (["suco","refresco","bebida"].some(w => nome.includes(w))) {
          console.log(`❌ ${receita.nome} rejeitada para salada (contém suco)`);
          return false;
        }
      }
      
      if (categoria.includes("Proteína")) {
        // Proteína DEVE ter proteína
        const tipoProteina = getProteinType(nome);
        if (!tipoProteina) {
          console.log(`❌ ${receita.nome} rejeitada para proteína (sem proteína detectada)`);
          return false;
        }
      }
      
      return true;
    }

    // Função de escolha com variedade
    function escolherReceita(categoria: string, pool: any[], receitasUsadas: string[] = []) {
      const lista = pool.filter(r => {
        const validCategoria = r.categoria === categoria || r.category === categoria;
        const naoUsada = !receitasUsadas.includes(r.nome || r.name);
        const categoriaValida = validarCategoriaReceita(r, categoria);
        return validCategoria && naoUsada && categoriaValida;
      });
      
      if (!lista.length) {
        // Fallback: ignora "já usado" mas mantém validação de categoria
        const listaFallback = pool.filter(r => {
          const validCategoria = r.categoria === categoria || r.category === categoria;
          const categoriaValida = validarCategoriaReceita(r, categoria);
          return validCategoria && categoriaValida;
        });
        
        if (listaFallback.length > 0) {
          const idx = Math.floor(Math.random() * listaFallback.length);
          return { ...listaFallback[idx] };
        }
        return null;
      }
      
      const idx = Math.floor(Math.random() * lista.length);
      return { ...lista[idx] };
    }

    // FUNÇÃO AUXILIAR PARA DETECTAR E CORRIGIR UNIDADES
    function detectarUnidadeProduto(descricao) {
      const desc = descricao.toUpperCase();
      
      // Padrões comuns de produtos
      const padroes = [
        { regex: /OVOS?\s*(\d+)/, unidade: 'UN', divisor: 1 },
        { regex: /(\d+)\s*UN/, unidade: 'UN', divisor: 1 },
        { regex: /(\d+)\s*KG/, unidade: 'KG', divisor: 1 },
        { regex: /(\d+)\s*G(?:R|RAMA)?/, unidade: 'KG', divisor: 1000 },
        { regex: /(\d+)\s*L(?:T|ITRO)?/, unidade: 'L', divisor: 1 },
        { regex: /(\d+)\s*ML/, unidade: 'L', divisor: 1000 },
      ];
      
      for (const padrao of padroes) {
        const match = desc.match(padrao.regex);
        if (match) {
          return {
            quantidade: parseFloat(match[1]) / padrao.divisor,
            unidade: padrao.unidade
          };
        }
      }
      
      return { quantidade: 1, unidade: 'UN' };
    }

    // FUNÇÃO CORRIGIDA PARA CÁLCULO DE CUSTOS
    async function calculateSimpleCost(recipeId, mealQuantity = 100) {
      try {
        const { data: ingredients, error } = await supabase
          .from('receita_ingredientes')
          .select('*')
          .eq('receita_id_legado', recipeId)
          .limit(20);
        
        if (error || !ingredients || ingredients.length === 0) {
          return { id: recipeId, nome: `Receita ${recipeId}`, custo: 0, custo_por_refeicao: 0 };
        }
        
        const recipeName = ingredients[0].nome;
        const baseQuantity = parseInt(ingredients[0].quantidade_refeicoes) || 100;
        
        console.log(`📦 ${recipeName}: ${ingredients.length} ingredientes para ${baseQuantity} porções base`);
        
        // Buscar preços
        const productIds = ingredients
          .map(i => i.produto_base_id)
          .filter(id => id && Number(id) > 0);
        
        // CORREÇÃO: Buscar preços sempre atualizados, não cache
        const { data: prices, error: pricesError } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('*')
          .in('produto_base_id', productIds)
          .gt('preco', 0)
          .order('criado_em', { ascending: false }); // MAIS RECENTE PRIMEIRO

        if (pricesError) {
          console.error('❌ Erro ao buscar preços:', pricesError.message);
          return { custo_por_refeicao: 0, nome: 'Erro no cálculo' };
        }
        
        let totalCost = 0;
        const ingredientesCalculados = [];
        
        for (const ingredient of ingredients) {
          const price = prices?.find(p => Number(p.produto_base_id) === Number(ingredient.produto_base_id));
          
          if (price && ingredient.quantidade) {
            let qty = parseFloat(ingredient.quantidade) || 0;
            const unitPrice = parseFloat(price.preco) || 0;
            const unidade = (ingredient.unidade || '').toUpperCase();
            
            // ========== CORREÇÃO CRÍTICA DE UNIDADES ==========
            let itemCost = 0;
            
            // NORMALIZAR QUANTIDADE PARA UNIDADE PADRÃO
            let quantidadeNormalizada = qty;
            let unidadeNormalizada = unidade;
            
            // Converter tudo para unidade base (KG para peso, L para volume)
            switch(unidade) {
              case 'GR':
              case 'G':
              case 'GRAMA':
              case 'GRAMAS':
                quantidadeNormalizada = qty / 1000; // Converter para KG
                unidadeNormalizada = 'KG';
                break;
                
              case 'MG':
                quantidadeNormalizada = qty / 1000000; // Converter para KG
                unidadeNormalizada = 'KG';
                break;
                
              case 'ML':
                quantidadeNormalizada = qty / 1000; // Converter para L
                unidadeNormalizada = 'L';
                break;
                
              case 'KG':
              case 'KILO':
              case 'QUILO':
                quantidadeNormalizada = qty;
                unidadeNormalizada = 'KG';
                break;
                
              case 'L':
              case 'LT':
              case 'LITRO':
                quantidadeNormalizada = qty;
                unidadeNormalizada = 'L';
                break;
                
              case 'UN':
              case 'UND':
              case 'UNIDADE':
                quantidadeNormalizada = qty;
                unidadeNormalizada = 'UN';
                break;
                
              default:
                quantidadeNormalizada = qty;
                unidadeNormalizada = unidade;
            }
            
            // CALCULAR CUSTO BASEADO NA DESCRIÇÃO DO PRODUTO
            const descricaoProduto = (price.descricao || '').toUpperCase();
            
            // Identificar unidade e quantidade do produto no mercado
            let quantidadeProduto = 1;
            let unidadeProduto = unidadeNormalizada;
            
            // Regex para extrair quantidade da descrição (ex: "OVOS 30 UNIDADES", "ARROZ 5KG")
            const matchQuantidade = descricaoProduto.match(/(\d+(?:\.\d+)?)\s*(KG|G|L|ML|UN|UND|UNIDADE)/);
            if (matchQuantidade) {
              quantidadeProduto = parseFloat(matchQuantidade[1]);
              const unidadeDesc = matchQuantidade[2];
              
              // Normalizar unidade do produto
              if (unidadeDesc === 'G' || unidadeDesc === 'GR') {
                quantidadeProduto = quantidadeProduto / 1000; // Converter para KG
                unidadeProduto = 'KG';
              } else if (unidadeDesc === 'ML') {
                quantidadeProduto = quantidadeProduto / 1000; // Converter para L
                unidadeProduto = 'L';
              }
            }
            
            // CÁLCULO CORRETO DO CUSTO
            if (unidadeNormalizada === unidadeProduto) {
              // Mesma unidade - cálculo direto
              itemCost = (quantidadeNormalizada / quantidadeProduto) * unitPrice;
            } else {
              // Unidades diferentes - fazer conversão ou usar fallback
              itemCost = quantidadeNormalizada * unitPrice;
              
              // Aplicar correção para casos específicos
              if (ingredient.produto_base_descricao?.includes('OVO')) {
                // Ovos geralmente vêm em cartelas de 30
                if (unitPrice > 100 && qty <= 200) {
                  itemCost = (qty / 30) * unitPrice; // qty ovos / 30 ovos por cartela
                }
              }
            }
            
            // ========== VALIDAÇÃO DE SANIDADE ==========
            // Se o custo de um ingrediente for maior que R$ 50 para 100 porções, provavelmente há erro
            const custoMaximoAceitavel = 50;
            
            if (itemCost > custoMaximoAceitavel) {
              console.warn(`⚠️ Custo suspeito para ${ingredient.produto_base_descricao}: R$${itemCost.toFixed(2)}`);
              
              // Aplicar correções automáticas baseadas em padrões conhecidos
              if (itemCost > 1000) {
                // Provavelmente erro de escala grave
                itemCost = itemCost / 100;
                console.log(`  🔧 Aplicada correção /100: R$${itemCost.toFixed(2)}`);
              } else if (itemCost > 100) {
                // Provavelmente erro de escala médio
                itemCost = itemCost / 10;
                console.log(`  🔧 Aplicada correção /10: R$${itemCost.toFixed(2)}`);
              }
            }
            
            totalCost += itemCost;
            
            ingredientesCalculados.push({
              nome: ingredient.produto_base_descricao,
              quantidade: qty,
              unidade: ingredient.unidade,
              quantidade_normalizada: quantidadeNormalizada,
              unidade_normalizada: unidadeNormalizada,
              preco_unitario: unitPrice,
              custo_item: itemCost,
              produto_mercado: price.descricao
            });
            
            // Log apenas se custo for razoável
            if (itemCost <= custoMaximoAceitavel) {
              console.log(`  ✅ ${ingredient.produto_base_descricao}: ${qty}${ingredient.unidade} = R$${itemCost.toFixed(2)}`);
            }
          }
        }
        
        // Calcular custo por porção
        const costPerServing = totalCost / baseQuantity;
        
        // Escalar para quantidade solicitada
        const scaleFactor = mealQuantity / baseQuantity;
        const scaledTotalCost = totalCost * scaleFactor;
        
        console.log(`💰 Custo base: R$${totalCost.toFixed(2)} para ${baseQuantity} porções`);
        console.log(`💰 Custo total: R$${scaledTotalCost.toFixed(2)} para ${mealQuantity} porções`);
        console.log(`💰 Custo por porção: R$${costPerServing.toFixed(2)}`);
        
        // VALIDAÇÃO FINAL
        if (costPerServing > 20) {
          console.error(`❌ CUSTO POR PORÇÃO MUITO ALTO: R$${costPerServing.toFixed(2)}`);
          console.log(`🔧 Aplicando correção de emergência...`);
          
          // Forçar custo máximo de R$ 10 por porção
          const custoCorrigido = Math.min(costPerServing, 10);
          
          return {
            id: recipeId,
            nome: recipeName,
            custo: scaledTotalCost * (custoCorrigido / costPerServing),
            custo_por_refeicao: custoCorrigido,
            custo_total_receita: totalCost * (custoCorrigido / costPerServing),
            porcoes_base: baseQuantity,
            porcoes_solicitadas: mealQuantity,
            ingredientes: ingredientesCalculados,
            aviso: 'Custo ajustado devido a valores anormais'
          };
        }
        
        return {
          id: recipeId,
          nome: recipeName,
          custo: scaledTotalCost,
          custo_por_refeicao: costPerServing,
          custo_total_receita: totalCost,
          porcoes_base: baseQuantity,
          porcoes_solicitadas: mealQuantity,
          ingredientes: ingredientesCalculados,
          ingredientes_total: ingredients.length,
          ingredientes_com_preco: ingredientesCalculados.length
        };
        
      } catch (error) {
        console.error(`❌ Erro ao calcular receita ${recipeId}:`, error);
        return { id: recipeId, nome: `Erro`, custo: 0, custo_por_refeicao: 0 };
      }
    }

    // FUNÇÃO PARA BUSCAR ORÇAMENTO
    async function buscarOrcamentoFilial(filialId) {
      console.log(`💰 Buscando orçamento para filial ${filialId}`);
      
      try {
        const { data, error } = await supabase
          .from('custos_filiais')
          .select('*')
          .eq('filial_id', filialId)
          .single();
        
        console.log("CUSTOS FILIAL:", data, error);
        
        if (error || !data) {
          console.warn(`⚠️ Filial ${filialId} sem dados de custo, tentando buscar contrato...`);
          
          // Buscar contrato como fallback
          const { data: contratoData, error: contratoError } = await supabase
            .from('contratos_corporativos')
            .select('*')
            .eq('filial_id_legado', filialId)
            .single();
          
          console.log("CONTRATO:", contratoData, contratoError);
          
        if (contratoData) {
          return { 
            custo_diario: 9.00, 
            nome_filial: contratoData.nome_fantasia,
            protein_grams_pp1: contratoData.protein_grams_pp1,
            protein_grams_pp2: contratoData.protein_grams_pp2
          };
        }
          
          return { custo_diario: 9.00 };
        }
        
        const custoMedio = data.custo_medio_semanal ? 
          (data.custo_medio_semanal / 7) : 
          (data.RefCustoSegunda || 9.00);
        
        console.log(`✅ Filial ${filialId} (${data.nome_fantasia}): R$ ${custoMedio.toFixed(2)}/dia`);
        
        return {
          custo_diario: custoMedio,
          nome_filial: data.nome_fantasia || data.razao_social,
          protein_grams_pp1: 100, // Default from custos_filiais
          protein_grams_pp2: 90   // Default from custos_filiais
        };
        
      } catch (error) {
        console.error('❌ Erro ao buscar orçamento:', error);
        return { custo_diario: 9.00 };
      }
    }

    // FUNÇÃO PARA BUSCAR RECEITAS COM VARIAÇÃO (com fallback inteligente)
    async function buscarReceitaComVariacao(categoria, budget, mealQuantity, diaIndex = 0) {
      console.log(`🔍 Buscando ${categoria} (dia ${diaIndex + 1}) - orçamento R$${budget.toFixed(2)}`);

      const palavrasChave = {
        'Proteína Principal 1': [
          'FRANGO', 'CARNE', 'BOVINA', 'PEIXE', 'SUÍNO',
          'FILÉ', 'PEITO', 'COXA', 'ASSADO', 'ENSOPADO', 'GRELHADO',
          'BIFE', 'COSTELA', 'CHURRASCO'
        ],
        'Proteína Principal 2': [
          'LINGUIÇA', 'SALSICHA', 'HAMBURGUER', 'ALMÔNDEGA',
          'OVO', 'OMELETE', 'FRITADA', 'FRANGO DESFIADO',
          'CARNE MOÍDA', 'KAFTA', 'ISCAS', 'STROGONOFF'
        ],
        'Guarnição': [
          'BATATA', 'MANDIOCA', 'AIPIM', 'MACAXEIRA', 'INHAME',
          'PURÊ', 'FAROFA', 'POLENTA', 'MANDIOQUINHA', 'BATATA DOCE',
          'ESCONDIDINHO', 'TORTA', 'QUICHE', 'LASANHA',
          'GRATINADO', 'REFOGADO', 'LEGUMES', 'ACOMPANHAMENTO',
          'MACARRÃO', 'MASSA'
        ],
        'Salada 1 (Verduras)': [
          'SALADA', 'ALFACE', 'ACELGA', 'COUVE', 'FOLHAS',
          'RÚCULA', 'ESPINAFRE', 'AGRIAO'
        ],
        'Salada 2 (Legumes)': [
          'TOMATE', 'PEPINO', 'CENOURA', 'ABOBRINHA',
          'BETERRABA', 'CHUCHU', 'LEGUME'
        ],
        'Suco 1': [
          'SUCO DE LARANJA', 'SUCO DE LIMAO', 'REFRESCO',
          'SUCO DE MARACUJA', 'SUCO DE ABACAXI'
        ],
        'Suco 2': [
          'SUCO DE GOIABA', 'AGUA SABORIZADA', 'SUCO TROPICAL',
          'SUCO DE UVA', 'SUCO DE MELANCIA'
        ],
        'Sobremesa': [
          'BOLO', 'PUDIM', 'MOUSSE', 'COMPOTA', 'DOCE',
          'GELATINA', 'FRUTA', 'CREME', 'TORTA', 'SORVETE',
          'BRIGADEIRO', 'BEIJINHO', 'COCADA'
        ]
      };

      // Keywords para a categoria
      const keywords = palavrasChave[categoria] || [categoria];

      let receitas = [];
      try {
        // 1) Tenta buscar receitas usando todas as keywords (OR)
        const { data } = await supabase
          .from('receita_ingredientes')
          .select('receita_id_legado, nome')
          .or(keywords.map(k => `nome.ilike.%${k}%`).join(','))
          .limit(25);

        receitas = data || [];

        // 2) Fallback: se não encontrou nada, pega qualquer receita
        if (!receitas.length) {
          console.warn(`⚠️ Nenhuma receita encontrada para ${categoria}, usando fallback geral...`);
          const { data: fallback } = await supabase
            .from('receita_ingredientes')
            .select('receita_id_legado, nome')
            .limit(30);
          receitas = fallback || [];
        }

        // Remove duplicadas
        const receitasUnicas = [...new Map(receitas.map(r => [r.receita_id_legado, r])).values()];
        if (!receitasUnicas.length) return null;

        // Pula algumas para variar entre dias
        const startIndex = diaIndex % receitasUnicas.length;

        // Testa até 5 receitas candidatas
        for (let i = 0; i < Math.min(5, receitasUnicas.length); i++) {
          const index = (startIndex + i) % receitasUnicas.length;
          const receita = receitasUnicas[index];

          const custo = await calculateSimpleCost(receita.receita_id_legado, mealQuantity);

          if (custo.custo_por_refeicao > 0 && custo.custo_por_refeicao <= budget) {
            console.log(`  ✅ Selecionada: ${custo.nome} - R$${custo.custo_por_refeicao.toFixed(2)}`);
            return custo;
          }
        }

        // Último fallback: devolve a primeira viável mesmo acima do budget
        const receitaFallback = receitasUnicas[0];
        if (receitaFallback) {
          const custo = await calculateSimpleCost(receitaFallback.receita_id_legado, mealQuantity);
          console.log(`  ⚠️ Usando fallback sem respeitar budget: ${custo.nome} - R$${custo.custo_por_refeicao.toFixed(2)}`);
          return custo;
        }

        return null;

      } catch (error) {
        console.error(`❌ Erro ao buscar ${categoria}:`, error);
        return null;
      }
    }

    // ========== FUNÇÃO PRINCIPAL DE GERAÇÃO COM REGRAS ==========
    async function gerarCardapioComRegras(config: {
      budget: number,
      mealQuantity: number,
      numDays: number,
      periodo: string,
      diasUteis: boolean,
      supabase: any,
      gramsPP1: number,
      gramsPP2: number
    }, budget: number, origemOrcamento: string) {
      const { mealQuantity, numDays, periodo, diasUteis, supabase, gramsPP1, gramsPP2 } = config;
      
      // NOVO: Usar configurações do cliente carregadas anteriormente
      console.log('🔧 Gramagem configurada:', { proteinGramsPP1, proteinGramsPP2 });
      console.log('🧃 Configuração de sucos:', juiceConfig);
      
    let totalDias = periodo === "quinzena" ? 14 : Math.min(numDays, 7);
    
    // Se for apenas dias úteis, ajusta para não contar sábado e domingo
    if (diasUteis) {
      totalDias = Math.min(totalDias, 5);
    }
      const startDate = new Date(requestData.startDate || Date.now());
      let diaAtual = new Date(startDate);
      let cardapioPorDia = [];
      let contadorCarnesVermelhas = 0;
      let guarnicoesUsadas: string[] = [];
      let receitasPool: any[] = [];

      // Resetar contadores de proteínas para nova geração
      contadorProteinas = {
        "Carne Vermelha": 0, 
        "Frango": 0, 
        "Peixe": 0, 
        "Ovo": 0, 
        "Vegetariano": 0
      };
      
      // Buscar todas as receitas disponíveis
      console.log('🔍 Carregando pool de receitas...');
      const { data: allRecipes } = await supabase
        .from('receita_ingredientes')
        .select('receita_id_legado, nome')
        .limit(200);
      
      if (allRecipes) {
        receitasPool = allRecipes.map(r => ({
          id: r.receita_id_legado,
          nome: r.nome,
          name: r.nome,
          categoria: inferirCategoria(r.nome),
          category: inferirCategoria(r.nome)
        }));
      }
      
      // Se diasUteis=true → só considera segunda a sexta
      const diasSemana = diasUteis 
        ? ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira']
        : ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
      
      for (let i = 0; i < totalDias; ) {
        const weekday = diaAtual.getDay(); // 0=domingo, 6=sábado
        if (diasUteis && (weekday === 0 || weekday === 6)) {
          diaAtual.setDate(diaAtual.getDate() + 1);
          continue; // pula fim de semana
        }

        const nomeDia = diaAtual.toLocaleDateString("pt-BR", { weekday: "long" });
        const diaIndex = i;
        
        console.log(`\n📅 === ${nomeDia} (Dia ${i + 1}) ===`);
        
        let receitasDia: any[] = [];
        let custoDia = 0;
        let substituicoesPorOrcamento: string[] = [];
        
        // ====== PROTEÍNAS COM CONTROLE DE VARIEDADE ======
        console.log('🥩 Selecionando proteínas...');
        
        let pp1 = await escolherProteina("Proteína Principal 1", receitasPool, mealQuantity);
        let pp2 = await escolherProteina("Proteína Principal 2", receitasPool, mealQuantity);
        
        if (pp1) {
          const pp1Result = await calculateSimpleCost(pp1.id, mealQuantity);
          if (pp1Result.custo_por_refeicao > 0) {
            pp1.custo_por_refeicao = pp1Result.custo_por_refeicao;
            pp1.nome = pp1Result.nome;
            pp1.grams = gramsPP1;
            
            // Controle de carne vermelha
            const tipoPP1 = getProteinType(pp1.nome);
            if (tipoPP1 === "Carne Vermelha") {
              if (contadorCarnesVermelhas >= 2) {
                console.log(`⚠️ Limite de carne vermelha atingido, buscando alternativa para PP1`);
                const alternativa = receitasPool.find(r => 
                  r.categoria === "Proteína Principal 1" && 
                  getProteinType(r.nome) !== "Carne Vermelha"
                );
                if (alternativa) {
                  const altResult = await calculateSimpleCost(alternativa.id, mealQuantity);
                  if (altResult.custo_por_refeicao > 0) {
                    pp1 = alternativa;
                    pp1.custo_por_refeicao = altResult.custo_por_refeicao;
                    pp1.nome = altResult.nome;
                    pp1.grams = gramsPP1;
                  }
                }
              } else {
                contadorCarnesVermelhas++;
              }
            }
          }
        }
        
        if (pp2) {
          const pp2Result = await calculateSimpleCost(pp2.id, mealQuantity);
          if (pp2Result.custo_por_refeicao > 0) {
            pp2.custo_por_refeicao = pp2Result.custo_por_refeicao;
            pp2.nome = pp2Result.nome;
            pp2.grams = gramsPP2;
            
            // Garantir tipos diferentes no mesmo dia
            if (pp1 && getProteinType(pp1.nome) === getProteinType(pp2.nome)) {
              console.log(`⚠️ Mesmo tipo de proteína no dia, buscando alternativa para PP2`);
              const alternativa = receitasPool.find(r =>
                r.categoria === "Proteína Principal 2" &&
                getProteinType(r.nome) !== getProteinType(pp1.nome)
              );
              if (alternativa) {
                const altResult = await calculateSimpleCost(alternativa.id, mealQuantity);
                if (altResult.custo_por_refeicao > 0) {
                  pp2 = alternativa;
                  pp2.custo_por_refeicao = altResult.custo_por_refeicao;
                  pp2.nome = altResult.nome;
                  pp2.grams = gramsPP2;
                }
              }
            }
            
            // Controle de carne vermelha para PP2
            const tipoPP2 = getProteinType(pp2.nome);
            if (tipoPP2 === "Carne Vermelha") {
              if (contadorCarnesVermelhas >= 2) {
                console.log(`⚠️ Limite de carne vermelha atingido, buscando alternativa para PP2`);
                const alternativa = receitasPool.find(r => 
                  r.categoria === "Proteína Principal 2" && 
                  getProteinType(r.nome) !== "Carne Vermelha"
                );
                if (alternativa) {
                  const altResult = await calculateSimpleCost(alternativa.id, mealQuantity);
                  if (altResult.custo_por_refeicao > 0) {
                    pp2 = alternativa;
                    pp2.custo_por_refeicao = altResult.custo_por_refeicao;
                    pp2.nome = altResult.nome;
                    pp2.grams = proteinGramsPP2;
                  }
                }
              } else {
                contadorCarnesVermelhas++;
              }
            }
          }
        }
        
        // Adicionar proteínas ao dia
        if (pp1) {
          receitasDia.push({
            id: pp1.id,
            nome: pp1.nome,
            categoria: 'Proteína Principal 1',
            codigo: 'PP1',
            custo_por_refeicao: pp1.custo_por_refeicao,
            custo_total: pp1.custo_por_refeicao * mealQuantity,
            porcoes: mealQuantity,
            ingredientes: [],
            grams: pp1.grams,
            protein_type: getProteinType(pp1.nome)
          });
          custoDia += pp1.custo_por_refeicao;
        }
        
        if (pp2) {
          receitasDia.push({
            id: pp2.id,
            nome: pp2.nome,
            categoria: 'Proteína Principal 2',
            codigo: 'PP2',
            custo_por_refeicao: pp2.custo_por_refeicao,
            custo_total: pp2.custo_por_refeicao * mealQuantity,
            porcoes: mealQuantity,
            ingredientes: [],
            grams: pp2.grams,
            protein_type: getProteinType(pp2.nome)
          });
          custoDia += pp2.custo_por_refeicao;
        }
        
        // ====== OUTRAS CATEGORIAS ======
        const outrasCategoriasConfig = [
          { codigo: 'ARROZ', categoria: 'Arroz Branco', receita_id: 580 },
          { codigo: 'FEIJAO', categoria: 'Feijão', receita_id: 1600 },
          { codigo: 'GUARNICAO', categoria: 'Guarnição' },
          { codigo: 'SALADA1', categoria: 'Salada 1 (Verduras)' },
          { codigo: 'SALADA2', categoria: 'Salada 2 (Legumes)' },
          { codigo: 'SUCO1', categoria: 'Suco 1' },
          { codigo: 'SUCO2', categoria: 'Suco 2' },
          { codigo: 'SOBREMESA', categoria: 'Sobremesa' }
        ];
        
        for (const catConfig of outrasCategoriasConfig) {
          let receita = null;
          
          if (catConfig.receita_id) {
            // CORREÇÃO: Receitas fixas com validação específica para arroz e feijão
            console.log(`🍚 Calculando custo para ${catConfig.categoria} (ID: ${catConfig.receita_id})`);
            const resultado = await calculateSimpleCost(catConfig.receita_id, mealQuantity);
            
            if (resultado.custo_por_refeicao > 0) {
              receita = {
                id: resultado.id,
                nome: resultado.nome,
                custo_por_refeicao: resultado.custo_por_refeicao,
                custo_total: resultado.custo || 0
              };
              console.log(`✅ ${catConfig.categoria}: R$${resultado.custo_por_refeicao.toFixed(2)}/refeição`);
            } else {
              // FALLBACK para arroz e feijão com valores padrão se não encontrar
              console.log(`⚠️ Custo zero para ${catConfig.categoria}, usando fallback`);
              receita = {
                id: catConfig.receita_id,
                nome: catConfig.categoria === 'Arroz Branco' ? 'ARROZ BRANCO' : 'FEIJÃO CARIOCA',
                custo_por_refeicao: catConfig.categoria === 'Arroz Branco' ? 0.15 : 0.25,
                custo_total: (catConfig.categoria === 'Arroz Branco' ? 0.15 : 0.25) * mealQuantity
              };
            }
            } else if (catConfig.codigo === 'SUCO1' || catConfig.codigo === 'SUCO2') {
               // CORREÇÃO: Usar configuração correta carregada do cliente
               console.log("🧃 Configuração de suco do cliente:", JSON.stringify(juiceConfig));
             
              try {
                // CORREÇÃO: Usar configuração correta do cliente
                const [suco1, suco2] = escolherSucosDia(juiceConfig);
               const nomeEscolhido = catConfig.codigo === 'SUCO1' ? suco1 : suco2;
               
               console.log(`🧃 Suco escolhido para ${catConfig.codigo}: ${nomeEscolhido}`);
               
               // Buscar custo real do produto (tentativa de encontrar por nome)
               const { data: precoProduto } = await supabase
                 .from('co_solicitacao_produto_listagem')
                 .select('preco, produto_base_id')
                 .ilike('descricao', `%${nomeEscolhido.split(' ').pop()}%`) // busca por parte do nome
                 .gt('preco', 0)
                 .limit(1)
                 .maybeSingle();
               
               const custoSuco = precoProduto?.preco ? (precoProduto.preco * 0.1) : 0.40; // 10% do preço ou fallback
               
               receita = {
                 id: precoProduto?.produto_base_id || -999,
                 nome: nomeEscolhido,
                 custo_por_refeicao: custoSuco,
                 custo_total: custoSuco * mealQuantity
               };
               
               console.log(`✅ Suco configurado: ${nomeEscolhido} - R$ ${custoSuco.toFixed(2)}`);
               
             } catch (error) {
               console.warn(`Erro ao configurar suco: ${error.message}`);
               // Fallback para suco padrão
               receita = {
                 id: -999,
                 nome: catConfig.codigo === 'SUCO1' ? 'Suco Natural Laranja' : 'Suco Natural Limão',
                 custo_por_refeicao: 0.40,
                 custo_total: 0.40 * mealQuantity
               };
             }
          } else {
            // Receitas variáveis com controle de variedade
            if (catConfig.codigo === 'GUARNICAO') {
              receita = escolherReceita(catConfig.categoria, receitasPool, guarnicoesUsadas);
              if (receita) {
                const resultado = await calculateSimpleCost(receita.id, mealQuantity);
                if (resultado.custo_por_refeicao > 0) {
                  receita.custo_por_refeicao = resultado.custo_por_refeicao;
                  receita.nome = resultado.nome;
                  guarnicoesUsadas.push(receita.nome);
                }
              }
            } else {
              receita = escolherReceita(catConfig.categoria, receitasPool);
              if (receita) {
                const resultado = await calculateSimpleCost(receita.id, mealQuantity);
                if (resultado.custo_por_refeicao > 0) {
                  receita.custo_por_refeicao = resultado.custo_por_refeicao;
                  receita.nome = resultado.nome;
                }
              }
            }
          }

          // Se não achar nada → usar fallback dummy para não deixar categorias vazias
          if (!receita) {
            receita = fallbackReceita(catConfig.categoria);
            if (receita) {
              console.log(`🔧 Usando fallback para ${catConfig.categoria}: ${receita.nome}`);
            }
          }
          
          // Adiciona no dia
          if (receita) {
            receitasDia.push({
              id: receita.id,
              nome: receita.nome,
              categoria: catConfig.categoria,
              codigo: catConfig.codigo,
              custo_por_refeicao: receita.custo_por_refeicao,
              custo_total: receita.custo_por_refeicao * mealQuantity,
              porcoes: mealQuantity,
              ingredientes: []
            });
            custoDia += receita.custo_por_refeicao;
          }
        }
        
        // ====== CONTROLE DE ORÇAMENTO RIGOROSO ======
        if (custoDia > budget) {
          console.log(`⚠️ Custo do dia R$${custoDia.toFixed(2)} > limite R$${budget.toFixed(2)} (origem: ${origemOrcamento})`);
          
          // Encontrar item mais caro (excluindo arroz e feijão fixos)
          const receitasAjustaveis = receitasDia.filter(r => r.codigo !== 'ARROZ' && r.codigo !== 'FEIJAO');
          if (receitasAjustaveis.length > 0) {
            const maisCaro = receitasAjustaveis.reduce((a, b) => a.custo_por_refeicao > b.custo_por_refeicao ? a : b);
            
            // Buscar alternativa mais barata da mesma categoria
            const alternativas = receitasPool.filter(r => 
              r.categoria === maisCaro.categoria && 
              validarCategoriaReceita(r, maisCaro.categoria)
            );
            
            for (const alt of alternativas) {
              const resultado = await calculateSimpleCost(alt.id, mealQuantity);
              if (resultado.custo_por_refeicao > 0 && resultado.custo_por_refeicao < maisCaro.custo_por_refeicao) {
                console.log(`🔄 Substituindo ${maisCaro.nome} por ${resultado.nome} (economia: R$${(maisCaro.custo_por_refeicao - resultado.custo_por_refeicao).toFixed(2)})`);
                
                // Atualizar receita
                maisCaro.id = alt.id;
                maisCaro.nome = resultado.nome;
                maisCaro.custo_total = resultado.custo_por_refeicao * mealQuantity;
                
                // Recalcular custo do dia
                custoDia = custoDia - maisCaro.custo_por_refeicao + resultado.custo_por_refeicao;
                maisCaro.custo_por_refeicao = resultado.custo_por_refeicao;
                
                substituicoesPorOrcamento.push({
                  receita_original: maisCaro.nome,
                  receita_substituta: resultado.nome,
                  categoria: maisCaro.categoria,
                  economia: maisCaro.custo_por_refeicao - resultado.custo_por_refeicao
                });
                break;
              }
            }
          }
        }
        
        cardapioPorDia.push({
          dia: nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1),
          data: diaAtual.toISOString().split("T")[0],
          receitas: receitasDia,
          custo_total_dia: custoDia * mealQuantity,
          custo_por_refeicao: custoDia,
          dentro_orcamento: custoDia <= budget,
          substituicoes_orcamento: substituicoesPorOrcamento,
          contadores: {
            carnes_vermelhas_semana: contadorCarnesVermelhas,
            guarnicoes_usadas: guarnicoesUsadas.length
          }
        });

        diaAtual.setDate(diaAtual.getDate() + 1);
        i++;
        
        console.log(`💰 ${nomeDia}: R$ ${custoDia.toFixed(2)}/refeição ${custoDia <= budget ? '✅' : '⚠️'}`);
        if (substituicoesPorOrcamento.length > 0) {
          const resumoSubs = substituicoesPorOrcamento.map(s => `${s.categoria}: ${s.receita_substituta} (economia: R$${s.economia.toFixed(2)})`);
          console.log(`🔄 Substituições: ${resumoSubs.join(', ')}`);
        }
      }
      
      return cardapioPorDia;
    }
    

    // HANDLER PRINCIPAL
    if (requestData.action === 'generate_menu') {
      const mealQuantity = requestData.refeicoesPorDia || requestData.meal_quantity || 100;
      const filialId = requestData.filialIdLegado || requestData.filial_id || null;
      const clientName = requestData.cliente || 'Cliente';
      const numDays = requestData.numDays || 7;
      
      console.log(`🍽️ Gerando cardápio: ${numDays} dias, ${mealQuantity} refeições/dia`);
      console.log(`🔍 FILIAL_ID DEBUG: filialId=${filialId}, origem:`, {
        filialIdLegado: requestData.filialIdLegado,
        filial_id: requestData.filial_id
      });
      
      try {
        // Buscar orçamento
        let budget = 9.00;
        let dadosFilial = null;
        
        if (filialId) {
          dadosFilial = await buscarOrcamentoFilial(filialId);
          budget = dadosFilial.custo_diario || 9.00;
        console.log(`💰 Dados filial encontrados:`, { budget, dadosFilial: !!dadosFilial });
      } else {
        console.warn(`⚠️ Sem filialId - usando fallback`);
      }
      
      console.log(`💰 Orçamento: R$ ${budget.toFixed(2)}/refeição`);
      
      // ✅ Extrair gramagens do contrato ou usar defaults
      const gramsPP1 = dadosFilial?.protein_grams_pp1 ?? 100;
      const gramsPP2 = dadosFilial?.protein_grams_pp2 ?? 90;
      
      // ========== NOVA LÓGICA COM REGRAS DA NUTRICIONISTA ==========
      const periodo = requestData.periodo || 'semanal';
      const diasUteis = requestData.diasUteis || false;
      
      const origemOrcamento = dadosFilial ? "custos_filiais" : "fallback";
      
      const cardapioPorDia = await gerarCardapioComRegras({
        mealQuantity,
        numDays,
        periodo,
        diasUteis,
        supabase,
        gramsPP1,
        gramsPP2
      }, budget, origemOrcamento);

        // A configuração de sucos já é processada dentro de gerarCardapioComRegras
        // através da função escolherSucosDia(), não precisamos do RPC redundante
        console.log('✅ Sucos já processados pela lógica local escolherSucosDia()');
        
        // Calcular totais
        const diasGerados = cardapioPorDia.length;
        const custoMedioPorRefeicao = diasGerados > 0 
          ? cardapioPorDia.reduce((sum, dia) => sum + dia.custo_por_refeicao, 0) / diasGerados
          : 0;
        const custoTotalPeriodo = cardapioPorDia.reduce((sum, dia) => sum + dia.custo_total_dia, 0);
        
        // RESPOSTA ESTRUTURADA POR DIA
        const response = {
          success: true,
          version: 'CORRIGIDA-FINAL-v3.0',
          
          solicitacao: {
            cliente: dadosFilial?.nome_filial || clientName,
            filial_id: filialId,
            periodo: `${numDays} dias`,
            quantidade_refeicoes_dia: mealQuantity,
            orcamento_filial: budget,
            origem_orcamento: dadosFilial ? "custos_filiais" : "fallback"
          },
          
          // CARDÁPIO AGRUPADO POR DIA
          cardapio: cardapioPorDia.map(dia => ({
            dia: dia.dia,
            data: dia.data,
            receitas: dia.receitas,
            resumo_dia: {
              total_receitas: dia.receitas.length,
              custo_total: dia.custo_total_dia.toFixed(2),
              custo_por_refeicao: dia.custo_por_refeicao.toFixed(2),
              dentro_orcamento: dia.dentro_orcamento
            }
          })),
          
          // RESUMO FINANCEIRO GERAL
          resumo_financeiro: {
            custo_total_periodo: custoTotalPeriodo.toFixed(2),
            custo_medio_por_refeicao: custoMedioPorRefeicao.toFixed(2),
            custo_por_porcao: custoMedioPorRefeicao.toFixed(2), // Para compatibilidade
            orcamento_total: (budget * mealQuantity * numDays).toFixed(2),
            economia_total: ((budget * mealQuantity * numDays) - custoTotalPeriodo).toFixed(2),
            dentro_orcamento: custoMedioPorRefeicao <= budget
          },
          
          metadata: {
            data_geracao: new Date().toISOString(),
            tempo_processamento_ms: Date.now() - startTime,
            dias_gerados: diasGerados,
            dias_uteis: diasUteis,
            estrutura_por_dia: Object.keys(ESTRUTURA_CARDAPIO)
          }
        };
        
        console.log(`\n✅ CARDÁPIO GERADO: ${numDays} dias`);
        console.log(`💰 Custo médio: R$ ${custoMedioPorRefeicao.toFixed(2)}/refeição`);
        console.log(`💰 Economia: R$ ${((budget - custoMedioPorRefeicao) * mealQuantity * numDays).toFixed(2)}`);
        
        // ========== SALVAMENTO AUTOMÁTICO NO BANCO ==========
        console.log('💾 Salvando cardápio no banco de dados...');
        
        // calcula total de receitas
        const totalReceitas = response.cardapio.reduce(
          (acc, dia) => acc + dia.receitas.length,
          0
        );

        // 🔧 Adaptar receitas para o formato esperado pelo hook useIntegratedMenuGeneration
        const receitasAdaptadas = response.cardapio.flatMap((dia) =>
          dia.receitas.map((r) => ({
            receita_id_legado: String(r.id),        // ID legado ou da receita
            nome_receita: r.nome,                   // Nome da receita
            categoria_descricao: r.categoria,       // Categoria mapeada
            day: dia.dia,                           // O dia da semana (Segunda-feira, etc.)
            custo_adaptado: r.custo_por_refeicao,   // Custo unitário
            porcoes: r.porcoes || 50,               // Número de porções (default 50 se não vier)
            ingredientes: r.ingredientes || [],     // Ingredientes que vieram do cálculo
            nutritional_info: {}                    // Campo vazio (compatível com hook)
          }))
        );

        // Captura o client_id correto do requestData
        const clientId = requestData.client_id || requestData.clientId || requestData.filial_id || requestData.filialIdLegado;
        
        console.log("🆔 Client ID usado no insert:", {
          clientId_final: clientId,
          client_id: requestData.client_id,
          clientId: requestData.clientId, 
          filial_id: requestData.filial_id,
          filialIdLegado: requestData.filialIdLegado
        });
        
        if (!clientId || clientId === "sem-id") {
          console.warn('⚠️  CLIENT_ID não encontrado no payload:', requestData);
        }

        // Prepara o payload para o insert (sem cardapio_json que não existe na tabela)
        const payload = {
          client_id: String(clientId || "unknown-client"),
          client_name: clientName,
          week_period: `${response.cardapio[0].data} - ${response.cardapio[response.cardapio.length - 1].data}`,
          total_cost: Number(response.resumo_financeiro.custo_total_periodo) || 0,
          cost_per_meal: Number(response.resumo_financeiro.custo_medio_por_refeicao) || 0,
          total_recipes: totalReceitas,
          status: "pending_approval",
          receitas_adaptadas: receitasAdaptadas
        };

        console.log("💾 Payload para insert:", payload);

        // Faz o insert no Supabase
        const { data: savedMenu, error } = await supabase
          .from("generated_menus")
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.error("❌ Erro ao salvar no Supabase:", error);
          throw error;
        }

        // Retorno final da Edge Function
        return new Response(
  JSON.stringify({
    success: true,
    id: savedMenu.id,
    message: "Cardápio gerado com sucesso e salvo no banco.",
    resumo_financeiro: response.resumo_financeiro,
    cardapio: response.cardapio
    // ❌ removido juice_menu
  }),
  { headers: { "Content-Type": "application/json", ...corsHeaders } }
);
        
      } catch (error) {
        console.error('💥 ERRO:', error);
        
        return new Response(
          JSON.stringify({
            success: false,
            erro: error.message,
            version: 'CORRIGIDA-FINAL-v3.0'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // Default
    return new Response(
      JSON.stringify({
        success: true,
        version: 'CORRIGIDA-FINAL-v3.0',
        message: 'Sistema de cardápio funcionando - versão final corrigida'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        erro: error.message,
        version: 'CORRIGIDA-FINAL-v3.0'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});