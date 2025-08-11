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

const WEEK_LABELS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"];
const RECIPE_BASE = 100; // receitas padrão são para 100 refeições

// ---------------- helpers ----------------
const json = (payload: any, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    const clientIdInput = body?.clientId ?? body?.client_id ?? body?.client_data?.id;
    const numDays = Number(body?.numDays ?? body?.days ?? 5);
    const refeicoesPorDia = Number(body?.refeicoesPorDia ?? body?.mealsPerDay ?? 100);

    console.log("[menu] payload", { action, clientId: clientIdInput, numDays, refeicoesPorDia });

    if (!action || (action !== "generate_menu" && action !== "generateMenu")) {
      return json({ success: false, error: "Invalid action" }, 400);
    }

    const clientIdNum = safeInt(clientIdInput);
    if (clientIdNum === null) {
      console.error("[menu] clientId inválido:", clientIdInput);
      return json({ success: false, error: "clientId inválido (esperado inteiro)" }, 400);
    }

    if (!(numDays > 0) || !(refeicoesPorDia > 0)) {
      return json(
        { success: false, error: "numDays e refeicoesPorDia devem ser maiores que zero" },
        400,
      );
    }

    // 1) Teto por refeição (último registro do cliente)
    const { data: custos, error: custosErr } = await supabase
      .from("custos_filiais")
      .select("*")
      .eq("cliente_id_legado", clientIdNum)
      .order("created_at", { ascending: false })
      .limit(1);

    if (custosErr) {
      console.error("[custos_filiais]", custosErr);
      return json({ success: false, error: "Erro ao consultar custos_filiais" }, 500);
    }

    const c0: any = custos?.[0] ?? {};
    const refCostWeek = [
      Number(c0.RefCustoSegunda ?? c0.ref_custo_segunda ?? 0),
      Number(c0.RefCustoTerca ?? c0.ref_custo_terca ?? 0),
      Number(c0.RefCustoQuarta ?? c0.ref_custo_quarta ?? 0),
      Number(c0.RefCustoQuinta ?? c0.ref_custo_quinta ?? 0),
      Number(c0.RefCustoSexta ?? c0.ref_custo_sexta ?? 0),
    ];

    if (!refCostWeek.some((v) => v > 0)) {
      return json({ success: false, error: "RefCusto* não configurado para o cliente." }, 400);
    }

    // 2) Receitas ativas (candidatas)
    const { data: receitas, error: rErr } = await supabase
      .from("receitas_legado")
      .select("receita_id_legado, nome_receita, categoria_descricao, inativa")
      .eq("inativa", false);

    if (rErr) {
      console.error("[receitas_legado]", rErr);
      return json({ success: false, error: "Erro ao consultar receitas_legado" }, 500);
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

    if (!candidatesByCat["ARROZ BRANCO"]?.length) {
      return json({ success: false, error: "Nenhuma receita de ARROZ encontrada." }, 400);
    }
    if (!candidatesByCat["FEIJÃO"]?.length) {
      return json({ success: false, error: "Nenhuma receita de FEIJÃO encontrada." }, 400);
    }

    // 3) Ingredientes de todas as receitas candidatas
    const candidateIds = [
      ...new Set(CATS.flatMap((c) => candidatesByCat[c].map((r) => String(r.receita_id_legado)))),
    ];
    if (candidateIds.length === 0) {
      return json({ success: false, error: "Nenhuma receita candidata encontrada." }, 400);
    }

    const { data: ingredientes, error: iErr } = await supabase
      .from("receita_ingredientes")
      .select("receita_id_legado, produto_base_id, quantidade, unidade, produto_base_descricao")
      .in("receita_id_legado", candidateIds);

    if (iErr) {
      console.error("[receita_ingredientes]", iErr);
      return json({ success: false, error: "Erro ao consultar receita_ingredientes" }, 500);
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
        return json(
          { success: false, error: "Erro ao consultar co_solicitacao_produto_listagem" },
          500,
        );
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

    // ARROZ e FEIJÃO mais baratos
    const arroz = pickCheapest("ARROZ BRANCO", refeicoesPorDia);
    const feijao = pickCheapest("FEIJÃO", refeicoesPorDia);
    if (!arroz || !feijao) {
      return json({ success: false, error: "Não foi possível precificar ARROZ/FEIJÃO." }, 400);
    }

    const cardapio: any[] = [];
    let totalGeral = 0;

    for (let d = 0; d < numDays; d++) {
      const weekdayIdx = d % 5;
      const tetoPorRef = Number(refCostWeek[weekdayIdx] || 0);
      if (!(tetoPorRef > 0)) {
        return json({ success: false, error: `Teto não configurado (dia idx ${weekdayIdx}).` }, 400);
      }

      const itensDia: any[] = [];
      const usados = new Set<string>([
        String(arroz.receita_id_legado),
        String(feijao.receita_id_legado),
      ]);

      // fixos
      itensDia.push({
        categoria: "ARROZ BRANCO",
        receita_id_legado: String(arroz.receita_id_legado),
        nome: arroz.nome_receita,
        custo_total_dia: arroz._cost,
        custo_por_refeicao: round2(arroz._cost / refeicoesPorDia),
      });
      itensDia.push({
        categoria: "FEIJÃO",
        receita_id_legado: String(feijao.receita_id_legado),
        nome: feijao.nome_receita,
        custo_total_dia: feijao._cost,
        custo_por_refeicao: round2(feijao._cost / refeicoesPorDia),
      });

      // demais categorias (pega as mais baratas disponíveis)
      for (const cat of CATS) {
        if (cat === "ARROZ BRANCO" || cat === "FEIJÃO") continue;
        const pick = pickCheapest(cat, refeicoesPorDia, usados);
        if (pick) {
          usados.add(String(pick.receita_id_legado));
          itensDia.push({
            categoria: cat,
            receita_id_legado: String(pick.receita_id_legado),
            nome: pick.nome_receita,
            custo_total_dia: pick._cost,
            custo_por_refeicao: round2(pick._cost / refeicoesPorDia),
          });
        } else {
          // sem candidato: mantém slot vazio
          itensDia.push({
            categoria: cat,
            receita_id_legado: null,
            nome: "-",
            custo_total_dia: 0,
            custo_por_refeicao: 0,
          });
        }
      }

      // valida teto — tenta baratear trocando estas categorias na ordem:
      const ordemTroca = [
        "PRATO PRINCIPAL 2",
        "SALADA 2 (LEGUMES)",
        "SALADA 1 (VERDURAS)",
        "SUCO 2",
        "SUCO 1",
        "PRATO PRINCIPAL 1",
      ];

      const somaTotalDia = () => itensDia.reduce((s, it) => s + Number(it.custo_total_dia || 0), 0);

      let totalDia = somaTotalDia();
      let porRef = totalDia / refeicoesPorDia;

      for (const cat of ordemTroca) {
        if (porRef <= tetoPorRef) break;
        const idx = itensDia.findIndex((x: any) => x.categoria === cat && x.receita_id_legado);
        if (idx === -1) continue;

        const atualId = String(itensDia[idx].receita_id_legado);
        const exclude = new Set<string>([...usados, atualId]);
        const melhor = pickCheapest(cat, refeicoesPorDia, exclude);

        if (melhor && melhor._cost < itensDia[idx].custo_total_dia) {
          usados.add(String(melhor.receita_id_legado));
          itensDia[idx] = {
            categoria: cat,
            receita_id_legado: String(melhor.receita_id_legado),
            nome: melhor.nome_receita,
            custo_total_dia: melhor._cost,
            custo_por_refeicao: round2(melhor._cost / refeicoesPorDia),
          };
          totalDia = somaTotalDia();
          porRef = totalDia / refeicoesPorDia;
        }
      }

      // ordena pelas linhas do grid
      itensDia.sort((a, b) => CATS.indexOf(a.categoria) - CATS.indexOf(b.categoria));

      cardapio.push({
        dia_index: d,
        dia_label: WEEK_LABELS[weekdayIdx],
        itens: itensDia,
        teto_por_refeicao: round2(tetoPorRef),
        custo_total_dia: round2(totalDia),
        custo_por_refeicao: round2(porRef),
        dentro_do_teto: porRef <= tetoPorRef,
      });

      totalGeral += totalDia;
    }

    const totalPorcoes = refeicoesPorDia * numDays;
    const custoMedioPorPorcao = totalGeral / Math.max(totalPorcoes, 1);

    return json({
      success: true,
      menu: {
        cardapio,
        summary: {
          total_custo: round2(totalGeral),
          custo_medio_por_refeicao: round2(custoMedioPorPorcao),
          porcoes_totais: totalPorcoes,
          dias: numDays,
          refeicoes_por_dia: refeicoesPorDia,
          total_de_itens: numDays * CATS.length,
        },
      },
    });
  } catch (e: any) {
    console.error("[menu] unhandled", e);
    return json({ success: false, error: e?.message ?? "Erro desconhecido" }, 500);
  }
});
