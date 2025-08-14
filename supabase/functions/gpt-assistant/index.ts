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
const RECIPE_BASE = 100; // receitas padrão são para 100 refeições

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

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const filialIdLegado = parseNumber(body?.filialIdLegado);
    const numDays = parseNumber(body?.numDays);
    const refeicoesPorDia = parseNumber(body?.refeicoesPorDia);
    const useDiaEspecial = body?.useDiaEspecial === true;
    const baseRecipes = body?.baseRecipes || {};

    console.log("[menu] payload", { action, filialIdLegado, numDays, refeicoesPorDia, useDiaEspecial });

    // Validate action
    if (!action || !["generate_menu", "generate-menu", "generateMenu"].includes(action)) {
      return bad(400, "action deve ser 'generate_menu', 'generate-menu' ou 'generateMenu'");
    }

    // Validate filialIdLegado
    if (filialIdLegado === null || filialIdLegado <= 0) {
      return bad(400, "filialIdLegado deve ser um número positivo");
    }

    // Validate numDays
    if (numDays === null || numDays < 5 || numDays > 15) {
      return bad(400, "numDays deve estar entre 5 e 15");
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
      console.error("[custos_filiais]", custosErr);
      return bad(500, "Erro ao consultar custos_filiais");
    }

    if (!custos?.length) {
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

    const candidatesByCat: Record<string, any[]> = {};
    for (const cat of CATS) {
      const f = CAT_MATCHERS[cat];
      candidatesByCat[cat] = (receitas ?? []).filter((r) => f?.(r));
    }

    // Use baseRecipes.arroz se fornecido, senão busca automaticamente
    let arrozReceita = null;
    if (baseRecipes.arroz) {
      arrozReceita = (receitas ?? []).find(r => r.receita_id_legado === baseRecipes.arroz);
    }
    if (!arrozReceita && !candidatesByCat["ARROZ BRANCO"]?.length) {
      return bad(400, "Nenhuma receita de ARROZ encontrada");
    }

    // FEIJÃO será placeholder por enquanto - não requer validação
    const warnings = [];
    if (!candidatesByCat["FEIJÃO"]?.length) {
      warnings.push("Sem receita de feijão — usado placeholder");
    }

    // 3) Ingredientes de todas as receitas candidatas
    const candidateIds = [
      ...new Set(CATS.flatMap((c) => candidatesByCat[c].map((r) => String(r.receita_id_legado)))),
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
    for (const ing of ingredientes ?? []) {
      const key = String(ing.receita_id_legado);
      (ingByReceita.get(key) ?? ingByReceita.set(key, []).get(key))!.push(ing);
    }

    // 4) Preços do mercado (com pacote & inteiro) - NORMALIZAÇÃO ROBUSTA
    const produtoIds = Array.from(
      new Set(
        (ingredientes ?? [])
          .map((i) => Number(i.produto_base_id))
          .filter((v) => Number.isFinite(v) && v > 0)
      )
    );
    
    console.log("[menu] produtoIds:", JSON.stringify(produtoIds));

    let mercado: any[] = [];
    if (produtoIds.length) {
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
        .in("produto_base_id", produtoIds)
        .gt("preco", 0);
        
      if (mercadoErr) {
        console.error("[menu] erro mercado .in()", mercadoErr);
        return bad(500, "Erro ao consultar co_solicitacao_produto_listagem", { produtoIds });
      }

      // Sanitiza números e evita NaN
      mercado = (mercadoRows ?? []).map((r) => ({
        produto_base_id: Number(r.produto_base_id) || 0,
        descricao: r.descricao || '',
        preco: Number(r.preco) || 0,
        unidade: (r.unidade || '').toUpperCase(),
        apenas_valor_inteiro_sim_nao: !!r.apenas_valor_inteiro_sim_nao,
        produto_base_quantidade_embalagem: Number(r.produto_base_quantidade_embalagem) || 1, // fallback 1
        em_promocao_sim_nao: !!r.em_promocao_sim_nao,
      }));
    }

    // Conversor de unidades robusto
    const toMercadoBase = (qtd: number, unidadeIngrediente: string, unidadeMercado: string) => {
      const uIng = (unidadeIngrediente || '').toUpperCase();
      const uMerc = (unidadeMercado || '').toUpperCase();
      let base = Number(qtd) || 0;
      
      if (uIng === 'G' && uMerc === 'KG') base = base / 1000;
      if (uIng === 'KG' && uMerc === 'G') base = base * 1000;
      if (uIng === 'ML' && uMerc === 'LT') base = base / 1000;
      if (uIng === 'LT' && uMerc === 'ML') base = base * 1000;
      
      // Verificar se unidades são compatíveis
      const validUnits = ['KG', 'G', 'LT', 'ML', 'UN'];
      if (!validUnits.includes(uMerc)) {
        return { ok: false, valor: 0 };
      }
      
      return { ok: true, valor: base };
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

    const marketByProduto = new Map<number, MarketRow[]>();
    for (const row of (mercado ?? []) as MarketRow[]) {
      const id = Number(row.produto_base_id);
      if (!marketByProduto.has(id)) marketByProduto.set(id, []);
      marketByProduto.get(id)!.push(row);
    }

    // Cálculo do custo por ingrediente com proteção contra erros
    const calcularCustoIngrediente = (ing: any) => {
      try {
        const ofertas = marketByProduto.get(Number(ing.produto_base_id)) ?? [];
        if (!ofertas.length) {
          warnings.push(`Sem preço no mercado para produto_base_id=${ing.produto_base_id} (${ing.produto_base_descricao || 'N/A'})`);
          return 0;
        }

        const { qty: qtyBase, base: baseIng } = toBaseQty(
          Number(ing.quantidade ?? 0),
          String(ing.unidade ?? "")
        );
        const necessidade = qtyBase; // Já escalado no ingrediente

        let melhor = Infinity;
        for (const ofe of ofertas) {
          const conv = toMercadoBase(necessidade, baseIng, ofe.unidade);
          if (!conv.ok) continue;

          const emb = ofe.produto_base_quantidade_embalagem > 0 ? ofe.produto_base_quantidade_embalagem : 1;
          const quantidadeCompra = ofe.apenas_valor_inteiro_sim_nao
            ? Math.ceil(conv.valor / emb) * emb
            : conv.valor;

          const custo = quantidadeCompra * ofe.preco;
          if (custo < melhor) melhor = custo;
        }

        return Number.isFinite(melhor) ? melhor : 0;
      } catch (e) {
        console.error('[menu] erro calcularCustoIngrediente', ing, e);
        warnings.push(`Falha no cálculo de custo para ${ing.produto_base_descricao || ing.produto_base_id}`);
        return 0;
      }
    };

    function costOfRecipe(receitaId: string, servings: number): number | null {
      try {
        const ings = ingByReceita.get(String(receitaId)) ?? [];
        if (!ings.length) return null;

        const fator = servings / RECIPE_BASE;
        let total = 0;

    // Escalar ingredientes
        const ingredientesEscalados = ings.map((ing) => ({
          produto_base_id: ing.produto_base_id,
          nome: ing.produto_base_descricao || '',
          quantidade: Number(ing.quantidade ?? 0) * fator,
          unidade: ing.unidade
        }));

        // Calcular custo de cada ingrediente com proteção
        for (const ing of ingredientesEscalados) {
          total += calcularCustoIngrediente(ing);
        }

        return total;
      } catch (e) {
        console.error('[menu] erro costOfRecipe', receitaId, e);
        return null;
      }
    }

    const usedBySlot: UsedTracker = {};

    function markUsed(slot: string, id: string) {
      if (!usedBySlot[slot]) usedBySlot[slot] = new Set();
      usedBySlot[slot].add(id);
    }
    function isUsed(slot: string, id: string) {
      return !!usedBySlot[slot]?.has(id);
    }
    function pickUnique(pool: any[], slot: string) {
      let r = pool?.find(x => !isUsed(slot, String(x.receita_id_legado)));
      if (!r && pool?.length) {           // se esgotou, zera para recomeçar o ciclo
        usedBySlot[slot] = new Set();
        r = pool[0];
      }
      return r ?? null;
    }

    function pickCheapest(cat: string, servings: number, excludeIds = new Set<string>()) {
      const list = candidatesByCat[cat] ?? [];
      let best: { r: any; cost: number } | null = null;
      for (const r of list) {
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
        const cost = costOfRecipe(String(r.receita_id_legado), refeicoesPorDia);
        if (cost !== null) {
          pool.push({
            id: String(r.receita_id_legado),
            receita_id_legado: r.receita_id_legado,
            nome: r.nome_receita,
            _cost: cost,
            custo_por_refeicao: cost / refeicoesPorDia
          });
        }
      }
      pool.sort((a, b) => a._cost - b._cost); // mais baratos primeiro
    }

    // Saladas
    for (const cat of ["SALADA 1 (VERDURAS)", "SALADA 2 (LEGUMES)"]) {
      const candidates = candidatesByCat[cat] ?? [];
      for (const r of candidates) {
        const cost = costOfRecipe(String(r.receita_id_legado), refeicoesPorDia);
        if (cost !== null) {
          poolSaladas.push({
            id: String(r.receita_id_legado),
            receita_id_legado: r.receita_id_legado,
            nome: r.nome_receita,
            _cost: cost,
            custo_por_refeicao: cost / refeicoesPorDia
          });
        }
      }
    }
    poolSaladas.sort((a, b) => a._cost - b._cost);

    // Sucos
    for (const cat of ["SUCO 1", "SUCO 2"]) {
      const candidates = candidatesByCat[cat] ?? [];
      for (const r of candidates) {
        const cost = costOfRecipe(String(r.receita_id_legado), refeicoesPorDia);
        if (cost !== null) {
          poolSucos.push({
            id: String(r.receita_id_legado),
            receita_id_legado: r.receita_id_legado,
            nome: r.nome_receita,
            _cost: cost,
            custo_por_refeicao: cost / refeicoesPorDia
          });
        }
      }
    }
    poolSucos.sort((a, b) => a._cost - b._cost);

    // ARROZ obrigatório (usar baseRecipes.arroz se fornecido)
    let arroz;
    if (arrozReceita) {
      const cost = costOfRecipe(arrozReceita.receita_id_legado, refeicoesPorDia);
      if (cost !== null) {
        arroz = { ...arrozReceita, _cost: cost };
      }
    }
    if (!arroz) {
      arroz = pickCheapest("ARROZ BRANCO", refeicoesPorDia);
    }
    
    if (!arroz) {
      return bad(400, "Não foi possível precificar ARROZ");
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

      // ARROZ fixo
      const arrozId = getArrozBaseId(baseRecipes);
      if (arrozId && arroz) {
        itens.push({
          slot: 'ARROZ BRANCO',
          receita_id: String(arrozId),
          nome: 'ARROZ BRANCO',
          custo_total: round2(arroz._cost),
          custo_por_refeicao: round2(arroz._cost / refeicoesPorDia),
        });
        markUsed('ARROZ BRANCO', String(arrozId));
      } else {
        itens.push({ 
          slot: 'ARROZ BRANCO', 
          placeholder: true, 
          nome: 'ARROZ (BASE NÃO CONFIGURADA)', 
          custo_total: 0, 
          custo_por_refeicao: 0 
        });
      }

      // FEIJÃO (placeholder por enquanto)
      const feijaoId = getFeijaoBaseId(baseRecipes);
      if (feijaoId) {
        itens.push({ 
          slot: 'FEIJÃO', 
          receita_id: String(feijaoId), 
          nome: 'FEIJÃO',
          custo_total: 0,
          custo_por_refeicao: 0
        });
        markUsed('FEIJÃO', String(feijaoId));
      } else {
        itens.push({ 
          slot: 'FEIJÃO', 
          placeholder: true, 
          nome: 'FEIJÃO (AGUARDANDO RECEITA)', 
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
          custo_por_refeicao: round2(pp1.custo_por_refeicao)
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
          custo_por_refeicao: round2(pp2.custo_por_refeicao)
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
          custo_por_refeicao: round2(s1.custo_por_refeicao)
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
          custo_por_refeicao: round2(s2.custo_por_refeicao)
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

    // Gerar shopping list básico
    const shoppingList: any[] = [];
    const produtosUsados = new Map<number, { nome: string; quantidade: number; unidade: string; custo: number }>();

    for (const day of days) {
      for (const item of day.itens) {
        if (item.placeholder || !item.receita_id) continue;
        
        const ings = ingByReceita.get(item.receita_id) ?? [];
        const fator = refeicoesPorDia / RECIPE_BASE;
        
        for (const ing of ings) {
          const prodId = Number(ing.produto_base_id);
          if (!prodId) continue;
          
          const { qty: qtyBase } = toBaseQty(Number(ing.quantidade ?? 0), String(ing.unidade ?? ""));
          const necessidade = qtyBase * fator;
          
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
