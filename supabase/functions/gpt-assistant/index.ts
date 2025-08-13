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

const CATS = [
  "PRATO PRINCIPAL 1",
  "PRATO PRINCIPAL 2",
  "ARROZ BRANCO",
  "FEIJÃO",
  "SALADA 1 (VERDURAS)",
  "SALADA 2 (LEGUMES)",
  "SUCO 1",
  "SUCO 2",
];

const WEEK_LABELS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const RECIPE_BASE = 100; // receitas padrão são para 100 refeições

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
      .select("receita_id_legado, produto_base_id, quantidade, unidade, produto_base_descricao")
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

    // 4) Preços do mercado (com pacote & inteiro)
    const produtoIds = [
      ...new Set(
        (ingredientes ?? [])
          .map((i) => Number(i.produto_base_id))
          .filter((v) => Number.isFinite(v) && v > 0),
      ),
    ];
    console.log("[menu] produtoIds:", produtoIds.length);

    let mercado: any[] = [];
    if (produtoIds.length) {
      const r = await supabase
        .from("co_solicitacao_produto_listagem")
        .select(`
          produto_base_id,
          preco,
          unidade,
          apenas_valor_inteiro_sim_nao,
          produto_base_quantidade_embalagem
        `)
        .in("produto_base_id", produtoIds)
        .gt("preco", 0);
      if (r.error) {
        console.error("[co_solicitacao_produto_listagem]", r.error);
        return bad(500, "Erro ao consultar co_solicitacao_produto_listagem");
      }
      mercado = r.data ?? [];
    }

    type MarketRow = {
      produto_base_id: number;
      preco: number;
      unidade: string;
      apenas_valor_inteiro_sim_nao: boolean;
      produto_base_quantidade_embalagem: number | null;
    };

    const marketByProduto = new Map<number, MarketRow[]>();
    for (const row of (mercado ?? []) as MarketRow[]) {
      const id = Number(row.produto_base_id);
      if (!marketByProduto.has(id)) marketByProduto.set(id, []);
      marketByProduto.get(id)!.push(row);
    }

    function costOfRecipe(receitaId: string, servings: number): number | null {
      const ings = ingByReceita.get(String(receitaId)) ?? [];
      if (!ings.length) return null;

      const fator = servings / RECIPE_BASE;
      let total = 0;

      for (const ing of ings) {
        const prodId = Number(ing.produto_base_id);
        const ofertas = marketByProduto.get(prodId) ?? [];
        if (!ofertas.length) return null;

        const { qty: qtyBase, base: baseIng } = toBaseQty(
          Number(ing.quantidade ?? 0),
          String(ing.unidade ?? ""),
        );
        const necessidade = qtyBase * fator; // KG/LT/UN

        let melhor: number | null = null;
        for (const ofe of ofertas) {
          const baseMercado = normBase(ofe.unidade);
          if (baseMercado !== baseIng) continue;

          const packSize = packSizeToBase(ofe.produto_base_quantidade_embalagem, baseMercado);
          const preco = Number(ofe.preco || 0);
          if (!(preco > 0)) continue;

          let custo: number;
          if (ofe.apenas_valor_inteiro_sim_nao) {
            // compra por PACOTE inteiro
            const pacotes = Math.ceil(necessidade / Math.max(packSize, 1));
            custo = pacotes * preco; // preço do pacote
          } else {
            // fracionável: se veio packSize, considere preco do pacote → converte pra preço unitário
            const unitPrice = packSize > 1 ? preco / packSize : preco;
            custo = necessidade * unitPrice;
          }

          if (melhor == null || custo < melhor) melhor = custo;
        }

        if (melhor == null) return null; // nenhuma oferta compatível
        total += melhor;
      }

      return total;
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

    // FEIJÃO será placeholder por enquanto
    const feijao = null;

    const cardapio: any[] = [];
    let totalGeral = 0;

    const days = [];

    for (let d = 0; d < numDays; d++) {
      const weekdayIdx = d % 7;
      const tetoPorRef = refCostWeek[weekdayIdx];
      if (!tetoPorRef || tetoPorRef <= 0) {
        return bad(400, `Teto não configurado para ${WEEK_LABELS[weekdayIdx]}`);
      }

      const itens: any[] = [];
      const usados = new Set<string>([String(arroz.receita_id_legado)]);

      // ARROZ BRANCO (obrigatório)
      itens.push({
        slot: "ARROZ BRANCO",
        receita_id: String(arroz.receita_id_legado),
        nome: arroz.nome_receita,
        custo_total: round2(arroz._cost),
        custo_por_refeicao: round2(arroz._cost / refeicoesPorDia),
      });

      // FEIJÃO (placeholder)
      itens.push({
        slot: "FEIJÃO",
        placeholder: true,
      });

      // Demais categorias na ordem dos slots
      for (const cat of CATS) {
        if (cat === "ARROZ BRANCO" || cat === "FEIJÃO") continue;
        const pick = pickCheapest(cat, refeicoesPorDia, usados);
        if (pick) {
          usados.add(String(pick.receita_id_legado));
          itens.push({
            slot: cat,
            receita_id: String(pick.receita_id_legado),
            nome: pick.nome_receita,
            custo_total: round2(pick._cost),
            custo_por_refeicao: round2(pick._cost / refeicoesPorDia),
          });
        } else {
          // Sem candidato: placeholder
          itens.push({
            slot: cat,
            placeholder: true,
          });
        }
      }

      // Otimização de custo - trocar por alternativas mais baratas se exceder orçamento
      const ordemTroca = [
        "PRATO PRINCIPAL 2",
        "SALADA 2 (LEGUMES)", 
        "SALADA 1 (VERDURAS)",
        "SUCO 2",
        "SUCO 1",
        "PRATO PRINCIPAL 1",
      ];

      const somaTotalDia = () => itens.reduce((s, it) => s + (it.custo_total || 0), 0);
      
      let totalDia = somaTotalDia();
      let porRef = totalDia / refeicoesPorDia;

      for (const cat of ordemTroca) {
        if (porRef <= tetoPorRef) break;
        const idx = itens.findIndex((x: any) => x.slot === cat && x.receita_id);
        if (idx === -1) continue;

        const atualId = String(itens[idx].receita_id);
        const exclude = new Set<string>([...usados, atualId]);
        const melhor = pickCheapest(cat, refeicoesPorDia, exclude);

        if (melhor && melhor._cost < itens[idx].custo_total) {
          usados.add(String(melhor.receita_id_legado));
          itens[idx] = {
            slot: cat,
            receita_id: String(melhor.receita_id_legado),
            nome: melhor.nome_receita,
            custo_total: round2(melhor._cost),
            custo_por_refeicao: round2(melhor._cost / refeicoesPorDia),
          };
          totalDia = somaTotalDia();
          porRef = totalDia / refeicoesPorDia;
        }
      }

      days.push({
        dia: WEEK_LABELS[weekdayIdx],
        label_orcamento: WEEK_LABELS[weekdayIdx],
        budget_per_meal: round2(tetoPorRef),
        custo_total_dia: round2(totalDia),
        custo_por_refeicao: round2(porRef),
        dentro_orcamento: porRef <= tetoPorRef,
        itens,
      });

      totalGeral += totalDia;
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
