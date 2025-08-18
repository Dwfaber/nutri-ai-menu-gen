// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type DiaLabel = 'SEGUNDA'|'TERÇA'|'QUARTA'|'QUINTA'|'SEXTA'|'SÁBADO'|'DOMINGO';

const REQUIRED_SLOTS = [
  'ARROZ BRANCO',
  'FEIJÃO',
  'PRATO PRINCIPAL 1',
  'PRATO PRINCIPAL 2',
  'SALADA 1 (VERDURAS)',
  'SALADA 2 (LEGUMES)',
  'SUCO 1',
  'SUCO 2',
] as const;

const WEEK: DiaLabel[] = ['SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO','DOMINGO'];
// REMOVIDO: RECIPE_BASE fixo - agora usa quantidade_refeicoes real da receita

const DEFAULT_JUICES = [
  { id: 599, nome: 'SUCO EM PÓ DE LARANJA' },
  { id: 656, nome: 'SUCO TETRA PAK' },
];

type UsedTracker = Record<string, Set<string>>; // slot -> set de receita_id

// ---------------- helpers ----------------
const json = (payload: any, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const bad = (status: number, msg: string, extra?: any) =>
  json({ success: false, error: msg, ...extra }, status);

const parseNumber = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const safeInt = (v: unknown): number | null => {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};

const like = (s: string | null | undefined, keys: string[]) => {
  const t = (s ?? "").toLowerCase();
  return keys.some((k) => t.includes(k));
};

function dayLabelByIndex(i: number): DiaLabel {
  return WEEK[i % 7];
}

function getBudgetLabel(i: number, useDiaEspecial: boolean): 'SEGUNDA'|'TERÇA'|'QUARTA'|'QUINTA'|'SEXTA'|'SÁBADO'|'DOMINGO'|'ESPECIAL' {
  const label = dayLabelByIndex(i);
  if (useDiaEspecial && (label === 'SÁBADO' || label === 'DOMINGO')) return 'ESPECIAL';
  return label;
}

function getBudgetPerMealFromCustos(row: any, label: string): number {
  switch (label) {
    case 'SEGUNDA':  return Number(row.RefCustoSegunda) || 0;
    case 'TERÇA':
    case 'TERCA':    return Number(row.RefCustoTerça ?? row.RefCustoTerca) || 0;
    case 'QUARTA':   return Number(row.RefCustoQuarta) || 0;
    case 'QUINTA':   return Number(row.RefCustoQuinta) || 0;
    case 'SEXTA':    return Number(row.RefCustoSexta) || 0;
    case 'SÁBADO':
    case 'SABADO':   return Number(row.RefCustoSabado) || 0;
    case 'DOMINGO':  return Number(row.RefCustoDomingo) || 0;
    case 'ESPECIAL': return Number(row.RefCustoDiaEspecial) || 0;
    default:         return 0;
  }
}

function getArrozBaseId(baseRecipes?: any): number | null {
  const v = baseRecipes?.arroz ?? baseRecipes?.ARROZ ?? baseRecipes?.arroz_branco;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getFeijaoBaseId(baseRecipes?: any): number | null {
  const v = baseRecipes?.feijao ?? baseRecipes?.FEIJÃO ?? baseRecipes?.feijao_carioca;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBaseQty(qtd: number, unidade: string): { qty: number; base: "KG" | "LT" | "UN" } {
  const u = (unidade ?? "").trim().toUpperCase();
  if (u === "KG" || u === "KILO" || u === "QUILO") return { qty: qtd, base: "KG" };
  if (u === "G" || u === "GR" || u === "GRAMAS") return { qty: qtd / 1000, base: "KG" };
  if (u === "L" || u === "LT" || u === "LITRO") return { qty: qtd, base: "LT" };
  if (u === "ML" || u === "MILILITROS") return { qty: qtd / 1000, base: "LT" };
  return { qty: qtd, base: "UN" };
}

function normBase(unidade: string): "KG" | "LT" | "UN" {
  const u = (unidade ?? "").trim().toUpperCase();
  if (u === "KG" || u === "KILO" || u === "QUILO") return "KG";
  if (u === "L" || u === "LT" || u === "LITRO") return "LT";
  return "UN";
}

// tamanho da embalagem expresso na unidade-base (KG/LT/UN)
function packSizeToBase(qty: number | null | undefined, base: "KG" | "LT" | "UN") {
  const v = Number(qty ?? 0);
  if (!isFinite(v) || v <= 0) return 1;
  if (base === "KG" && v > 20) return v / 1000; // 500 → 0.5 kg
  if (base === "LT" && v > 20) return v / 1000; // 500 → 0.5 L
  return v;
}

// ---------------- server ----------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Health check endpoint
  if (req.method === "GET") {
    return json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      version: "2.0"
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const filialIdLegado = parseNumber(body?.filialIdLegado);
    const numDays = parseNumber(body?.numDays);
    const refeicoesPorDia = parseNumber(body?.refeicoesPorDia);
    const useDiaEspecial = body?.useDiaEspecial === true;
    const baseRecipes = body?.baseRecipes || {};

    // Validate action
    if (!action || !["generate_menu", "generate-menu", "generateMenu"].includes(action)) {
      console.error("[ERRO] Ação inválida:", action);
      return bad(400, "action deve ser 'generate_menu', 'generate-menu' ou 'generateMenu'");
    }

    // Validate filialIdLegado
    if (filialIdLegado === null || filialIdLegado <= 0) {
      return bad(400, "filialIdLegado deve ser um número positivo");
    }

    // Validate numDays
    if (numDays === null || numDays < 1 || numDays > 15) {
      return bad(400, "numDays deve estar entre 1 e 15");
    }

    // Validate refeicoesPorDia
    if (refeicoesPorDia === null || refeicoesPorDia <= 0) {
      return bad(400, "refeicoesPorDia deve ser maior que 0");
    }

    // 1) Teto por refeição (buscar por filial_id)
    const { data: custos, error: custosErr } = await supabase
      .from("custos_filiais")
      .select("*")
      .eq("filial_id", filialIdLegado)
      .order("created_at", { ascending: false })
      .limit(1);

    if (custosErr) {
      console.error("[ERRO] Custos não encontrados para filial", filialIdLegado, custosErr.message);
      return bad(500, "Erro ao consultar custos_filiais");
    }

    if (!custos?.length) {
      console.error("[ERRO] Nenhum custo configurado para filial", filialIdLegado);
      return bad(400, `Nenhum custo encontrado para filial_id ${filialIdLegado}`);
    }

    const c0: any = custos[0];
    const refCostWeek = [
      parseNumber(c0.RefCustoSegunda),
      parseNumber(c0.RefCustoTerca), 
      parseNumber(c0.RefCustoQuarta),
      parseNumber(c0.RefCustoQuinta),
      parseNumber(c0.RefCustoSexta),
      parseNumber(c0.RefCustoSabado),
      parseNumber(c0.RefCustoDomingo)
    ];

    // Se useDiaEspecial, substituir todos os dias pelo RefCustoDiaEspecial
    if (useDiaEspecial) {
      const especialCost = parseNumber(c0.RefCustoDiaEspecial);
      if (especialCost && especialCost > 0) {
        refCostWeek.fill(especialCost);
      }
    }

    if (!refCostWeek.some((v) => v && v > 0)) {
      return bad(400, "RefCusto* não configurado para a filial");
    }

    // 2) Receitas ativas (candidatas)
    const { data: receitas, error: rErr } = await supabase
      .from("receitas_legado")
      .select("receita_id_legado, nome_receita, categoria_descricao, inativa")
      .eq("inativa", false);

    if (rErr) {
      console.error("[receitas_legado]", rErr);
      return bad(500, "Erro ao consultar receitas_legado");
    }

    // Candidatos por categoria da grade
    const CAT_MATCHERS: Record<string, (r: any) => boolean> = {
      "PRATO PRINCIPAL 1": (r) =>
        like(r.categoria_descricao, ["principal", "prote", "carne", "frango", "peixe"]),
      "PRATO PRINCIPAL 2": (r) =>
        like(r.categoria_descricao, ["principal", "guarni", "prote", "carne", "frango", "peixe"]),
      "ARROZ BRANCO": (r) => like(r.nome_receita, ["arroz"]),
      "FEIJÃO": (r) => like(r.nome_receita, ["feij"]),
      "SALADA 1 (VERDURAS)": (r) => like(r.categoria_descricao, ["salada", "verdura", "folha"]),
      "SALADA 2 (LEGUMES)": (r) => like(r.categoria_descricao, ["legume", "salada"]),
      "SUCO 1": (r) => like(r.categoria_descricao, ["suco", "bebida"]),
      "SUCO 2": (r) => like(r.categoria_descricao, ["suco", "bebida"]),
    };

    const CATS = Object.keys(CAT_MATCHERS);
    const candidatesByCat: Record<string, any[]> = {};
    for (const cat of CATS) {
      const f = CAT_MATCHERS[cat];
      candidatesByCat[cat] = (receitas ?? []).filter((r) => f?.(r));
    }

    // Garantir arroz e feijão base (IDs fixos: 580 e 1603)
    const arrozBaseId = getArrozBaseId(baseRecipes) || 580;
    const feijaoBaseId = getFeijaoBaseId(baseRecipes) || 1603;
    
    // CORREÇÃO: Converter IDs para string na comparação
    let arrozReceita = (receitas ?? []).find(r => r.receita_id_legado === String(arrozBaseId));
    let feijaoReceita = (receitas ?? []).find(r => r.receita_id_legado === String(feijaoBaseId));
    
    const warnings = [];
    if (!arrozReceita) {
      console.warn("[AVISO] Receita de arroz base não encontrada, ID:", arrozBaseId);
      warnings.push(`Receita de arroz ID ${arrozBaseId} não encontrada`);
    }
    if (!feijaoReceita) {
      console.warn("[AVISO] Receita de feijão base não encontrada, ID:", feijaoBaseId);
      warnings.push(`Receita de feijão ID ${feijaoBaseId} não encontrada`);
    }

    // 3) Ingredientes de todas as receitas candidatas + receitas base obrigatórias
    const candidateIds = [
      ...new Set(CATS.flatMap((c) => candidatesByCat[c].map((r) => String(r.receita_id_legado)))),
      String(arrozBaseId),   // Incluir arroz base
      String(feijaoBaseId)   // Incluir feijão base
    ];
    if (candidateIds.length === 0) {
      return bad(400, "Nenhuma receita candidata encontrada");
    }

    const { data: ingredientes, error: iErr } = await supabase
      .from("receita_ingredientes")
      .select("receita_id_legado, produto_base_id, produto_base_descricao, quantidade, unidade, quantidade_refeicoes")
      .in("receita_id_legado", candidateIds);

    if (iErr) {
      console.error("[receita_ingredientes]", iErr);
      return bad(500, "Erro ao consultar receita_ingredientes");
    }

    const ingByReceita = new Map<string, any[]>();
    // CORREÇÃO: Garantir que todas as chaves do mapa sejam strings
    for (const ing of ingredientes ?? []) {
      const key = String(ing.receita_id_legado);
      (ingByReceita.get(key) ?? ingByReceita.set(key, []).get(key))!.push(ing);
    }

    // 4) Sistema inteligente de precificação com embalagens reais
    const produtoIds = Array.from(
      new Set(
        (ingredientes ?? [])
          .map((i) => Number(i.produto_base_id))
          .filter((v) => Number.isFinite(v) && v > 0)
      )
    );
    
    // Carregamento completo do mercado para busca inteligente

    // Buscar TODOS os produtos, incluindo os sem produto_base_id
    const { data: mercadoRows, error: mercadoErr } = await supabase
      .from("co_solicitacao_produto_listagem")
      .select(`
        produto_base_id,
        descricao,
        preco,
        unidade,
        apenas_valor_inteiro_sim_nao,
        produto_base_quantidade_embalagem,
        em_promocao_sim_nao
      `)
      .gt("preco", 0);
      
      if (mercadoErr) {
      console.error("[ERRO] Falha ao carregar produtos do mercado:", mercadoErr.message);
      return bad(500, "Erro ao consultar co_solicitacao_produto_listagem");
    }

    // Sistema de parsing de descrição para extrair embalagem
    function parseProductDescription(desc: string): { tamanho: number | null; unidade: string | null; nome: string } {
      const texto = (desc || '').toUpperCase().trim();
      
      // Padrões para identificar peso/volume
      const patterns = [
        /(\d+(?:\.\d+)?)\s*(ML|MILILITRO|MILILITROS)/,
        /(\d+(?:\.\d+)?)\s*(LT|L|LITRO|LITROS)/,
        /(\d+(?:\.\d+)?)\s*(GR|G|GRAMAS|GRAMA)/,
        /(\d+(?:\.\d+)?)\s*(KG|QUILO|QUILOGRAMA)/,
        /(\d+(?:\.\d+)?)\s*(UN|UNIDADE|UNIDADES)/,
        /(\d+)\s*X\s*(\d+(?:\.\d+)?)\s*(ML|GR|G)/,  // Ex: 184 X 4ML
      ];
      
      for (const pattern of patterns) {
        const match = texto.match(pattern);
        if (match) {
          if (match[3] && match[2]) {
            // Padrão X: 184 X 4ML = 736ML total
            const quantidade = Number(match[1]);
            const tamanhoUnitario = Number(match[2]);
            const unidade = match[3];
            return {
              tamanho: quantidade * tamanhoUnitario,
              unidade,
              nome: texto
            };
          } else {
            return {
              tamanho: Number(match[1]),
              unidade: match[2],
              nome: texto
            };
          }
        }
      }
      
      return { tamanho: null, unidade: null, nome: texto };
    }

    /**
     * Normaliza texto para busca inteligente (remove acentos, especificações de peso)
     */
    function normalizeSearchTerm(text: string): string {
      if (!text) return '';
      
      return text
        .normalize('NFD') // Remove acentos
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s*-\s*/g, ' ') // Remove hífens
        .replace(/\b\d+\s*(GR?S?|KGS?|G|GRAMAS?|QUILOS?)\b/gi, '') // Remove especificações de peso
        .replace(/\s+/g, ' ') // Normaliza espaços
        .trim();
    }

    /**
     * Dicionário de mapeamentos automáticos para ingredientes comuns
     */
    const INGREDIENT_MAPPINGS = new Map([
      // Caldos e temperos
      ['CALDO DE CARNE', ['TEMPERO PRONTO', 'KNORR CARNE', 'CALDO CARNE', 'TEMPERO CALDO']],
      ['CALDO DE GALINHA', ['TEMPERO PRONTO', 'KNORR GALINHA', 'CALDO GALINHA']],
      ['CALDO DE LEGUMES', ['TEMPERO PRONTO', 'KNORR LEGUMES', 'CALDO LEGUMES']],
      
      // Especiarias e temperos
      ['AÇAFRÃO', ['CÚRCUMA', 'AÇAFRÃO DA TERRA', 'AÇAFRÃO EM PÓ']],
      ['CÚRCUMA', ['AÇAFRÃO', 'AÇAFRÃO DA TERRA']],
      
      // Líquidos básicos (custo zero automático)
      ['AGUA NATURAL', []],
      ['AGUA FILTRADA', []],
      ['AGUA', []],
      
      // Outros mapeamentos comuns
      ['SAL', ['SAL REFINADO', 'SAL MARINHO']],
      ['AZEITE', ['AZEITE DE OLIVA', 'OLEO DE OLIVA']],
      ['OLEO', ['OLEO DE SOJA', 'OLEO VEGETAL']],
    ]);

    /**
     * Calcula score de similaridade INTELIGENTE por palavra-chave
     */
    function calculateSimilarityScore(searchTerm: string, productName: string): number {
      const normalizedSearch = normalizeSearchTerm(searchTerm);
      const normalizedProduct = normalizeSearchTerm(productName);
      
      // 1. Match exato = 100
      if (normalizedProduct === normalizedSearch) return 100;
      
      // 2. PALAVRA-CHAVE ESPECÍFICA: Se o termo pesquisado aparece como palavra completa
      const searchWords = normalizedSearch.split(' ').filter(w => w.length > 1);
      const productWords = normalizedProduct.split(' ').filter(w => w.length > 1);
      
      for (const searchWord of searchWords) {
        if (searchWord.length >= 3) { // Palavras relevantes
          // Palavra exata encontrada = score muito alto
          if (productWords.includes(searchWord)) {
            return 95;
          }
          
          // Produto começa com a palavra = score alto
          if (normalizedProduct.startsWith(searchWord)) {
            return 90;
          }
          
          // Contém a palavra = score médio-alto
          if (normalizedProduct.includes(searchWord)) {
            return 85;
          }
        }
      }
      
      // 3. Contém termo completo = 80
      if (normalizedProduct.includes(normalizedSearch)) return 80;
      
      // 4. Palavras-chave em comum (lógica anterior para casos complexos)
      const commonWords = searchWords.filter(word => 
        productWords.some(pWord => pWord.includes(word) || word.includes(pWord))
      );
      
      if (commonWords.length === 0) return 0;
      
      // Score baseado na proporção de palavras em comum
      return Math.floor((commonWords.length / searchWords.length) * 70);
    }

    // Cache de busca e sugestões aprovadas
    const searchCache = new Map<string, any>();
    const approvedSuggestions = new Map<string, any>();
    
    /**
     * Sistema de busca inteligente com sugestões múltiplas
     */
    function findProductByName(ingredientName: string, allProducts: any[]): any {
      const nome = normalizeSearchTerm(ingredientName || '').trim();
      if (!nome) return { found: false, suggestions: [], isZeroCost: false };
      
      console.log(`🔍 Buscando ingrediente: "${ingredientName}" → normalizado: "${nome}"`);
      
      // 1. Verificar cache de sugestões aprovadas
      if (approvedSuggestions.has(nome)) {
        const approved = approvedSuggestions.get(nome);
        console.log(`✅ Usando sugestão aprovada: ${approved.descricao}`);
        return { found: true, product: approved, fromCache: true };
      }
      
      // 2. Verificar se é ingrediente de custo zero automático
      if (INGREDIENT_MAPPINGS.has(nome.toUpperCase()) && 
          INGREDIENT_MAPPINGS.get(nome.toUpperCase())?.length === 0) {
        console.log(`💧 Ingrediente custo zero: ${ingredientName}`);
        return { 
          found: false, 
          suggestions: [], 
          isZeroCost: true,
          alert: `${ingredientName} é ingrediente básico (custo zero)` 
        };
      }
      
      // 3. Cache de busca para evitar recálculos
      if (searchCache.has(nome)) {
        return searchCache.get(nome);
      }
      
      // 4. Buscar produtos por similaridade
      const scoredProducts = allProducts
        .map(produto => ({
          produto,
          score: calculateSimilarityScore(nome, produto.descricao || '')
        }))
        .filter(p => p.score > 30)
        .sort((a, b) => b.score - a.score);
      
      // 5. Buscar também nos mapeamentos automáticos
      const mappedTerms = INGREDIENT_MAPPINGS.get(nome.toUpperCase()) || [];
      for (const mappedTerm of mappedTerms) {
        const mappedResults = allProducts
          .map(produto => ({
            produto,
            score: calculateSimilarityScore(mappedTerm, produto.descricao || '')
          }))
          .filter(p => p.score > 30);
        
        scoredProducts.push(...mappedResults);
      }
      
      // Remover duplicatas e re-ordernar
      const uniqueProducts = Array.from(
        new Map(scoredProducts.map(p => [p.produto.descricao, p])).values()
      ).sort((a, b) => b.score - a.score);
      
      let result;
      
      if (uniqueProducts.length === 0) {
        console.log(`❌ Nenhum produto encontrado para: ${ingredientName}`);
        result = {
          found: false,
          suggestions: [],
          alert: `Ingrediente "${ingredientName}" não encontrado no mercado`,
          searchTerm: nome
        };
      } else {
        const topSuggestions = uniqueProducts.slice(0, 5); // Top 5 sugestões
        const melhorMatch = topSuggestions[0];
        
        console.log(`📋 ${topSuggestions.length} sugestões para "${ingredientName}":`);
        topSuggestions.forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.produto.descricao} (score: ${s.score})`);
        });
        
        if (melhorMatch.score >= 95) {
          // Auto-aprovar matches perfeitos
          console.log(`✅ Auto-aprovando match perfeito: ${melhorMatch.produto.descricao}`);
          result = { found: true, product: melhorMatch.produto, autoApproved: true };
        } else if (melhorMatch.score >= 85 && topSuggestions.length === 1) {
          // Auto-aprovar se só tem 1 opção com score alto
          console.log(`✅ Auto-aprovando única opção com score alto: ${melhorMatch.produto.descricao}`);
          result = { found: true, product: melhorMatch.produto, autoApproved: true };
        } else {
          // Múltiplas sugestões - requer aprovação
          result = {
            found: false,
            suggestions: topSuggestions.map(s => ({
              ...s.produto,
              similarity_score: s.score,
              is_suggestion: true
            })),
            alert: `"${ingredientName}" requer aprovação - ${topSuggestions.length} opções encontradas`,
            bestMatch: melhorMatch.produto,
            searchTerm: nome
          };
        }
      }
      
      searchCache.set(nome, result);
      return result;
    }
    
    /**
     * Aprova uma sugestão para uso futuro
     */
    function approveSuggestion(originalName: string, approvedProduct: any) {
      const normalizedName = normalizeSearchTerm(originalName);
      approvedSuggestions.set(normalizedName, approvedProduct);
      console.log(`✅ Sugestão aprovada: "${originalName}" → "${approvedProduct.descricao}"`);
    }

    // Processar produtos do mercado com parsing inteligente
    const mercado: any[] = [];
    const produtosPorNome = new Map<string, any[]>(); // para fallback por nome
    
    for (const r of (mercadoRows ?? [])) {
      const parsedDesc = parseProductDescription(r.descricao || '');
      const produtoProcessado = {
        produto_base_id: Number(r.produto_base_id) || null,
        descricao: r.descricao || '',
        nome_produto: parsedDesc.nome,
        preco_centavos: Number(r.preco) || 0,
        preco_reais: (Number(r.preco) || 0) / 100, // CORREÇÃO: dividir por 100
        unidade: (r.unidade || '').toUpperCase(),
        embalagem_tamanho: parsedDesc.tamanho || Number(r.produto_base_quantidade_embalagem) || 1,
        embalagem_unidade: parsedDesc.unidade || r.unidade || 'UN',
        apenas_valor_inteiro_sim_nao: !!r.apenas_valor_inteiro_sim_nao,
        em_promocao_sim_nao: !!r.em_promocao_sim_nao,
      };
      
      mercado.push(produtoProcessado);
      
      // Indexar por palavras-chave para busca por nome
      const palavras = parsedDesc.nome.split(/\s+/).filter(p => p.length > 2);
      for (const palavra of palavras) {
        if (!produtosPorNome.has(palavra)) {
          produtosPorNome.set(palavra, []);
        }
        produtosPorNome.get(palavra)!.push(produtoProcessado);
      }
    }

    console.log(`[menu] Processados ${mercado.length} produtos do mercado`);
    
    // Validação básica de preços
    let precosInvalidos = 0;
    for (const produto of mercado) {
      if (produto.preco_reais > 1000) { // R$ 1000 por unidade é suspeito
        console.warn(`Preço suspeito: ${produto.descricao} = R$ ${produto.preco_reais}`);
        precosInvalidos++;
      }
    }
    
    if (precosInvalidos > 0) {
      warnings.push(`${precosInvalidos} produtos com preços possivelmente incorretos encontrados`);
    }

    // Sistema robusto de conversão de unidades
    const UNIT_CONVERSIONS = {
      // Peso
      'G': { base: 'G', factor: 1 },
      'GRAMAS': { base: 'G', factor: 1 },
      'GRAMA': { base: 'G', factor: 1 },
      'KG': { base: 'G', factor: 1000 },
      'QUILOGRAMA': { base: 'G', factor: 1000 },
      'QUILOGRAMAS': { base: 'G', factor: 1000 },
      'QUILO': { base: 'G', factor: 1000 },
      'QUILOS': { base: 'G', factor: 1000 },
      
      // Volume
      'ML': { base: 'ML', factor: 1 },
      'MILILITRO': { base: 'ML', factor: 1 },
      'MILILITROS': { base: 'ML', factor: 1 },
      'L': { base: 'ML', factor: 1000 },
      'LITRO': { base: 'ML', factor: 1000 },
      'LITROS': { base: 'ML', factor: 1000 },
      'LT': { base: 'ML', factor: 1000 },
      
      // Unidades
      'UN': { base: 'UN', factor: 1 },
      'UNIDADE': { base: 'UN', factor: 1 },
      'UNIDADES': { base: 'UN', factor: 1 },
      'PC': { base: 'UN', factor: 1 },
      'PEÇA': { base: 'UN', factor: 1 },
      'PEÇAS': { base: 'UN', factor: 1 }
    };

    const toMercadoBase = (qtd: number, unidadeIngrediente: string, unidadeMercado: string) => {
      const origem = (unidadeIngrediente || '').trim().toUpperCase();
      const destino = (unidadeMercado || '').trim().toUpperCase();
      
      // Mesma unidade
      if (origem === destino) {
        return { ok: true, valor: qtd, conversao: `${origem} → ${destino} (sem conversão)` };
      }
      
      const configOrigem = UNIT_CONVERSIONS[origem];
      const configDestino = UNIT_CONVERSIONS[destino];
      
      // Unidades não reconhecidas
      if (!configOrigem || !configDestino) {
        console.warn(`Unidade não reconhecida: ${origem} ou ${destino}`);
        return { ok: false, valor: qtd, erro: `Unidade não reconhecida: ${origem} ou ${destino}` };
      }
      
      // Bases incompatíveis (peso vs volume)
      if (configOrigem.base !== configDestino.base) {
        console.warn(`Conversão impossível: ${configOrigem.base} ≠ ${configDestino.base}`);
        return { ok: false, valor: qtd, erro: `Conversão impossível: ${configOrigem.base} ≠ ${configDestino.base}` };
      }
      
      // Conversão
      const valorBase = qtd * configOrigem.factor;
      const valorFinal = valorBase / configDestino.factor;
      const conversao = `${qtd} ${origem} → ${valorFinal} ${destino}`;
      
      console.log(`Conversão realizada: ${conversao}`);
      return { ok: true, valor: valorFinal, conversao };
    };

    type MarketRow = {
      produto_base_id: number;
      descricao: string;
      preco: number;
      unidade: string;
      apenas_valor_inteiro_sim_nao: boolean;
      produto_base_quantidade_embalagem: number;
      em_promocao_sim_nao: boolean;
    };

    // Indexar produtos processados por produto_base_id E por nome
    const marketByProduto = new Map<number, any[]>();
    const marketByNome = new Map<string, any[]>();
    
    for (const produto of mercado) {
      // Indexar por produto_base_id quando disponível
      if (produto.produto_base_id && produto.produto_base_id > 0) {
        if (!marketByProduto.has(produto.produto_base_id)) {
          marketByProduto.set(produto.produto_base_id, []);
        }
        marketByProduto.get(produto.produto_base_id)!.push(produto);
      }
      
      // Indexar por palavras-chave do nome
      const palavras = produto.nome_produto.split(/\s+/).filter(p => p.length > 2);
      for (const palavra of palavras) {
        if (!marketByNome.has(palavra)) {
          marketByNome.set(palavra, []);
        }
        marketByNome.get(palavra)!.push(produto);
      }
    }

    // Sistema inteligente de cálculo de custo com embalagens reais
    const calcularCustoIngrediente = (ing: any) => {
      const resultado = calcularCustoIngredienteDetalhado(ing);
      return resultado.custo;
    };

    const calcularCustoIngredienteDetalhado = (ing: any) => {
      try {
        console.log(`\n[custo] Calculando ingrediente: ${ing.produto_base_descricao || ing.nome} (ID: ${ing.produto_base_id})`);
        console.log(`[custo] Quantidade necessária: ${ing.quantidade} ${ing.unidade}`);
        
        // Tratamento especial para água (ID 17) - custo zero
        if (Number(ing.produto_base_id) === 17) {
          console.log(`[custo] ÁGUA detectada - aplicando custo zero`);
          return { 
            custo: 0, 
            detalhes: {
              nome: 'ÁGUA',
              quantidade_necessaria: Number(ing.quantidade ?? 0),
              unidade: String(ing.unidade ?? ''),
              custo_unitario: 0,
              custo_total: 0,
              observacao: 'Ingrediente básico - custo zero',
              status: 'zero_cost'
            } 
          };
        }
        
        // Busca no mercado - primeiro por produto_base_id, depois por nome
        let produtoMercado = null;
        
        // 1. Busca direta por produto_base_id
        if (ing.produto_base_id && marketByProduto.has(Number(ing.produto_base_id))) {
          const produtos = marketByProduto.get(Number(ing.produto_base_id));
          produtoMercado = produtos[0]; // Usar primeiro resultado
          console.log(`[custo] ✓ Encontrado por ID ${ing.produto_base_id}: ${produtoMercado.descricao}`);
        }
        
        // 2. Se não encontrou por ID, busca por nome com sistema inteligente
        if (!produtoMercado) {
          const nomeIngrediente = ing.produto_base_descricao || ing.nome || '';
          const searchResult = findProductByName(nomeIngrediente, mercado);
          
          if (searchResult.found) {
            produtoMercado = searchResult.product;
            console.log(`[custo] ✓ Encontrado por nome: "${nomeIngrediente}" → "${produtoMercado.descricao}"`);
          } else if (searchResult.isZeroCost) {
            // Ingrediente de custo zero automático (água, etc.)
            console.log(`[custo] 💧 Custo zero automático: ${nomeIngrediente}`);
            return { 
              custo: 0, 
              detalhes: {
                nome: nomeIngrediente,
                quantidade_necessaria: Number(ing.quantidade ?? 0),
                unidade: String(ing.unidade ?? ''),
                custo_unitario: 0,
                custo_total: 0,
                observacao: searchResult.alert || 'Ingrediente básico - custo zero',
                status: 'zero_cost_automatic'
              }
            };
          } else {
            // Ingrediente não encontrado - retornar com sugestões
            console.log(`[custo] ❌ Ingrediente não encontrado: ${nomeIngrediente}`);
            if (searchResult.suggestions && searchResult.suggestions.length > 0) {
              console.log(`[custo] 💡 ${searchResult.suggestions.length} sugestões disponíveis`);
            }
            
            return { 
              custo: 0, 
              violacao: {
                tipo: 'ingrediente_nao_encontrado',
                ingrediente: nomeIngrediente,
                produto_base_id: ing.produto_base_id,
                sugestoes: searchResult.suggestions || [],
                alert: searchResult.alert || `Ingrediente "${nomeIngrediente}" não encontrado`,
                search_term: searchResult.searchTerm
              },
              detalhes: {
                nome: nomeIngrediente,
                quantidade_necessaria: Number(ing.quantidade ?? 0),
                unidade: String(ing.unidade ?? ''),
                custo_unitario: 0,
                custo_total: 0,
                observacao: searchResult.alert || 'Ingrediente não encontrado no mercado',
                status: 'not_found_with_suggestions',
                sugestoes_count: searchResult.suggestions?.length || 0
              }
            };
          }
        }
        
        // Calcular custo usando dados do mercado
        const quantidadeNecessaria = Number(ing.quantidade ?? 0);
        const unidadeIngrediente = String(ing.unidade ?? '').trim().toUpperCase();
        const unidadeMercado = String(produtoMercado.unidade ?? '').trim().toUpperCase();
        const precoMercado = Number(produtoMercado.preco ?? 0);
        const embalagem = Number(produtoMercado.produto_base_quantidade_embalagem ?? 1);
        
        // Converter unidades se necessário
        const conversao = toMercadoBase(quantidadeNecessaria, unidadeIngrediente, unidadeMercado);
        
        if (!conversao.ok) {
          console.error(`[custo] Conversão falhou: ${quantidadeNecessaria} ${unidadeIngrediente} → ${unidadeMercado}`);
          console.error(conversao.erro);
          
          return { 
            custo: 0, 
            violacao: {
              tipo: 'conversao_falhou',
              erro: conversao.erro,
              ingrediente: ing.produto_base_descricao || ing.nome
            },
            detalhes: {
              nome: ing.produto_base_descricao || ing.nome,
              quantidade_necessaria: quantidadeNecessaria,
              unidade: unidadeIngrediente,
              custo_unitario: 0,
              custo_total: 0,
              observacao: `Erro de conversão: ${conversao.erro}`,
              status: 'conversion_error'
            }
          };
        }
        
        const quantidadeConvertida = conversao.valor;
        const fatorEmbalagem = Math.ceil(quantidadeConvertida / embalagem);
        const custoTotal = fatorEmbalagem * precoMercado;
        
        console.log(`[custo] ${produtoMercado.descricao}: ${quantidadeNecessaria} ${unidadeIngrediente} → ${embalagem} ${unidadeMercado} × ${fatorEmbalagem.toFixed(2)} = R$ ${custoTotal.toFixed(2)}`);
        
        return { 
          custo: custoTotal, 
          detalhes: {
            nome: produtoMercado.descricao,
            quantidade_necessaria: quantidadeNecessaria,
            quantidade_convertida: quantidadeConvertida,
            unidade: unidadeIngrediente,
            unidade_mercado: unidadeMercado,
            embalagem_mercado: embalagem,
            fator_embalagem: fatorEmbalagem,
            preco_unitario: precoMercado,
            custo_total: custoTotal,
            conversao: conversao.conversao,
            status: 'encontrado'
          }
        };
        
      } catch (error) {
        console.error(`[custo] Erro ao calcular ingrediente ${ing.produto_base_descricao}:`, error);
        return { 
          custo: 0, 
          violacao: {
            tipo: 'erro_calculo',
            erro: error.message,
            ingrediente: ing.produto_base_descricao || ing.nome
          },
          detalhes: {
            nome: ing.produto_base_descricao || ing.nome,
            quantidade_necessaria: Number(ing.quantidade ?? 0),
            unidade: String(ing.unidade ?? ''),
            custo_unitario: 0,
            custo_total: 0,
            observacao: `Erro no cálculo: ${error.message}`,
            status: 'error'
          }
        };
      }
    };

            const custoTotal = embalagensNecessarias * produto.preco_reais;
            
            // Bonus para produtos em promoção (reduzir custo efetivo)
            const custoEfetivo = produto.em_promocao_sim_nao ? custoTotal * 0.9 : custoTotal;
            
            const detalhes = {
              produto: produto.descricao,
              necessidade: `${quantidadeNecessaria} ${unidadeNecessaria}`,
              conversao: conversao.conversao,
              embalagem: `${tamanhoEmbalagem} ${produto.embalagem_unidade}`,
              embalagens_necessarias: embalagensNecessarias,
              preco_embalagem: produto.preco_reais,
              custo_total: custoTotal,
              promocao: produto.em_promocao_sim_nao,
              pode_fracionado: !produto.apenas_valor_inteiro_sim_nao,
              eficiencia_uso: necessidadeNaUnidadeProduto / tamanhoEmbalagem,
            };
            
            if (custoEfetivo < melhorCusto) {
              melhorCusto = custoEfetivo;
              melhorProduto = produto;
              melhorDetalhes = detalhes;
            }
            
          } catch (e) {
            console.error(`[custo] Erro processando produto ${produto.descricao}:`, e);
          }
        }

    // Sistema corrigido de escalonamento de receitas
    function calculateScalingFactor(targetServings: number, recipeIngredients: any[]): number {
      // Usar quantidade_refeicoes real da receita, não valor fixo
      const recipeBaseServings = recipeIngredients[0]?.quantidade_refeicoes || 100;
      const fator = targetServings / recipeBaseServings;
      
      console.log(`Escalonamento: ${recipeBaseServings} → ${targetServings} (fator: ${fator.toFixed(3)})`);
      return fator;
    }

    function validateIngredient(ingredient: any): { valido: boolean; erros: string[]; avisos: string[] } {
      const erros: string[] = [];
      const avisos: string[] = [];
      
      // Validações obrigatórias
      if (!ingredient.produto_base_descricao && !ingredient.nome) {
        erros.push('Nome do ingrediente ausente');
      }
      
      if (!ingredient.unidade) {
        erros.push('Unidade não especificada');
      }
      
      // Validação de quantidade
      const quantidade = Number(ingredient.quantidade || 0);
      if (isNaN(quantidade)) {
        erros.push('Quantidade não é um número válido');
      } else if (quantidade <= 0) {
        erros.push('Quantidade deve ser maior que zero');
      } else if (quantidade > 10000) {
        avisos.push(`Quantidade muito alta: ${quantidade} ${ingredient.unidade}`);
      }
      
      return { valido: erros.length === 0, erros, avisos };
    }

    function costOfRecipe(receitaId: string, servings: number): number | null {
      try {
      // CORREÇÃO: Garantir conversão para string na busca de ingredientes
      const ings = ingByReceita.get(String(receitaId)) ?? [];
      if (!ings.length) {
        console.warn(`[costOfRecipe] Receita ${receitaId}: nenhum ingrediente encontrado`);
        warnings.push(`Receita ${receitaId}: nenhum ingrediente encontrado`);
        return null;
      }

        // Validar ingredientes
        const ingredientesValidos = [];
        for (const ing of ings) {
          const validacao = validateIngredient(ing);
          if (!validacao.valido) {
            console.warn(`Ingrediente inválido ${ing.produto_base_descricao}:`, validacao.erros);
            warnings.push(`Ingrediente ${ing.produto_base_descricao}: ${validacao.erros.join(', ')}`);
            continue; // Pular ingrediente inválido
          }
          if (validacao.avisos.length > 0) {
            console.warn(`Aviso ingrediente ${ing.produto_base_descricao}:`, validacao.avisos);
          }
          ingredientesValidos.push(ing);
        }

        if (!ingredientesValidos.length) {
          warnings.push(`Receita ${receitaId}: todos os ingredientes são inválidos`);
          return null;
        }

        // Calcular fator de escalonamento usando dados reais
        const fator = calculateScalingFactor(servings, ingredientesValidos);
        let total = 0;

        // Escalar ingredientes com dados de auditoria
        const ingredientesEscalados = ingredientesValidos.map((ing) => ({
          produto_base_id: ing.produto_base_id,
          nome: ing.produto_base_descricao || '',
          quantidade: Number(ing.quantidade ?? 0) * fator,
          quantidade_original: Number(ing.quantidade ?? 0),
          fator_escalonamento: fator,
          receita_base_servings: ingredientesValidos[0]?.quantidade_refeicoes || 100,
          unidade: ing.unidade
        }));

        // Calcular custo de cada ingrediente com proteção
        const ingredientesDetalhados = [];
        const violacoesReceita = [];
        
        for (const ing of ingredientesEscalados) {
          const resultado = calcularCustoIngredienteDetalhado(ing);
          total += resultado.custo;
          ingredientesDetalhados.push(resultado.detalhes);
          
          // Coletar violações para rastreabilidade
          if (resultado.violacao) {
            violacoesReceita.push(resultado.violacao);
          }
          
          // Log apenas para ingredientes com problemas
          if (resultado.detalhes.status !== 'encontrado') {
            console.log(`[${resultado.detalhes.status}] ${ing.nome}: R$ ${resultado.custo.toFixed(2)} - ${resultado.detalhes.motivo || 'Processado'}`);
          }
        }

        // Contabilizar estatísticas para relatório
        const totalIngredientes = ingredientesDetalhados.length;
        const ingredientesEncontrados = ingredientesDetalhados.filter(d => d.status === 'encontrado' || d.produto_encontrado).length;
        const ingredientesZeroCost = ingredientesDetalhados.filter(d => d.status === 'zero_cost_automatic').length;
        const ingredientesComSugestoes = ingredientesDetalhados.filter(d => d.status === 'not_found_with_suggestions').length;
        const ingredientesSemSolucao = ingredientesDetalhados.filter(d => d.status === 'not_found' && d.sugestoes_count === 0).length;
        
        console.log(`📊 Estatísticas da receita ${receitaId}:`);
        console.log(`   Total: ${totalIngredientes} | Encontrados: ${ingredientesEncontrados} | Zero Cost: ${ingredientesZeroCost}`);
        console.log(`   Com Sugestões: ${ingredientesComSugestoes} | Sem Solução: ${ingredientesSemSolucao}`);
        console.log(`   Custo Total: R$ ${total.toFixed(2)} | Violações: ${violacoesReceita.length}`);

        return { 
          total, 
          ingredientesDetalhados, 
          violacoes: violacoesReceita,
          estatisticas: {
            total_ingredientes: totalIngredientes,
            ingredientes_encontrados: ingredientesEncontrados,
            ingredientes_zero_cost: ingredientesZeroCost,
            ingredientes_com_sugestoes: ingredientesComSugestoes,
            ingredientes_sem_solucao: ingredientesSemSolucao,
            taxa_sucesso: Math.round((ingredientesEncontrados / totalIngredientes) * 100)
          }
        };
      } catch (e) {
        console.error('[menu] erro costOfRecipe', receitaId, e);
        warnings.push(`Erro no cálculo da receita ${receitaId}: ${e.message}`);
        return null;
      }
    }

    const usedBySlot: UsedTracker = {};
    const usedThisWeek: Set<string> = new Set(); // Rotação semanal

    function markUsed(slot: string, id: string) {
      if (!usedBySlot[slot]) usedBySlot[slot] = new Set();
      usedBySlot[slot].add(id);
      usedThisWeek.add(id); // Adicionar à rotação semanal
    }
    
    function isUsed(slot: string, id: string) {
      return !!usedBySlot[slot]?.has(id);
    }
    
    function pickUnique(pool: any[], slot: string) {
      // Priorizar receitas 100% válidas que não foram usadas esta semana
      let r = pool?.find(x => 
        x.classificacao === '100_valid' && 
        !isUsed(slot, String(x.receita_id_legado)) && 
        !usedThisWeek.has(String(x.receita_id_legado))
      );
      
      // Se não encontrou 100% válida não usada, tentar "quase válida"
      if (!r) {
        r = pool?.find(x => 
          x.classificacao === 'almost_valid' && 
          !isUsed(slot, String(x.receita_id_legado)) && 
          !usedThisWeek.has(String(x.receita_id_legado))
        );
      }
      
      // Se não encontrou nenhuma, permitir reutilização (resetar ciclo)
      if (!r && pool?.length) {
        usedBySlot[slot] = new Set();
        r = pool.find(x => x.classificacao === '100_valid') || pool[0];
      }
      
      return r ?? null;
    }

    function pickCheapest(cat: string, servings: number, excludeIds = new Set<string>()) {
      const list = candidatesByCat[cat] ?? [];
      let best: { r: any; cost: number } | null = null;
      for (const r of list) {
        // CORREÇÃO: Garantir conversão para string na comparação
        const id = String(r.receita_id_legado);
        if (excludeIds.has(id)) continue;
        const c = costOfRecipe(id, servings);
        if (c == null) continue;
        if (!best || c < best.cost) best = { r, cost: c };
      }
      return best ? { ...best.r, _cost: best.cost } : null;
    }

    // Pools de candidatos com custo
    const poolPP1: any[] = [];
    const poolPP2: any[] = [];
    const poolSaladas: any[] = [];
    const poolSucos: any[] = [];

    // Preencher pools com custos calculados
      for (const cat of ["PRATO PRINCIPAL 1", "PRATO PRINCIPAL 2"]) {
      const candidates = candidatesByCat[cat] ?? [];
      const pool = cat === "PRATO PRINCIPAL 1" ? poolPP1 : poolPP2;
      
      for (const r of candidates) {
        const resultado = costOfRecipe(String(r.receita_id_legado), refeicoesPorDia);
        if (resultado !== null && typeof resultado === 'object') {
          // Classificar receita por número de violações
          const numViolacoes = resultado.violacoes?.length || 0;
          let classificacao: '100_valid' | 'almost_valid' | 'invalid';
          
          if (numViolacoes === 0) {
            classificacao = '100_valid';
          } else if (numViolacoes <= 2) {
            classificacao = 'almost_valid';
          } else {
            classificacao = 'invalid';
          }
          
          // Só incluir receitas válidas ou "quase válidas"
          if (classificacao !== 'invalid') {
            pool.push({
              id: String(r.receita_id_legado),
              receita_id_legado: r.receita_id_legado,
              nome: r.nome_receita,
              _cost: resultado.total,
              custo_por_refeicao: resultado.total / refeicoesPorDia,
              ingredientes_detalhados: resultado.ingredientesDetalhados,
              violacoes: resultado.violacoes || [],
              classificacao
            });
          }
        } else if (typeof resultado === 'number') {
          // Backward compatibility - assumir válida se tem custo
          pool.push({
            id: String(r.receita_id_legado),
            receita_id_legado: r.receita_id_legado,
            nome: r.nome_receita,
            _cost: resultado,
            custo_por_refeicao: resultado / refeicoesPorDia,
            ingredientes_detalhados: [],
            violacoes: [],
            classificacao: '100_valid'
          });
        }
      }
      // Ordenar por classificação primeiro (100% válidas primeiro), depois por custo
      pool.sort((a, b) => {
        if (a.classificacao === '100_valid' && b.classificacao !== '100_valid') return -1;
        if (b.classificacao === '100_valid' && a.classificacao !== '100_valid') return 1;
        return a._cost - b._cost; // mais baratos primeiro dentro da mesma classificação
      });
    }

    // Saladas
    for (const cat of ["SALADA 1 (VERDURAS)", "SALADA 2 (LEGUMES)"]) {
      const candidates = candidatesByCat[cat] ?? [];
      for (const r of candidates) {
        const resultado = costOfRecipe(String(r.receita_id_legado), refeicoesPorDia);
        if (resultado !== null) {
          const cost = typeof resultado === 'object' ? resultado.total : resultado;
          poolSaladas.push({
            id: String(r.receita_id_legado),
            receita_id_legado: r.receita_id_legado,
            nome: r.nome_receita,
            _cost: cost,
            custo_por_refeicao: cost / refeicoesPorDia,
            ingredientes_detalhados: typeof resultado === 'object' ? resultado.ingredientesDetalhados : []
          });
        }
      }
    }
    poolSaladas.sort((a, b) => a._cost - b._cost);

    // Sucos
    for (const cat of ["SUCO 1", "SUCO 2"]) {
      const candidates = candidatesByCat[cat] ?? [];
      for (const r of candidates) {
        const resultado = costOfRecipe(String(r.receita_id_legado), refeicoesPorDia);
        if (resultado !== null) {
          const cost = typeof resultado === 'object' ? resultado.total : resultado;
          poolSucos.push({
            id: String(r.receita_id_legado),
            receita_id_legado: r.receita_id_legado,
            nome: r.nome_receita,
            _cost: cost,
            custo_por_refeicao: cost / refeicoesPorDia,
            ingredientes_detalhados: typeof resultado === 'object' ? resultado.ingredientesDetalhados : []
          });
        }
      }
    }
    poolSucos.sort((a, b) => a._cost - b._cost);

    // ARROZ obrigatório (usar baseRecipes.arroz se fornecido)
    let arroz;
    if (arrozReceita) {
      const resultado = costOfRecipe(String(arrozReceita.receita_id_legado), refeicoesPorDia);
      if (resultado !== null) {
        const cost = typeof resultado === 'object' ? resultado.total : resultado;
        arroz = { 
          ...arrozReceita, 
          _cost: cost, 
          id: String(arrozReceita.receita_id_legado),
          ingredientes_detalhados: typeof resultado === 'object' ? resultado.ingredientesDetalhados : []
        };
      }
    }
    if (!arroz) {
      arroz = pickCheapest("ARROZ BRANCO", refeicoesPorDia);
    }
    
    if (!arroz) {
      return bad(400, "Não foi possível precificar ARROZ");
    }

    // FEIJÃO obrigatório (usar baseRecipes.feijao se fornecido)
    let feijao;
    if (feijaoReceita) {
      const resultado = costOfRecipe(String(feijaoReceita.receita_id_legado), refeicoesPorDia);
      if (resultado !== null) {
        const cost = typeof resultado === 'object' ? resultado.total : resultado;
        feijao = { 
          ...feijaoReceita, 
          _cost: cost, 
          id: String(feijaoReceita.receita_id_legado),
          ingredientes_detalhados: typeof resultado === 'object' ? resultado.ingredientesDetalhados : []
        };
      }
    }
    if (!feijao) {
      feijao = pickCheapest("FEIJÃO", refeicoesPorDia);
    }
    
    if (!feijao) {
      warnings.push("Não foi possível precificar FEIJÃO - usando placeholder");
      feijao = { 
        id: String(feijaoBaseId), 
        _cost: 0, 
        nome_receita: 'FEIJÃO MIX - CARIOCA + BANDINHA 50%' 
      };
    }

    function ensureDayItems(
      dia: DiaLabel,
      refeicoesPorDia: number,
      budgetPerMeal: number,
      baseRecipes: any,
      pools: {
        pp1: Array<{ id: string; nome: string; custo_por_refeicao: number; _cost: number }>;
        pp2: Array<{ id: string; nome: string; custo_por_refeicao: number; _cost: number }>;
        saladas: Array<{ id: string; nome: string; custo_por_refeicao: number; _cost: number }>;
        sucos?: Array<{ id: string; nome: string; custo_por_refeicao: number; _cost: number }>;
      },
    ) {
      const itens: any[] = [];

      // ARROZ BRANCO (obrigatório)
      if (arroz._cost > 0) {
        itens.push({
          slot: 'ARROZ BRANCO',
          receita_id: arroz.id,
          nome: arrozReceita?.nome_receita || 'ARROZ BRANCO',
          custo_total: round2(arroz._cost),
          custo_por_refeicao: round2(arroz._cost / refeicoesPorDia),
          ingredientes: arroz.ingredientes_detalhados || []
        });
        markUsed('ARROZ BRANCO', arroz.id);
      } else {
        itens.push({ 
          slot: 'ARROZ BRANCO', 
          placeholder: true, 
          nome: `ARROZ (ID ${arrozBaseId} - SEM CUSTO)`, 
          custo_total: 0, 
          custo_por_refeicao: 0 
        });
      }

      // FEIJÃO (obrigatório com custo real)
      if (feijao._cost > 0) {
        itens.push({ 
          slot: 'FEIJÃO', 
          receita_id: feijao.id, 
          nome: feijaoReceita?.nome_receita || 'FEIJÃO MIX - CARIOCA + BANDINHA 50%',
          custo_total: round2(feijao._cost),
          custo_por_refeicao: round2(feijao._cost / refeicoesPorDia),
          ingredientes: feijao.ingredientes_detalhados || []
        });
        markUsed('FEIJÃO', feijao.id);
      } else {
        itens.push({ 
          slot: 'FEIJÃO', 
          placeholder: true, 
          nome: `FEIJÃO (ID ${feijaoBaseId} - SEM CUSTO)`, 
          custo_total: 0, 
          custo_por_refeicao: 0 
        });
      }

      // PP1
      const pp1 = pickUnique(pools.pp1, 'PRATO PRINCIPAL 1');
      if (pp1) {
        itens.push({ 
          slot: 'PRATO PRINCIPAL 1', 
          receita_id: pp1.id,
          nome: pp1.nome,
          custo_total: round2(pp1._cost),
          custo_por_refeicao: round2(pp1.custo_por_refeicao),
          ingredientes: pp1.ingredientes_detalhados || []
        });
        markUsed('PRATO PRINCIPAL 1', pp1.id);
      } else {
        itens.push({
          slot: 'PRATO PRINCIPAL 1',
          placeholder: true,
          nome: 'PRATO PRINCIPAL 1 (sem seleção)',
          custo_total: 0,
          custo_por_refeicao: 0
        });
      }

      // PP2
      const pp2 = pickUnique(pools.pp2, 'PRATO PRINCIPAL 2');
      if (pp2) {
        itens.push({ 
          slot: 'PRATO PRINCIPAL 2',
          receita_id: pp2.id,
          nome: pp2.nome,
          custo_total: round2(pp2._cost),
          custo_por_refeicao: round2(pp2.custo_por_refeicao),
          ingredientes: pp2.ingredientes_detalhados || []
        });
        markUsed('PRATO PRINCIPAL 2', pp2.id);
      } else {
        itens.push({
          slot: 'PRATO PRINCIPAL 2',
          placeholder: true,
          nome: 'PRATO PRINCIPAL 2 (sem seleção)',
          custo_total: 0,
          custo_por_refeicao: 0
        });
      }

      // Saladas (uma de folhas + uma de legumes)
      const s1 = pickUnique(pools.saladas, 'SALADA 1 (VERDURAS)');
      if (s1) {
        itens.push({ 
          slot: 'SALADA 1 (VERDURAS)',
          receita_id: s1.id,
          nome: s1.nome,
          custo_total: round2(s1._cost),
          custo_por_refeicao: round2(s1.custo_por_refeicao),
          ingredientes: s1.ingredientes_detalhados || []
        });
        markUsed('SALADA 1 (VERDURAS)', s1.id);
      } else {
        itens.push({
          slot: 'SALADA 1 (VERDURAS)',
          placeholder: true,
          nome: 'SALADA 1 (sem seleção)',
          custo_total: 0,
          custo_por_refeicao: 0
        });
      }

      const s2 = pickUnique(pools.saladas.filter(x => x.id !== s1?.id), 'SALADA 2 (LEGUMES)');
      if (s2) {
        itens.push({ 
          slot: 'SALADA 2 (LEGUMES)',
          receita_id: s2.id,
          nome: s2.nome,
          custo_total: round2(s2._cost),
          custo_por_refeicao: round2(s2.custo_por_refeicao),
          ingredientes: s2.ingredientes_detalhados || []
        });
        markUsed('SALADA 2 (LEGUMES)', s2.id);
      } else {
        itens.push({
          slot: 'SALADA 2 (LEGUMES)',
          placeholder: true,
          nome: 'SALADA 2 (sem seleção)',
          custo_total: 0,
          custo_por_refeicao: 0
        });
      }

      // SUCOS (se não vierem do pool, usa defaults)
      const sucos = (pools.sucos || []).filter(r => !isUsed('SUCO 1', r.id) && !isUsed('SUCO 2', r.id));
      if (sucos.length >= 2) {
        const [a, b] = sucos;
        itens.push({ 
          slot: 'SUCO 1',
          receita_id: a.id,
          nome: a.nome,
          custo_total: round2(a._cost),
          custo_por_refeicao: round2(a.custo_por_refeicao)
        });
        markUsed('SUCO 1', a.id);
        itens.push({ 
          slot: 'SUCO 2',
          receita_id: b.id,
          nome: b.nome,
          custo_total: round2(b._cost),
          custo_por_refeicao: round2(b.custo_por_refeicao)
        });
        markUsed('SUCO 2', b.id);
      } else if (sucos.length === 1) {
        const [a] = sucos;
        const [j1, j2] = DEFAULT_JUICES;
        itens.push({ 
          slot: 'SUCO 1',
          receita_id: a.id,
          nome: a.nome,
          custo_total: round2(a._cost),
          custo_por_refeicao: round2(a.custo_por_refeicao)
        });
        markUsed('SUCO 1', a.id);
        itens.push({ 
          slot: 'SUCO 2', 
          receita_id: String(j2.id), 
          nome: j2.nome, 
          custo_total: 0, 
          custo_por_refeicao: 0 
        });
        markUsed('SUCO 2', String(j2.id));
      } else {
        const [j1, j2] = DEFAULT_JUICES;
        itens.push({ 
          slot: 'SUCO 1', 
          receita_id: String(j1.id), 
          nome: j1.nome, 
          custo_total: 0, 
          custo_por_refeicao: 0 
        });
        itens.push({ 
          slot: 'SUCO 2', 
          receita_id: String(j2.id), 
          nome: j2.nome, 
          custo_total: 0, 
          custo_por_refeicao: 0 
        });
        markUsed('SUCO 1', String(j1.id));
        markUsed('SUCO 2', String(j2.id));
      }

      // Preenche slots faltantes com placeholders (segurança)
      for (const slot of REQUIRED_SLOTS) {
        if (!itens.some(x => x.slot === slot)) {
          itens.push({ 
            slot, 
            placeholder: true, 
            nome: `${slot} (sem seleção)`, 
            custo_total: 0, 
            custo_por_refeicao: 0 
          });
        }
      }

      return itens;
    }

    // Sistema para garantir variedade global entre todos os dias
    const globalUsedRecipes = new Set<string>();
    const days: any[] = [];
    let totalGeral = 0;

    for (let i = 0; i < numDays; i++) {
      const dia = dayLabelByIndex(i);
      const budgetLabel = getBudgetLabel(i, useDiaEspecial === true);
      const budgetPerMeal = getBudgetPerMealFromCustos(c0, budgetLabel);

      const itens = ensureDayItems(
        dia,
        refeicoesPorDia,
        budgetPerMeal,
        baseRecipes,
        {
          pp1: poolPP1,
          pp2: poolPP2,
          saladas: poolSaladas,
          sucos: poolSucos,
        }
      );

      const custo_total_dia = itens.reduce((s, it) =>
        s + (Number(it.custo_total || 0)), 0);
      const custo_por_refeicao = custo_total_dia / refeicoesPorDia;
      const dentro_orcamento = budgetPerMeal ? (custo_por_refeicao <= budgetPerMeal) : true;

      days.push({
        dia,
        label_orcamento: budgetLabel,
        budget_per_meal: round2(budgetPerMeal),
        custo_total_dia: round2(custo_total_dia),
        custo_por_refeicao: round2(custo_por_refeicao),
        dentro_orcamento,
        itens
      });

      totalGeral += custo_total_dia;
    }

    const totalPorcoes = refeicoesPorDia * numDays;
    const custoMedioPorPorcao = totalGeral / Math.max(totalPorcoes, 1);
    const orcamentoTotal = days.reduce((sum, day) => sum + (day.budget_per_meal * refeicoesPorDia), 0);

    console.log(`\n=== RESUMO FINAL DA GERAÇÃO ===`);
    console.log(`Total de dias gerados: ${days.length}`);
    console.log(`Custo total do menu: R$ ${round2(totalGeral)}`);
    console.log(`Orçamento disponível: R$ ${round2(orcamentoTotal)}`);
    console.log(`${totalGeral <= orcamentoTotal ? '✅ DENTRO DO ORÇAMENTO' : '❌ ACIMA DO ORÇAMENTO'}`);
    console.log(`Economia obtida: R$ ${round2(orcamentoTotal - totalGeral)}`);
    console.log(`Percentual usado: ${round2((totalGeral / orcamentoTotal) * 100)}%`);
    console.log(`Custo médio por refeição: R$ ${round2(custoMedioPorPorcao)}`);
    console.log(`===============================\n`);

    // Gerar shopping list básico
    const shoppingList: any[] = [];
    const produtosUsados = new Map<number, { nome: string; quantidade: number; unidade: string; custo: number }>();

    for (const day of days) {
      for (const item of day.itens) {
        if (item.placeholder || !item.receita_id) continue;
        
        const ings = ingByReceita.get(item.receita_id) ?? [];
        const fator = refeicoesPorDia / (ings[0]?.quantidade_refeicoes || 100);
        
        for (const ing of ings) {
          const prodId = Number(ing.produto_base_id);
          if (!prodId) continue;
          
          // Usar escalonamento corrigido baseado em quantidade_refeicoes real
          const baseServings = ings[0]?.quantidade_refeicoes || 100;
          const fatorCorreto = refeicoesPorDia / baseServings;
          
          const { qty: qtyBase } = toBaseQty(Number(ing.quantidade ?? 0), String(ing.unidade ?? ""));
          const necessidade = qtyBase * fatorCorreto;
          
          if (produtosUsados.has(prodId)) {
            produtosUsados.get(prodId)!.quantidade += necessidade;
          } else {
            produtosUsados.set(prodId, {
              nome: ing.produto_base_descricao || ing.nome || `Produto ${prodId}`,
              quantidade: necessidade,
              unidade: toBaseQty(1, String(ing.unidade ?? "")).base,
              custo: 0 // TODO: calcular custo estimado
            });
          }
        }
      }
    }

    for (const [prodId, info] of produtosUsados) {
      shoppingList.push({
        produto_base_id: prodId,
        nome: info.nome,
        unidade_base: info.unidade,
        quantidade_base: round2(info.quantidade),
        custo_estimado: round2(info.custo),
      });
    }

    return json({
      success: true,
      menu: {
        days,
        total_cost: round2(totalGeral),
        average_cost_per_meal: round2(custoMedioPorPorcao),
        portions_total: totalPorcoes,
      },
      shoppingList,
      warnings,
    });
  } catch (e: any) {
    console.error("[menu] unhandled", e);
    return bad(500, e?.message ?? "Erro interno do servidor");
  }
});
