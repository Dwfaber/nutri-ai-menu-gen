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

// SISTEMA DE CONVERSÃO ULTRA-ROBUSTO
function toBaseQty(qtd: number, unidade: string): { qty: number; base: "KG" | "LT" | "UN"; fallback?: boolean } {
  // Validação de entrada
  if (!isFinite(qtd) || qtd <= 0) return { qty: 0.1, base: "UN", fallback: true };
  
  // Normalização agressiva da unidade
  const u = String(unidade ?? "").trim().toUpperCase()
    .replace(/[^A-Z]/g, "") // Remove caracteres especiais
    .replace(/GRAMAS?/, "GR")
    .replace(/QUILOS?/, "KG")
    .replace(/LITROS?/, "LT")
    .replace(/MILILITROS?/, "ML");
  
  // Conversões com fallbacks robustos
  if (["KG", "KILO", "QUILO", "KILOS", "QUILOS", "KILOGRAM"].includes(u)) {
    return { qty: qtd, base: "KG" };
  }
  if (["G", "GR", "GRAM", "GRAMA", "GRAMAS"].includes(u)) {
    return { qty: qtd <= 100 ? qtd / 1000 : qtd, base: "KG" }; // Smart conversion
  }
  if (["L", "LT", "LITRO", "LITROS", "LITRE", "LITER"].includes(u)) {
    return { qty: qtd, base: "LT" };
  }
  if (["ML", "MILILITRO", "MILILITROS", "MILLILITER"].includes(u)) {
    return { qty: qtd / 1000, base: "LT" };
  }
  
  // Fallback inteligente baseado no valor
  if (qtd >= 1000) return { qty: qtd / 1000, base: "KG", fallback: true }; // Provavelmente gramas
  if (qtd >= 100 && qtd < 1000) return { qty: qtd / 1000, base: "LT", fallback: true }; // Provavelmente ML
  
  return { qty: qtd, base: "UN", fallback: !u }; // UN como último recurso
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


// FUNÇÃO DE FALLBACK DE EMERGÊNCIA
function createEmergencyFallbackMenu(numDays: number, refeicoesPorDia: number, custos: any) {
  console.log(`[EMERGENCY] Criando menu de emergência para ${numDays} dias`);
  
  function dayLabelByIndex(idx: number): string {
    const days = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
    return days[idx % 7];
  }
  
  function getBudgetLabel(dayIdx: number, useDiaEspecial: boolean): string {
    if (useDiaEspecial) return 'ESPECIAL';
    return dayLabelByIndex(dayIdx);
  }
  
  function getBudgetPerMealFromCustos(row: any, label: string): number {
    switch (label) {
      case 'SEGUNDA':  return Number(row.RefCustoSegunda) || 10;
      case 'TERÇA':    return Number(row.RefCustoTerca) || 10;
      case 'QUARTA':   return Number(row.RefCustoQuarta) || 10;
      case 'QUINTA':   return Number(row.RefCustoQuinta) || 10;
      case 'SEXTA':    return Number(row.RefCustoSexta) || 10;
      case 'SÁBADO':
      case 'SABADO':   return Number(row.RefCustoSabado) || 10;
      case 'DOMINGO':  return Number(row.RefCustoDomingo) || 10;
      case 'ESPECIAL': return Number(row.RefCustoDiaEspecial) || 10;
      default:         return 10;
    }
  }
  
  function round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
  
  const days: any[] = [];
  let totalCusto = 0;
  
  for (let i = 0; i < numDays; i++) {
    const dia = dayLabelByIndex(i);
    const budgetLabel = getBudgetLabel(i, false);
    const budgetPerMeal = getBudgetPerMealFromCustos(custos, budgetLabel);
    
    // Menu básico de emergência
    const itens = [
      { slot: 'ARROZ BRANCO', nome: 'Arroz Branco (Emergência)', custo_total: 1.50, custo_por_refeicao: 1.50 / refeicoesPorDia, placeholder: true },
      { slot: 'FEIJÃO', nome: 'Feijão (Emergência)', custo_total: 2.00, custo_por_refeicao: 2.00 / refeicoesPorDia, placeholder: true },
      { slot: 'PRATO PRINCIPAL 1', nome: 'Proteína (Emergência)', custo_total: 3.50, custo_por_refeicao: 3.50 / refeicoesPorDia, placeholder: true },
      { slot: 'SALADA 1 (VERDURAS)', nome: 'Salada Verde (Emergência)', custo_total: 1.00, custo_por_refeicao: 1.00 / refeicoesPorDia, placeholder: true },
      { slot: 'SUCO 1', nome: 'Suco Natural (Emergência)', custo_total: 1.00, custo_por_refeicao: 1.00 / refeicoesPorDia, placeholder: true }
    ];
    
    const custo_total_dia = itens.reduce((s, it) => s + (it.custo_total || 0), 0);
    const custo_por_refeicao = custo_total_dia / refeicoesPorDia;
    
    days.push({
      dia,
      label_orcamento: budgetLabel,
      budget_per_meal: round2(budgetPerMeal || 10),
      custo_total_dia: round2(custo_total_dia),
      custo_por_refeicao: round2(custo_por_refeicao),
      dentro_orcamento: true,
      emergency_mode: true,
      itens
    });
    
    totalCusto += custo_total_dia;
  }
  
  const totalPorcoes = refeicoesPorDia * numDays;
  const custoMedioPorPorcao = totalCusto / totalPorcoes;
  
  function json(obj: any) {
    return new Response(JSON.stringify(obj), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  return json({
    success: true,
    emergency_mode: true,
    menu: {
      days,
      total_cost: round2(totalCusto),
      average_cost_per_meal: round2(custoMedioPorPorcao),
      portions_total: totalPorcoes,
    },
    shoppingList: [],
    warnings: ['Menu de emergência gerado devido à falta de dados no sistema'],
  });
}

// ---------------- server ----------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Health check endpoint
  if (req.method === "GET") {
    return json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      version: "3.0-robust"
    });
  }

  // SISTEMA DE TIMEOUT GLOBAL PARA EVITAR SHUTDOWNS
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 55000; // 55 segundos máximo total
  
  const checkTimeout = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_EXECUTION_TIME) {
      console.error(`[TIMEOUT] Execução excedeu ${MAX_EXECUTION_TIME}ms, abortando graciosamente`);
      throw new Error(`Timeout global: execução muito longa (${elapsed}ms)`);
    }
    return elapsed;
  };

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

    // FASE 1: VALIDAÇÃO E LIMPEZA DE DADOS
    console.log(`[INIT] Iniciando geração de menu - Filial: ${filialIdLegado}, Dias: ${numDays}, Refeições: ${refeicoesPorDia}`);
    
    // Validação robusta de custos com fallback
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

    // Busca robusta de receitas base com múltiplos candidatos
    const arrozBaseId = getArrozBaseId(baseRecipes) || 580;
    let feijaoBaseId = getFeijaoBaseId(baseRecipes) || 1603;
    
    // CORREÇÃO: Sistema robusto de busca de receitas base
    let arrozReceita = (receitas ?? []).find(r => 
      r.receita_id_legado === String(arrozBaseId) || 
      like(r.nome_receita, ["arroz", "branco"])
    );
    
    let feijaoReceita = (receitas ?? []).find(r => 
      r.receita_id_legado === String(feijaoBaseId) || 
      like(r.nome_receita, ["feij"])
    );
    
    // Fallback inteligente para feijão se ID 1603 não existe
    if (!feijaoReceita) {
      const feijaoAlternatives = [1600, 1601, 1602, 1604, 1605]; // IDs alternativos
      for (const altId of feijaoAlternatives) {
        feijaoReceita = (receitas ?? []).find(r => r.receita_id_legado === String(altId));
        if (feijaoReceita) {
          console.log(`[INFO] Feijão encontrado com ID alternativo: ${altId}`);
          feijaoBaseId = altId;
          break;
        }
      }
    }
    
    const warnings = [];
    if (!arrozReceita) {
      console.warn("[AVISO] Receita de arroz base não encontrada, ID:", arrozBaseId);
      warnings.push(`Receita de arroz ID ${arrozBaseId} não encontrada`);
      // Criar receita de emergência
      arrozReceita = { receita_id_legado: String(arrozBaseId), nome_receita: "Arroz Branco (Emergency)", categoria_descricao: "CEREAIS" };
    }
    if (!feijaoReceita) {
      console.warn("[AVISO] Receita de feijão base não encontrada, ID:", feijaoBaseId);
      warnings.push(`Receita de feijão ID ${feijaoBaseId} não encontrada`);
      // Criar receita de emergência
      feijaoReceita = { receita_id_legado: String(feijaoBaseId), nome_receita: "Feijão (Emergency)", categoria_descricao: "LEGUMINOSAS" };
    }

    // 3) Ingredientes de todas as receitas candidatas + receitas base obrigatórias
    const candidateIds = [
      ...new Set(CATS.flatMap((c) => candidatesByCat[c].map((r) => String(r.receita_id_legado)))),
      String(arrozBaseId),   // Incluir arroz base
      String(feijaoBaseId)   // Incluir feijão base
    ];
    
    console.log(`[DEBUG] CandidateIds inicial: ${candidateIds.length} receitas`, candidateIds.slice(0, 10));
    
    if (candidateIds.length === 0) {
      return bad(400, "Nenhuma receita candidata encontrada");
    }

    // BUSCA INICIAL: Ingredientes das receitas candidatas
    const { data: ingredientes, error: iErr } = await supabase
      .from("receita_ingredientes")
      .select(`
        receita_id_legado, 
        produto_base_id, 
        produto_base_descricao, 
        quantidade, 
        unidade, 
        quantidade_refeicoes
      `)
      .in("receita_id_legado", candidateIds);

    if (iErr) {
      console.error("[receita_ingredientes]", iErr);
      return bad(500, "Erro ao consultar receita_ingredientes");
    }

    const ingByReceita = new Map<string, any[]>();
    // Organizar ingredientes por receita
    for (const ing of ingredientes ?? []) {
      const key = String(ing.receita_id_legado);
      (ingByReceita.get(key) ?? ingByReceita.set(key, []).get(key))!.push(ing);
    }
    
    console.log(`[DEBUG] Receitas com ingredientes carregados: ${ingByReceita.size}`);
    
    // Checkpoint de timeout
    checkTimeout();
    
    // FUNÇÃO AUXILIAR: Buscar ingredientes para receitas não incluídas na busca inicial
    async function buscarIngredientesAdicionais(receitasExtras: string[]): Promise<void> {
      if (receitasExtras.length === 0) return;
      
      checkTimeout(); // Verificar timeout antes de operação pesada
      console.log(`[DEBUG] Buscando ingredientes para ${receitasExtras.length} receitas extras:`, receitasExtras);
      
      const { data: ingredientesExtras, error: extraErr } = await supabase
        .from("receita_ingredientes")
        .select(`
          receita_id_legado, 
          produto_base_id, 
          produto_base_descricao, 
          quantidade, 
          unidade, 
          quantidade_refeicoes
        `)
        .in("receita_id_legado", receitasExtras);

      if (extraErr) {
        console.error("[buscarIngredientesAdicionais]", extraErr);
        return;
      }

      // Adicionar ao mapa existente
      for (const ing of ingredientesExtras ?? []) {
        const key = String(ing.receita_id_legado);
        (ingByReceita.get(key) ?? ingByReceita.set(key, []).get(key))!.push(ing);
      }
      
      console.log(`[DEBUG] Total de receitas com ingredientes após busca extra: ${ingByReceita.size}`);
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
     * MELHORADO: Remove pesos mais eficientemente (ex: "ARROZ 5KG" → "ARROZ")
     */
    function normalizeSearchTerm(text: string): string {
      if (!text) return '';
      
      return text
        .normalize('NFD') // Remove acentos
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s*-\s*/g, ' ') // Remove hífens
        // MELHORADO: Remove especificações de peso mais abrangentes
        .replace(/\b\d+\s*(KGS?|GR?S?|G|GRAMAS?|QUILOS?|L|LITROS?|ML|MILILITROS?|UND?|UNIDADES?|PCT?|PACOTES?|CX|CAIXAS?)\b/gi, '')
        .replace(/\b\d+\s*X\s*\d+\b/gi, '') // Remove "90GR X 36"
        .replace(/\(\s*\d+.*?\)/gi, '') // Remove conteúdo entre parênteses com números
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
    
    // FASE 3: SISTEMA DE CONVERSÃO ULTRA-ROBUSTO COM FALLBACKS
    function toMercadoBase(quantidade: number, unidadeOrigem: string, unidadeDestino: string) {
      try {
        if (!isFinite(quantidade) || quantidade <= 0) {
          return { ok: false, erro: `Quantidade inválida: ${quantidade}` };
        }
        
        // Normalização agressiva das unidades
        const origem = String(unidadeOrigem || '').trim().toUpperCase()
          .replace(/[^A-Z]/g, '') // Remove números e símbolos
          .replace(/GRAMAS?/, 'GR')
          .replace(/QUILOS?/, 'KG') 
          .replace(/LITROS?/, 'LT')
          .replace(/MILILITROS?/, 'ML');
          
        const destino = String(unidadeDestino || '').trim().toUpperCase()
          .replace(/[^A-Z]/g, '')
          .replace(/GRAMAS?/, 'GR')
          .replace(/QUILOS?/, 'KG')
          .replace(/LITROS?/, 'LT')
          .replace(/MILILITROS?/, 'ML');
        
        // Se as unidades são iguais após normalização
        if (origem === destino) {
          return { ok: true, valor: quantidade, conversao: 'nenhuma' };
        }
        
        // CONVERSÕES DE PESO
        if ((origem === 'KG' && destino === 'GR') || (origem === 'KG' && destino === 'G')) {
          return { ok: true, valor: quantidade * 1000, conversao: 'peso_kg_para_gr' };
        }
        if ((origem === 'GR' && destino === 'KG') || (origem === 'G' && destino === 'KG')) {
          return { ok: true, valor: quantidade / 1000, conversao: 'peso_gr_para_kg' };
        }
        
        // CONVERSÕES DE VOLUME
        if (origem === 'LT' && (destino === 'ML' || destino === 'MILILITROS')) {
          return { ok: true, valor: quantidade * 1000, conversao: 'volume_lt_para_ml' };
        }
        if ((origem === 'ML' || origem === 'MILILITROS') && destino === 'LT') {
          return { ok: true, valor: quantidade / 1000, conversao: 'volume_ml_para_lt' };
        }
        
        // CONVERSÕES APROXIMADAS INTELIGENTES
        // KG <-> LT (assumindo densidade ~1 para líquidos básicos)
        if (origem === 'KG' && destino === 'LT') {
          console.warn(`[CONV] Conversão aproximada KG → LT (densidade ~1): ${quantidade}`);
          return { ok: true, valor: quantidade, conversao: 'aproximada_kg_lt', warning: true };
        }
        if (origem === 'LT' && destino === 'KG') {
          console.warn(`[CONV] Conversão aproximada LT → KG (densidade ~1): ${quantidade}`);
          return { ok: true, valor: quantidade, conversao: 'aproximada_lt_kg', warning: true };
        }
        
        // FALLBACKS INTELIGENTES - Aceitar conversão direta em casos específicos
        if ((origem.includes('G') && destino.includes('G')) || 
            (origem.includes('L') && destino.includes('L')) ||
            (origem.includes('KG') && destino.includes('KG'))) {
          console.warn(`[CONV] Fallback: assumindo unidades compatíveis ${origem} → ${destino}`);
          return { ok: true, valor: quantidade, conversao: 'fallback_compativel', warning: true };
        }
        
        // ÚLTIMO RECURSO: Para pequenas quantidades, assumir conversão direta
        if (quantidade <= 10) {
          console.warn(`[CONV] Fallback para quantidade pequena: ${quantidade} ${origem} → ${destino}`);
          return { ok: true, valor: quantidade, conversao: 'fallback_pequena_quantidade', warning: true };
        }
        
        // Conversão não possível
        return { 
          ok: false, 
          erro: `Conversão não suportada: ${quantidade} ${unidadeOrigem} → ${unidadeDestino}`,
          suggested_value: quantidade // Valor sugerido como fallback
        };
        
      } catch (error) {
        console.error(`[CONV] Erro na conversão:`, error);
        return { 
          ok: false, 
          erro: `Erro interno: ${error.message}`,
          suggested_value: quantidade
        };
      }
    }
    
    // FASE 4: SISTEMA DE TIMEOUT PARA EVITAR SHUTDOWNS
    const createTimeoutWrapper = (timeoutMs: number) => {
      return {
        run: async <T>(promise: Promise<T>, fallbackValue: T): Promise<T> => {
          const timeoutPromise = new Promise<T>((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms excedido`)), timeoutMs);
          });
          
          try {
            return await Promise.race([promise, timeoutPromise]);
          } catch (error) {
            console.warn(`[TIMEOUT] ${error.message}, usando fallback`);
            return fallbackValue;
          }
        }
      };
    };
    
    const timeoutManager = createTimeoutWrapper(8000); // 8 segundos máximo por operação
    
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
    
    // VALIDAÇÃO APRIMORADA DE DADOS SUFICIENTES
    console.log(`[VALIDAÇÃO] Receitas disponíveis: ${receitas?.length || 0}`);
    console.log(`[VALIDAÇÃO] Produtos do mercado: ${mercado.length}`);
    console.log(`[VALIDAÇÃO] Receitas com ingredientes: ${ingByReceita.size}`);
    console.log(`[VALIDAÇÃO] Candidatos por categoria:`, Object.keys(candidatesByCat).map(cat => `${cat}: ${candidatesByCat[cat].length}`));
    
    // Validação inteligente: só criar fallback se realmente não houver dados mínimos
    const temReceitasBasicas = receitas && receitas.length > 0;
    const temProdutosMercado = mercado.length > 0;
    const temAlgunsIngredientes = ingByReceita.size > 0;
    const temCandidatos = Object.values(candidatesByCat).some(cat => cat.length > 0);
    
    // CONDIÇÃO CORRIGIDA: só fallback se dados críticos estiverem ausentes
    if (!temReceitasBasicas || !temProdutosMercado) {
      console.warn(`[FALLBACK] Dados críticos ausentes:`, {
        receitas: temReceitasBasicas,
        mercado: temProdutosMercado,
        ingredientes: temAlgunsIngredientes,
        candidatos: temCandidatos
      });
      
      return createEmergencyFallbackMenu(numDays, refeicoesPorDia, c0);
    }
    
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

    // FASE 2: SISTEMA DE VALIDAÇÃO E LIMPEZA DE DADOS ROBUSTA
    // Função para validar e limpar dados de produtos
    const validateAndCleanProduct = (produto: any) => {
      if (!produto) return null;
      
      // Limpeza de preços
      let preco = Number(produto.preco);
      if (!isFinite(preco) || preco < 0) {
        preco = 0; // Será tratado depois com fallbacks inteligentes
      }
      
      // Limpeza de descrição
      let descricao = String(produto.descricao || '').trim();
      if (!descricao || descricao === 'null' || descricao === 'undefined') {
        descricao = `Produto_${produto.produto_base_id || 'UNKNOWN'}`;
      }
      
      // Limpeza de embalagem
      let embalagem = Number(produto.produto_base_quantidade_embalagem);
      if (!isFinite(embalagem) || embalagem <= 0) {
        embalagem = 1;
      }
      
      return {
        ...produto,
        preco,
        descricao,
        produto_base_quantidade_embalagem: embalagem,
        _cleaned: true
      };
    };
    
    // Indexar produtos processados por produto_base_id E por nome com cache otimizado
    const marketByProduto = new Map<number, any[]>();
    const marketByNome = new Map<string, any[]>();
    const productCache = new Map<string, any>(); // Cache para buscas
    
    console.log(`[CACHE] Indexando ${mercado.length} produtos do mercado...`);
    let produtosLimpos = 0;
    
    for (const produto of mercado) {
      const produtoLimpo = validateAndCleanProduct(produto);
      if (!produtoLimpo) continue;
      
      produtosLimpos++;
      
      // Indexar por produto_base_id quando disponível
      if (produtoLimpo.produto_base_id && produtoLimpo.produto_base_id > 0) {
        if (!marketByProduto.has(produtoLimpo.produto_base_id)) {
          marketByProduto.set(produtoLimpo.produto_base_id, []);
        }
        marketByProduto.get(produtoLimpo.produto_base_id)!.push(produtoLimpo);
      }
      
      // Indexar por palavras-chave do nome normalizado
      const nomeNormalizado = produtoLimpo.descricao.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, ' ') // Normaliza espaços
        .trim();
        
      const palavras = nomeNormalizado.split(/\s+/).filter(p => p.length > 2);
      for (const palavra of palavras) {
        if (!marketByNome.has(palavra)) {
          marketByNome.set(palavra, []);
        }
        marketByNome.get(palavra)!.push(produtoLimpo);
      }
    }
    
    console.log(`[CACHE] ✓ ${produtosLimpos} produtos indexados com sucesso`);

    // FASE 2: SISTEMA DE VALIDAÇÃO DE INGREDIENTES ULTRA-ROBUSTO
    const validateIngredient = (ingrediente: any) => {
      const erros = [];
      const avisos = [];
      
      if (!ingrediente) {
        erros.push('Ingrediente é null ou undefined');
        return { valido: false, erros, avisos };
      }
      
      if (!ingrediente.produto_base_id && !ingrediente.produto_base_descricao) {
        erros.push('Falta produto_base_id e produto_base_descricao');
      }
      
      const quantidade = Number(ingrediente.quantidade);
      if (!isFinite(quantidade) || quantidade <= 0) {
        erros.push(`Quantidade inválida: ${ingrediente.quantidade}`);
      }
      
      if (!ingrediente.unidade || String(ingrediente.unidade).trim() === '') {
        avisos.push('Unidade não especificada, assumindo UN');
      }
      
      return { 
        valido: erros.length === 0, 
        erros, 
        avisos 
      };
    };
    
    // FASE 3: SISTEMA DE ESCALONAMENTO ROBUSTO
    const calculateScalingFactor = (targetServings: number, ingredientes: any[]) => {
      if (!ingredientes?.length) return 1;
      
      // Usar quantidade_refeicoes do primeiro ingrediente como base
      const baseServings = Number(ingredientes[0]?.quantidade_refeicoes) || 100;
      
      if (!isFinite(baseServings) || baseServings <= 0) {
        console.warn(`[SCALE] Base servings inválido: ${baseServings}, usando fallback 100`);
        return targetServings / 100;
      }
      
      const factor = targetServings / baseServings;
      console.log(`Escalonamento: ${baseServings} → ${targetServings} (fator: ${factor.toFixed(3)})`);
      
      return factor;
    };
    
    // FASE 4: PREÇOS DE EMERGÊNCIA PARA INGREDIENTES ESSENCIAIS
    const EMERGENCY_PRICES = new Map<string, number>([
      // Ingredientes básicos com preços médios estimados
      ['arroz', 6.0],
      ['feijao', 8.0],
      ['feijão', 8.0],
      ['oleo', 4.5],
      ['óleo', 4.5],
      ['sal', 2.0],
      ['cebola', 3.5],
      ['alho', 15.0],
      ['tomate', 4.0],
      ['batata', 3.0],
      ['cenoura', 3.5],
      ['carne', 25.0],
      ['frango', 12.0],
      ['peixe', 18.0]
    ]);
    
    const getEmergencyPrice = (nomeIngrediente: string): number | null => {
      const nome = nomeIngrediente.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      for (const [key, price] of EMERGENCY_PRICES) {
        if (nome.includes(key)) {
          console.log(`[EMERGENCY] Preço de emergência aplicado para ${nomeIngrediente}: R$ ${price}`);
          return price;
        }
      }
      
      return null;
    };
    
    // Sistema inteligente de cálculo de custo com embalagens reais
    const calcularCustoIngrediente = (ing: any) => {
      const resultado = calcularCustoIngredienteDetalhado(ing);
      return resultado.custo;
    };

    const calcularCustoIngredienteDetalhado = (ing: any) => {
      try {
        // VALIDAÇÃO CRÍTICA: Verificar se ingrediente é válido
        if (!ing) {
          console.error(`[custo] ❌ Ingrediente undefined ou null`);
          return { 
            custo: 0, 
            detalhes: {
              nome: 'ERRO - Ingrediente inválido',
              quantidade_necessaria: 0,
              unidade: '',
              custo_unitario: 0,
              custo_total: 0,
              observacao: 'Ingrediente undefined ou null',
              status: 'invalid_ingredient'
            }
          };
        }

        const nomeIngrediente = ing.produto_base_descricao || ing.nome || `ID_${ing.produto_base_id}` || 'DESCONHECIDO';
        console.log(`\n[custo] Calculando ingrediente: ${nomeIngrediente} (ID: ${ing.produto_base_id})`);
        console.log(`[custo] Quantidade necessária: ${ing.quantidade} ${ing.unidade}`);
        
        // VALIDAÇÃO ROBUSTA: Verificar dados essenciais
        const quantidade = Number(ing.quantidade ?? 0);
        const unidade = String(ing.unidade ?? '').trim();
        
        if (isNaN(quantidade) || quantidade <= 0) {
          console.warn(`[custo] ⚠️ Quantidade inválida para ${nomeIngrediente}: ${ing.quantidade}`);
          return { 
            custo: 0, 
            detalhes: {
              nome: nomeIngrediente,
              quantidade_necessaria: quantidade,
              unidade: unidade,
              custo_unitario: 0,
              custo_total: 0,
              observacao: `Quantidade inválida: ${ing.quantidade}`,
              status: 'invalid_quantity'
            }
          };
        }
        
        // Tratamento especial para água (ID 17) - custo zero
        if (Number(ing.produto_base_id) === 17) {
          console.log(`[custo] ÁGUA detectada - aplicando custo zero`);
          return { 
            custo: 0, 
            detalhes: {
              nome: 'ÁGUA',
              quantidade_necessaria: quantidade,
              unidade: unidade,
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
          
          // Log específico para ARROZ (ID 38)
          if (ing.produto_base_id === 38) {
            console.log(`[DEBUG ARROZ] Produto selecionado:`, {
              descricao: produtoMercado.descricao,
              preco: produtoMercado.preco,
              quantidade_embalagem: produtoMercado.produto_base_quantidade_embalagem,
              apenas_inteiro: produtoMercado.apenas_valor_inteiro_sim_nao,
              em_promocao: produtoMercado.em_promocao_sim_nao,
              unidade: produtoMercado.unidade
            });
          }
        }
        
    // 2. Se não encontrou por ID, busca por nome com sistema inteligente
    if (!produtoMercado) {
      // CORRIGIDO: Usar apenas produto_base_descricao, nunca ing.nome (nome da receita)
      const nomeIngredienteBusca = ing.produto_base_descricao || '';
      
      if (!nomeIngredienteBusca) {
        console.log(`[custo] ❌ Ingrediente sem nome: produto_base_id=${ing.produto_base_id}`);
        return { 
          custo: 0, 
          violacao: {
            tipo: 'ingrediente_sem_nome',
            produto_base_id: ing.produto_base_id,
            descricao: 'Ingrediente sem descrição na base de dados',
            necessaria_atualizacao: true
          },
          detalhes: {
            nome: `ID_${ing.produto_base_id}` || 'DESCONHECIDO',
            quantidade_necessaria: quantidade,
            unidade: unidade,
            custo_unitario: 0,
            custo_total: 0,
            observacao: 'Ingrediente sem descrição na base de dados',
            status: 'missing_description'
          }
        };
      }
      
      const searchResult = findProductByName(nomeIngredienteBusca, mercado);
          
          if (searchResult.found) {
            produtoMercado = searchResult.product;
            console.log(`[custo] ✓ Encontrado por nome: "${nomeIngredienteBusca}" → "${produtoMercado.descricao}"`);
          } else if (searchResult.isZeroCost) {
            // Ingrediente de custo zero automático (água, etc.)
            console.log(`[custo] 💧 Custo zero automático: ${nomeIngredienteBusca}`);
            return { 
              custo: 0, 
              detalhes: {
                nome: nomeIngredienteBusca,
                quantidade_necessaria: quantidade,
                unidade: unidade,
                custo_unitario: 0,
                custo_total: 0,
                observacao: searchResult.alert || 'Ingrediente básico - custo zero',
                status: 'zero_cost_automatic'
              }
            };
          } else {
            // MELHORADO: Log mais detalhado para ingredientes não encontrados
            console.log(`[custo] ❌ Ingrediente não encontrado: "${nomeIngredienteBusca}"`);
            console.log(`[custo]    produto_base_id: ${ing.produto_base_id || 'N/A'}`);
            console.log(`[custo]    receita_id: ${ing.receita_id_legado}`);
            if (searchResult.suggestions && searchResult.suggestions.length > 0) {
              console.log(`[custo] 💡 ${searchResult.suggestions.length} sugestões disponíveis:`);
              searchResult.suggestions.forEach((sug: any, i: number) => {
                console.log(`[custo]    ${i+1}. ${sug.descricao} (score: ${sug.score})`);
              });
            } else {
              console.log(`[custo] 💡 Nenhuma sugestão encontrada - possível problema de normalização`);
            }
            
            return { 
              custo: 0, 
              violacao: {
                tipo: 'ingrediente_nao_encontrado',
                ingrediente: nomeIngredienteBusca,
                produto_base_id: ing.produto_base_id,
                sugestoes: searchResult.suggestions || [],
                alert: searchResult.alert || `Ingrediente "${nomeIngredienteBusca}" não encontrado`,
                search_term: searchResult.searchTerm
              },
              detalhes: {
                nome: nomeIngredienteBusca,
                quantidade_necessaria: quantidade,
                unidade: unidade,
                custo_unitario: 0,
                custo_total: 0,
                observacao: searchResult.alert || 'Ingrediente não encontrado no mercado',
                status: 'not_found_with_suggestions',
                sugestoes_count: searchResult.suggestions?.length || 0
              }
            };
          }
        }
        
        // VALIDAÇÃO CRÍTICA: Verificar se produto do mercado é válido
        if (!produtoMercado || !produtoMercado.descricao) {
          console.error(`[custo] ❌ Produto do mercado inválido para ${nomeIngrediente}`);
          return { 
            custo: 0, 
            detalhes: {
              nome: nomeIngrediente,
              quantidade_necessaria: quantidade,
              unidade: unidade,
              custo_unitario: 0,
              custo_total: 0,
              observacao: 'Produto do mercado inválido',
              status: 'invalid_market_product'
            }
          };
        }

        // Calcular custo usando dados do mercado
        const unidadeIngrediente = unidade.toUpperCase();
        const unidadeMercado = String(produtoMercado.unidade ?? '').trim().toUpperCase();
        const precoMercado = Number(produtoMercado.preco ?? 0);
        const embalagem = Number(produtoMercado.produto_base_quantidade_embalagem ?? 1);
        
        // VALIDAÇÃO: Verificar se preço é válido COM FALLBACK INTELIGENTE
        if (isNaN(precoMercado) || precoMercado <= 0) {
          console.warn(`[custo] ⚠️ Preço inválido para ${produtoMercado.descricao}: ${produtoMercado.preco}`);
          
          // FALLBACK INTELIGENTE: Para arroz e feijão, usar preços médios estimados
          let precoEstimado = 0;
          const nomeNormalizado = (produtoMercado.descricao || '').toLowerCase();
          
          if (nomeNormalizado.includes('arroz')) {
            precoEstimado = 6.0; // R$ 6,00 por kg estimado para arroz
            console.log(`[custo] 🍚 Aplicando preço estimado para ARROZ: R$ ${precoEstimado}`);
          } else if (nomeNormalizado.includes('feijao') || nomeNormalizado.includes('feijão')) {
            precoEstimado = 8.0; // R$ 8,00 por kg estimado para feijão
            console.log(`[custo] 🫘 Aplicando preço estimado para FEIJÃO: R$ ${precoEstimado}`);
          } else {
            // Para outros ingredientes sem preço, retornar custo zero
            return { 
              custo: 0, 
              violacao: {
                tipo: 'preco_invalido',
                ingrediente: produtoMercado.descricao,
                preco_original: produtoMercado.preco
              },
              detalhes: {
                nome: produtoMercado.descricao,
                quantidade_necessaria: quantidade,
                unidade: unidadeIngrediente,
                custo_unitario: 0,
                custo_total: 0,
                observacao: `Preço inválido: ${produtoMercado.preco}`,
                status: 'invalid_price'
              }
            };
          }
          
          // Usar preço estimado para cálculo
          const quantidadeConvertida = toMercadoBase(quantidade, unidadeIngrediente, unidadeMercado)?.valor || quantidade;
          const custoEstimado = (quantidadeConvertida / embalagem) * precoEstimado;
          
          return {
            custo: custoEstimado,
            violacao: {
              tipo: 'preco_estimado', 
              ingrediente: produtoMercado.descricao,
              preco_original: produtoMercado.preco,
              preco_estimado: precoEstimado
            },
            detalhes: {
              nome: produtoMercado.descricao,
              quantidade_necessaria: quantidade,
              unidade: unidadeIngrediente,
              custo_unitario: precoEstimado / embalagem,
              custo_total: custoEstimado,
              observacao: `Preço estimado aplicado: R$ ${precoEstimado}`,
              status: 'estimated_price'
            }
          };
        }
        
        // Converter unidades se necessário com fallback robusto
        const conversao = toMercadoBase(quantidade, unidadeIngrediente, unidadeMercado);
        
        if (!conversao || !conversao.ok) {
          console.error(`[custo] Conversão falhou: ${quantidade} ${unidadeIngrediente} → ${unidadeMercado}`);
          console.error(conversao?.erro || 'Erro desconhecido na conversão');
          
          // Fallback: usar quantidade direta se unidades são similares
          let quantidadeFallback = quantidade;
          let observacaoFallback = `Erro de conversão: ${conversao?.erro || 'desconhecido'}`;
          
          // Tentativa de fallback inteligente
          if (unidadeIngrediente === unidadeMercado) {
            quantidadeFallback = quantidade;
            observacaoFallback = 'Conversão falhou, usando quantidade direta (mesma unidade)';
          } else if ((unidadeIngrediente === 'KG' || unidadeIngrediente === 'G') && 
                     (unidadeMercado === 'KG' || unidadeMercado === 'G')) {
            // Conversão básica peso
            quantidadeFallback = unidadeIngrediente === 'G' && unidadeMercado === 'KG' ? 
                                quantidade / 1000 : 
                                unidadeIngrediente === 'KG' && unidadeMercado === 'G' ?
                                quantidade * 1000 : quantidade;
            observacaoFallback = 'Conversão fallback aplicada para peso';
          } else {
            // Usar preço unitário estimado baixo para não prejudicar muito o cálculo
            const custoEstimado = quantidade * (precoMercado / embalagem) * 0.1; // 10% do preço normal
            return { 
              custo: custoEstimado, 
              violacao: {
                tipo: 'conversao_falhou',
                erro: conversao?.erro || 'Conversão retornou undefined',
                ingrediente: nomeIngrediente
              },
              detalhes: {
                nome: produtoMercado.descricao,
                quantidade_necessaria: quantidade,
                unidade: unidadeIngrediente,
                custo_unitario: precoMercado / embalagem * 0.1,
                custo_total: custoEstimado,
                observacao: `Erro de conversão, custo estimado: ${conversao?.erro || 'desconhecido'}`,
                status: 'conversion_error_estimated'
              }
            };
          }
          
          // Usar fallback para continuar o cálculo
          conversao.valor = quantidadeFallback;
          conversao.ok = true;
          conversao.conversao = observacaoFallback;
        }
        
        const quantidadeConvertida = conversao.valor || quantidade; // Fallback para quantidade original
        
        // VALIDAÇÃO: Verificar se quantidadeConvertida é válida
        if (isNaN(quantidadeConvertida) || quantidadeConvertida <= 0) {
          console.error(`[custo] ❌ Quantidade convertida inválida: ${quantidadeConvertida}`);
          return { 
            custo: 0, 
            detalhes: {
              nome: produtoMercado.descricao,
              quantidade_necessaria: quantidade,
              unidade: unidadeIngrediente,
              custo_unitario: 0,
              custo_total: 0,
              observacao: `Quantidade convertida inválida: ${quantidadeConvertida}`,
              status: 'invalid_converted_quantity'
            }
          };
        }
        
        // CORREÇÃO: Validação mais robusta para apenas_valor_inteiro
        const apenasValorInteiro = produtoMercado.apenas_valor_inteiro_sim_nao === true || 
                                   produtoMercado.apenas_valor_inteiro_sim_nao === 1 || 
                                   produtoMercado.apenas_valor_inteiro_sim_nao === "true";
        
        // Log específico para ARROZ (ID 38)
        if (ing.produto_base_id === 38) {
          console.log(`[DEBUG ARROZ] Cálculo detalhado:`, {
            quantidadeNecessaria,
            unidadeIngrediente,
            quantidadeConvertida,
            embalagem,
            precoMercado,
            apenasValorInteiro,
            raw_apenas_inteiro: produtoMercado.apenas_valor_inteiro_sim_nao
          });
        }
        
        // VALIDAÇÃO: Verificar se embalagem é válida
        if (isNaN(embalagem) || embalagem <= 0) {
          console.warn(`[custo] ⚠️ Embalagem inválida para ${produtoMercado.descricao}: ${embalagem}, usando 1`);
          embalagem = 1;
        }
        
        let fatorEmbalagem, custoTotal;
        
        try {
          if (apenasValorInteiro) {
            // Produto só pode ser comprado em embalagens inteiras
            fatorEmbalagem = Math.ceil(quantidadeConvertida / embalagem);
            custoTotal = fatorEmbalagem * precoMercado;
            console.log(`[custo] ${produtoMercado.descricao}: ${quantidade} ${unidadeIngrediente} → ${embalagem} ${unidadeMercado} × ${fatorEmbalagem} (inteiro) = R$ ${custoTotal.toFixed(2)}`);
            
            // Log extra para ARROZ
            if (ing.produto_base_id === 38) {
              console.log(`[DEBUG ARROZ] Cálculo inteiro: ${quantidadeConvertida} ÷ ${embalagem} = ${quantidadeConvertida / embalagem} → Math.ceil = ${fatorEmbalagem} × R$ ${precoMercado} = R$ ${custoTotal}`);
            }
          } else {
            // Produto pode ser comprado fracionado
            fatorEmbalagem = quantidadeConvertida / embalagem;
            custoTotal = fatorEmbalagem * precoMercado;
            console.log(`[custo] ${produtoMercado.descricao}: ${quantidade} ${unidadeIngrediente} → ${embalagem} ${unidadeMercado} × ${fatorEmbalagem.toFixed(4)} (fracionado) = R$ ${custoTotal.toFixed(2)}`);
          }
          
          // VALIDAÇÃO FINAL: Verificar se custo é válido
          if (isNaN(custoTotal) || custoTotal < 0) {
            console.error(`[custo] ❌ Custo calculado inválido: ${custoTotal}`);
            custoTotal = 0;
            fatorEmbalagem = 0;
          }
          
        } catch (calcError) {
          console.error(`[custo] ❌ Erro no cálculo matemático para ${nomeIngrediente}:`, calcError);
          custoTotal = 0;
          fatorEmbalagem = 0;
        }
        
        return { 
          custo: custoTotal, 
          detalhes: {
            nome: produtoMercado.descricao,
            quantidade_necessaria: quantidade,
            quantidade_convertida: quantidadeConvertida,
            unidade: unidadeIngrediente,
            unidade_mercado: unidadeMercado,
            embalagem_mercado: embalagem,
            fator_embalagem: fatorEmbalagem,
            preco_unitario: precoMercado,
            custo_total: custoTotal,
            conversao: conversao.conversao || 'Conversão aplicada',
            status: 'encontrado'
          }
        };
        
      } catch (error) {
        const errorMessage = error?.message || String(error) || 'Erro desconhecido';
        const nomeErro = ing?.produto_base_descricao || ing?.nome || `ID_${ing?.produto_base_id}` || 'DESCONHECIDO';
        
        console.error(`[custo] ❌ ERRO CRÍTICO ao calcular ingrediente ${nomeErro}:`, error);
        console.error(`[custo] Stack trace:`, error?.stack);
        
        // FALLBACK CRÍTICO: Sempre retornar objeto válido para evitar shutdown
        return { 
          custo: 0, 
          violacao: {
            tipo: 'erro_calculo_critico',
            erro: errorMessage,
            ingrediente: nomeErro,
            stack: error?.stack
          },
          detalhes: {
            nome: nomeErro,
            quantidade_necessaria: Number(ing?.quantidade ?? 0),
            unidade: String(ing?.unidade ?? ''),
            custo_unitario: 0,
            custo_total: 0,
            observacao: `ERRO CRÍTICO: ${errorMessage}`,
            status: 'critical_error'
          }
        };
      }
    };

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

    // FUNÇÃO AUXILIAR ROBUSTA: Buscar ingredientes de receita específica se não encontrada
    async function garantirIngredientesReceita(receitaId: string): Promise<any[]> {
      const key = String(receitaId);
      let ings = ingByReceita.get(key) ?? [];
      
      // Se não tem ingredientes, buscar individualmente
      if (!ings.length) {
        checkTimeout(); // Verificar timeout antes de consulta ao banco
        console.log(`[FASE 1] Buscando ingredientes para receita ${receitaId} não incluída no candidateIds`);
        
        const { data: ingredientesReceita, error: receitaErr } = await supabase
          .from("receita_ingredientes")
          .select(`
            receita_id_legado, 
            produto_base_id, 
            produto_base_descricao, 
            quantidade, 
            unidade, 
            quantidade_refeicoes
          `)
          .eq("receita_id_legado", receitaId);

        if (receitaErr) {
          console.error(`[FASE 1] Erro ao buscar receita ${receitaId}:`, receitaErr);
          return [];
        }

        ings = ingredientesReceita ?? [];
        if (ings.length > 0) {
          // Cache para próximas consultas
          ingByReceita.set(key, ings);
          console.log(`[FASE 1] ✓ Encontrados ${ings.length} ingredientes para receita ${receitaId}`);
        } else {
          console.warn(`[FASE 1] ✗ Receita ${receitaId} realmente não tem ingredientes no banco`);
        }
      }
      
      return ings;
    }

    // FASE 1: Função de custo robusta com busca automática de ingredientes
    async function costOfRecipe(receitaId: string, servings: number): Promise<any> {
      try {
        checkTimeout(); // Verificar timeout no início de cada cálculo
        // CORREÇÃO: Garantir ingredientes dinamicamente se não existirem
        let ings = ingByReceita.get(String(receitaId)) ?? [];
        
        if (!ings.length) {
          console.log(`[FASE 1] Receita ${receitaId}: ingredientes não encontrados, buscando...`);
          ings = await garantirIngredientesReceita(receitaId);
          
          if (!ings.length) {
            console.error(`[FASE 1] Receita ${receitaId}: nenhum ingrediente encontrado mesmo após busca individual`);
            return { 
              total: 0, 
              ingredientesDetalhados: [], 
              violacoes: [],
              estatisticas: {
                total_ingredientes: 0,
                ingredientes_encontrados: 0,
                ingredientes_zero_cost: 0,
                ingredientes_com_sugestoes: 0,
                ingredientes_sem_solucao: 0,
                taxa_sucesso: 0
              }
            };
          }
        }

        // FASE 2: Validar ingredientes com sistema robusto
        const ingredientesValidos = [];
        for (const ing of ings) {
          const validacao = validateIngredient(ing);
          if (!validacao.valido) {
            console.warn(`[FASE 2] Ingrediente inválido ${ing.produto_base_descricao}:`, validacao.erros);
            warnings.push(`Ingrediente ${ing.produto_base_descricao}: ${validacao.erros.join(', ')}`);
            continue;
          }
          if (validacao.avisos.length > 0) {
            console.warn(`[FASE 2] Aviso ingrediente ${ing.produto_base_descricao}:`, validacao.avisos);
          }
          ingredientesValidos.push(ing);
        }

        if (!ingredientesValidos.length) {
          console.warn(`[FASE 2] Receita ${receitaId}: todos os ingredientes são inválidos, criando fallback`);
          return { 
            total: 5.0, // Custo estimado de fallback
            ingredientesDetalhados: [{
              nome: 'Estimativa de custo',
              quantidade_necessaria: servings,
              custo_total: 5.0,
              observacao: 'Custo estimado - dados incompletos',
              status: 'fallback_estimate'
            }], 
            violacoes: [{
              tipo: 'dados_incompletos',
              receita_id: receitaId,
              descricao: 'Receita sem ingredientes válidos'
            }],
            estatisticas: {
              total_ingredientes: 1,
              ingredientes_encontrados: 0,
              ingredientes_zero_cost: 0,
              ingredientes_com_sugestoes: 0,
              ingredientes_sem_solucao: 1,
              taxa_sucesso: 0,
              modo_fallback: true
            }
          };
        }

        // FASE 3: Calcular fator de escalonamento robusto
        const fator = calculateScalingFactor(servings, ingredientesValidos);
        let total = 0;

        // Escalar ingredientes com dados de auditoria
        const ingredientesEscalados = ingredientesValidos.map((ing) => ({
          produto_base_id: ing.produto_base_id,
          nome: ing.produto_base_descricao || `Ingrediente_${ing.produto_base_id}`,
          quantidade: Number(ing.quantidade ?? 0) * fator,
          quantidade_original: Number(ing.quantidade ?? 0),
          fator_escalonamento: fator,
          receita_base_servings: ingredientesValidos[0]?.quantidade_refeicoes || 100,
          unidade: ing.unidade || 'UN'
        }));

        // FASE 3: Calcular custo com sistema de fallback robusto
        const ingredientesDetalhados = [];
        const violacoesReceita = [];
        let ingredientesComErro = 0;
        
        for (const ing of ingredientesEscalados) {
          try {
            const resultado = calcularCustoIngredienteDetalhado(ing);
            
            // FASE 4: Validação robusta com fallback inteligente
            if (!resultado) {
              console.warn(`[FASE 4] Resultado undefined para ${ing.nome}, criando fallback`);
              ingredientesComErro++;
              
              // Criar fallback inteligente
              const custoEstimado = Math.max(0.1, ing.quantidade * 0.01); // R$ 0.01 por unidade mínimo
              total += custoEstimado;
              
              ingredientesDetalhados.push({
                nome: ing.nome,
                quantidade_necessaria: ing.quantidade,
                unidade: ing.unidade,
                custo_total: custoEstimado,
                observacao: 'Custo estimado - cálculo falhou',
                status: 'fallback_error'
              });
              
              violacoesReceita.push({
                tipo: 'calculo_falhou',
                ingrediente: ing.nome,
                motivo: 'Função retornou undefined'
              });
              continue;
            }
            
            // Verificar se detalhes existe
            if (!resultado.detalhes) {
              console.warn(`[FASE 4] Detalhes undefined para ${ing.nome}, criando fallback`);
              ingredientesComErro++;
              
              const custoEstimado = resultado.custo || Math.max(0.1, ing.quantidade * 0.01);
              total += custoEstimado;
              
              ingredientesDetalhados.push({
                nome: ing.nome,
                quantidade_necessaria: ing.quantidade,
                unidade: ing.unidade,
                custo_total: custoEstimado,
                observacao: 'Custo calculado mas sem detalhes',
                status: 'partial_success'
              });
              
              if (resultado.violacao) {
                violacoesReceita.push(resultado.violacao);
              }
              continue;
            }
            
            // Sucesso total
            total += resultado.custo || 0;
            ingredientesDetalhados.push(resultado.detalhes);
            
            if (resultado.violacao) {
              violacoesReceita.push(resultado.violacao);
            }
            
            // Log apenas para ingredientes com problemas
            if (resultado.detalhes.status && resultado.detalhes.status !== 'encontrado') {
              console.log(`[FASE 4] [${resultado.detalhes.status}] ${ing.nome}: R$ ${(resultado.custo || 0).toFixed(2)} - ${resultado.detalhes.motivo || 'Processado'}`);
            }
          } catch (error) {
            console.error(`[FASE 4] Erro no processamento de ${ing.nome}:`, error);
            ingredientesComErro++;
            
            // Fallback para erros de processamento
            const custoEstimado = Math.max(0.5, ing.quantidade * 0.02);
            total += custoEstimado;
            
            ingredientesDetalhados.push({
              nome: ing.nome,
              quantidade_necessaria: ing.quantidade,
              unidade: ing.unidade,
              custo_total: custoEstimado,
              observacao: `Erro: ${error.message}`,
              status: 'error_fallback'
            });
            
            violacoesReceita.push({
              tipo: 'erro_processamento',
              ingrediente: ing.nome,
              erro: error.message
            });
          }
        }

        // FASE 5: Estatísticas detalhadas e logs estruturados
        const totalIngredientes = ingredientesDetalhados.length;
        const ingredientesEncontrados = ingredientesDetalhados.filter(d => 
          d.status === 'encontrado' || d.produto_encontrado
        ).length;
        const ingredientesZeroCost = ingredientesDetalhados.filter(d => 
          d.status === 'zero_cost_automatic'
        ).length;
        const ingredientesComSugestoes = ingredientesDetalhados.filter(d => 
          d.status === 'not_found_with_suggestions'
        ).length;
        const ingredientesSemSolucao = ingredientesDetalhados.filter(d => 
          d.status === 'not_found' && (!d.sugestoes_count || d.sugestoes_count === 0)
        ).length;
        const ingredientesFallback = ingredientesDetalhados.filter(d => 
          d.status?.includes('fallback') || d.status?.includes('error')
        ).length;
        
        console.log(`📊 [FASE 5] Estatísticas da receita ${receitaId}:`);
        console.log(`   Total: ${totalIngredientes} | Encontrados: ${ingredientesEncontrados} | Zero Cost: ${ingredientesZeroCost}`);
        console.log(`   Com Sugestões: ${ingredientesComSugestoes} | Sem Solução: ${ingredientesSemSolucao} | Fallback: ${ingredientesFallback}`);
        console.log(`   Custo Total: R$ ${total.toFixed(2)} | Violações: ${violacoesReceita.length} | Erros: ${ingredientesComErro}`);
        console.log(`   Taxa de Sucesso: ${Math.round((ingredientesEncontrados / totalIngredientes) * 100)}%`);

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
            ingredientes_fallback: ingredientesFallback,
            ingredientes_com_erro: ingredientesComErro,
            taxa_sucesso: Math.round((ingredientesEncontrados / totalIngredientes) * 100),
            custo_medio_por_ingrediente: totalIngredientes > 0 ? total / totalIngredientes : 0
          }
        };
      } catch (e) {
        console.error('[FASE 5] Erro crítico em costOfRecipe', receitaId, e);
        
        // FASE 4: Fallback de emergência para erros críticos
        const custoEmergencia = servings * 0.1; // R$ 0.10 por porção
        return { 
          total: custoEmergencia, 
          ingredientesDetalhados: [{
            nome: `Receita ${receitaId}`,
            quantidade_necessaria: servings,
            custo_total: custoEmergencia,
            observacao: `Erro crítico: ${e.message}`,
            status: 'emergency_fallback'
          }], 
          violacoes: [{
            tipo: 'erro_critico',
            receita_id: receitaId,
            erro: e.message
          }],
          estatisticas: {
            total_ingredientes: 1,
            ingredientes_encontrados: 0,
            ingredientes_zero_cost: 0,
            ingredientes_com_sugestoes: 0,
            ingredientes_sem_solucao: 0,
            ingredientes_fallback: 1,
            ingredientes_com_erro: 1,
            taxa_sucesso: 0,
            modo_emergencia: true
          }
        };
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

    async function pickCheapest(cat: string, servings: number, excludeIds = new Set<string>()) {
      const list = candidatesByCat[cat] ?? [];
      let best: { r: any; cost: number } | null = null;
      for (const r of list) {
        // CORREÇÃO: Garantir conversão para string na comparação
        const id = String(r.receita_id_legado);
        if (excludeIds.has(id)) continue;
        const resultado = await costOfRecipe(id, servings);
        const c = typeof resultado === 'object' ? resultado?.total : resultado;
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
        const resultado = await costOfRecipe(String(r.receita_id_legado), refeicoesPorDia);
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
        const resultado = await costOfRecipe(String(r.receita_id_legado), refeicoesPorDia);
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
        const resultado = await costOfRecipe(String(r.receita_id_legado), refeicoesPorDia);
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

    // ARROZ obrigatório com múltiplas tentativas de busca
    let arroz;
    const arrozIds = [arrozBaseId, 38, 1, 2]; // IDs alternativos para arroz
    
    // 1. Tentar receita base fornecida
    if (arrozReceita) {
      console.log(`[arroz] 🍚 Tentando receita base fornecida: ID ${arrozReceita.receita_id_legado}`);
      const resultado = await costOfRecipe(String(arrozReceita.receita_id_legado), refeicoesPorDia);
      if (resultado !== null) {
        const cost = typeof resultado === 'object' ? resultado.total : resultado;
        arroz = { 
          ...arrozReceita, 
          _cost: cost, 
          id: String(arrozReceita.receita_id_legado),
          ingredientes_detalhados: typeof resultado === 'object' ? resultado.ingredientesDetalhados : []
        };
        console.log(`[arroz] ✓ Receita base funcionou: R$ ${cost.toFixed(2)}`);
      }
    }
    
    // 2. Se não funcionou, tentar pool de candidatos
    if (!arroz) {
      console.log(`[arroz] 🔍 Tentando pool de candidatos ARROZ BRANCO`);
      arroz = await pickCheapest("ARROZ BRANCO", refeicoesPorDia);
      if (arroz) {
        console.log(`[arroz] ✓ Encontrado no pool: ${arroz.nome} R$ ${arroz._cost.toFixed(2)}`);
      }
    }
    
    // 3. Se ainda não funcionou, tentar IDs específicos
    if (!arroz) {
      console.log(`[arroz] 🎯 Tentando IDs específicos: ${arrozIds.join(', ')}`);
      for (const arrozId of arrozIds) {
        const { data: receitaEspecifica } = await supabase
          .from("receitas_legado")
          .select("*")
          .eq("receita_id_legado", String(arrozId))
          .limit(1);
          
        if (receitaEspecifica?.[0]) {
          const resultado = await costOfRecipe(String(arrozId), refeicoesPorDia);
          if (resultado !== null) {
            const cost = typeof resultado === 'object' ? resultado.total : resultado;
            arroz = {
              id: String(arrozId),
              receita_id_legado: arrozId,
              nome_receita: receitaEspecifica[0].nome_receita || 'ARROZ BRANCO',
              _cost: cost,
              ingredientes_detalhados: typeof resultado === 'object' ? resultado.ingredientesDetalhados : []
            };
            console.log(`[arroz] ✓ ID específico funcionou: ${arrozId} R$ ${cost.toFixed(2)}`);
            break;
          }
        }
      }
    }
    
    // 4. Se nada funcionou, criar placeholder obrigatório COM CUSTO ESTIMADO
    if (!arroz) {
      console.warn(`[arroz] ⚠️ Nenhuma receita de arroz encontrada, criando placeholder com custo estimado`);
      warnings.push("ARROZ: Receita não encontrada - usando custo estimado R$ 1.50");
      
      // GARANTIR que arroz sempre tem custo válido
      const custoEstimadoArroz = 1.50; // R$ 1,50 por refeição
      arroz = { 
        id: String(arrozBaseId), 
        _cost: custoEstimadoArroz * refeicoesPorDia, 
        custo_por_refeicao: custoEstimadoArroz,
        nome_receita: 'ARROZ BRANCO (ESTIMATIVA)',
        ingredientes_detalhados: [{
          nome: 'Arroz Branco',
          quantidade_necessaria: refeicoesPorDia * 0.08, // 80g por refeição
          unidade: 'KG',
          custo_total: custoEstimadoArroz * refeicoesPorDia,
          observacao: 'Custo estimado - dados de receita incompletos',
          status: 'estimated_placeholder'
        }],
        placeholder: true,
        observacao: 'Custo estimado aplicado automaticamente'
      };
    }

    // FEIJÃO obrigatório com múltiplas tentativas de busca
    let feijao;
    const feijaoIds = [feijaoBaseId, 1600, 3, 4, 5]; // IDs alternativos para feijão
    
    // 1. Tentar receita base fornecida
    if (feijaoReceita) {
      console.log(`[feijao] 🫘 Tentando receita base fornecida: ID ${feijaoReceita.receita_id_legado}`);
      const resultado = await costOfRecipe(String(feijaoReceita.receita_id_legado), refeicoesPorDia);
      if (resultado !== null) {
        const cost = typeof resultado === 'object' ? resultado.total : resultado;
        feijao = { 
          ...feijaoReceita, 
          _cost: cost, 
          id: String(feijaoReceita.receita_id_legado),
          ingredientes_detalhados: typeof resultado === 'object' ? resultado.ingredientesDetalhados : []
        };
        console.log(`[feijao] ✓ Receita base funcionou: R$ ${cost.toFixed(2)}`);
      }
    }
    
    // 2. Se não funcionou, tentar pool de candidatos
    if (!feijao) {
      console.log(`[feijao] 🔍 Tentando pool de candidatos FEIJÃO`);
      feijao = await pickCheapest("FEIJÃO", refeicoesPorDia);
      if (feijao) {
        console.log(`[feijao] ✓ Encontrado no pool: ${feijao.nome} R$ ${feijao._cost.toFixed(2)}`);
      }
    }
    
    // 3. Se ainda não funcionou, tentar IDs específicos
    if (!feijao) {
      console.log(`[feijao] 🎯 Tentando IDs específicos: ${feijaoIds.join(', ')}`);
      for (const feijaoId of feijaoIds) {
        const { data: receitaEspecifica } = await supabase
          .from("receitas_legado")
          .select("*")
          .eq("receita_id_legado", String(feijaoId))
          .limit(1);
          
        if (receitaEspecifica?.[0]) {
          const resultado = await costOfRecipe(String(feijaoId), refeicoesPorDia);
          if (resultado !== null) {
            const cost = typeof resultado === 'object' ? resultado.total : resultado;
            feijao = {
              id: String(feijaoId),
              receita_id_legado: feijaoId,
              nome_receita: receitaEspecifica[0].nome_receita || 'FEIJÃO MIX - CARIOCA + BANDINHA 50%',
              _cost: cost,
              ingredientes_detalhados: typeof resultado === 'object' ? resultado.ingredientesDetalhados : []
            };
            console.log(`[feijao] ✓ ID específico funcionou: ${feijaoId} R$ ${cost.toFixed(2)}`);
            break;
          }
        }
      }
    }
    
    // 4. Se nada funcionou, criar placeholder obrigatório COM CUSTO ESTIMADO
    if (!feijao) {
      console.warn(`[feijao] ⚠️ Nenhuma receita de feijão encontrada, criando placeholder com custo estimado`);
      warnings.push("FEIJÃO: Receita não encontrada - usando custo estimado R$ 2.00");
      
      // GARANTIR que feijão sempre tem custo válido
      const custoEstimadoFeijao = 2.00; // R$ 2,00 por refeição
      feijao = { 
        id: String(feijaoBaseId), 
        _cost: custoEstimadoFeijao * refeicoesPorDia, 
        custo_por_refeicao: custoEstimadoFeijao,
        nome_receita: 'FEIJÃO MIX - CARIOCA + BANDINHA 50% (ESTIMATIVA)',
        ingredientes_detalhados: [{
          nome: 'Feijão Carioca',
          quantidade_necessaria: refeicoesPorDia * 0.06, // 60g por refeição
          unidade: 'KG',
          custo_total: custoEstimadoFeijao * refeicoesPorDia,
          observacao: 'Custo estimado - dados de receita incompletos',
          status: 'estimated_placeholder'
        }],
        placeholder: true,
        observacao: 'Custo estimado aplicado automaticamente'
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

      // ARROZ BRANCO (SEMPRE OBRIGATÓRIO)
      itens.push({
        slot: 'ARROZ BRANCO',
        receita_id: arroz.id || String(arrozBaseId),
        nome: arroz.nome_receita || arrozReceita?.nome_receita || 'ARROZ BRANCO',
        custo_total: round2(arroz._cost || 0),
        custo_por_refeicao: round2((arroz._cost || 0) / refeicoesPorDia),
        ingredientes: arroz.ingredientes_detalhados || [],
        placeholder: arroz._cost === 0 || arroz.placeholder === true,
        observacao: arroz._cost === 0 ? 'Custo não calculado ou receita não encontrada' : undefined
      });
      if (arroz.id) markUsed('ARROZ BRANCO', arroz.id);

      // FEIJÃO (SEMPRE OBRIGATÓRIO)
      itens.push({ 
        slot: 'FEIJÃO', 
        receita_id: feijao.id || String(feijaoBaseId), 
        nome: feijao.nome_receita || feijaoReceita?.nome_receita || 'FEIJÃO MIX - CARIOCA + BANDINHA 50%',
        custo_total: round2(feijao._cost || 0),
        custo_por_refeicao: round2((feijao._cost || 0) / refeicoesPorDia),
        ingredientes: feijao.ingredientes_detalhados || [],
        placeholder: feijao._cost === 0 || feijao.placeholder === true,
        observacao: feijao._cost === 0 ? 'Custo não calculado ou receita não encontrada' : undefined
      });
      if (feijao.id) markUsed('FEIJÃO', feijao.id);

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

    // SISTEMA DE CORREÇÃO AUTOMÁTICA: Detectar receitas usadas sem ingredientes
    const receitasUsadasSemIngredientes = new Set<string>();
    
    for (const day of days) {
      for (const item of day.itens) {
        if (item.placeholder || !item.receita_id) continue;
        
        const receitaId = String(item.receita_id);
        const ings = ingByReceita.get(receitaId) ?? [];
        
        if (!ings.length) {
          receitasUsadasSemIngredientes.add(receitaId);
        }
      }
    }
    
    // Buscar ingredientes para receitas usadas que não foram pré-carregadas
    if (receitasUsadasSemIngredientes.size > 0) {
      console.log(`[CORREÇÃO] Detectadas ${receitasUsadasSemIngredientes.size} receitas usadas sem ingredientes:`, Array.from(receitasUsadasSemIngredientes));
      
      await buscarIngredientesAdicionais(Array.from(receitasUsadasSemIngredientes));
    }

    console.log(`\n=== RESUMO FINAL DA GERAÇÃO ===`);
    console.log(`Total de dias gerados: ${days.length}`);
    console.log(`Custo total do menu: R$ ${round2(totalGeral)}`);
    console.log(`Orçamento disponível: R$ ${round2(orcamentoTotal)}`);
    console.log(`${totalGeral <= orcamentoTotal ? '✅ DENTRO DO ORÇAMENTO' : '❌ ACIMA DO ORÇAMENTO'}`);
    console.log(`Economia obtida: R$ ${round2(orcamentoTotal - totalGeral)}`);
    console.log(`Percentual usado: ${round2((totalGeral / orcamentoTotal) * 100)}%`);
    console.log(`Custo médio por refeição: R$ ${round2(custoMedioPorPorcao)}`);
    console.log(`Receitas com ingredientes carregados: ${ingByReceita.size}`);
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

    // VALIDAÇÃO FINAL: Verificar timeout antes de retornar
    checkTimeout();
    
    const totalExecutionTime = Date.now() - startTime;
    console.log(`[SUCCESS] Menu gerado com sucesso em ${totalExecutionTime}ms`);
    
    return json({
      success: true,
      execution_time_ms: totalExecutionTime,
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
    const executionTime = Date.now() - startTime;
    console.error(`[ERRO] Falha após ${executionTime}ms:`, e);
    
    // FALLBACK: Se erro é de timeout, retornar menu de emergência
    if (e.message?.includes('Timeout') || executionTime > MAX_EXECUTION_TIME) {
      console.log(`[EMERGENCY] Gerando menu de emergência devido a timeout`);
      
      try {
        // Tentar buscar custos básicos para menu de emergência
        const { data: custosEmergencia } = await supabase
          .from("custos_filiais")
          .select("*")
          .eq("filial_id", parseNumber(body?.filialIdLegado) || 1)
          .limit(1);
          
        return createEmergencyFallbackMenu(
          parseNumber(body?.numDays) || 7,
          parseNumber(body?.refeicoesPorDia) || 50,
          custosEmergencia?.[0] || {}
        );
      } catch (emergencyError) {
        console.error("[EMERGENCY] Falha no menu de emergência:", emergencyError);
        return bad(500, "Sistema temporariamente indisponível - timeout");
      }
    }
    
    return bad(500, e?.message ?? "Erro interno do servidor");
  }
});
