import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CpReceita {
  receita_id: number;
  nome: string;
  modo_preparo?: string;
  ingredientes: any[];
  tempo_preparo?: number;
  porcoes?: number;
  custo_total?: number;
  categoria_id?: number;
  categoria_descricao?: string;
  quantidade_refeicoes?: number;
  inativa: boolean;
  usuario?: string;
  criado_em: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Iniciando sincronização da view cpReceitas...');

    // Log do início da operação
    const { error: logError } = await supabaseClient
      .from('sync_logs')
      .insert({
        operacao: 'sync_cp_receitas',
        tabela_destino: 'receitas_legado',
        status: 'iniciado',
        detalhes: { fonte: 'cpReceitas view' }
      });

    if (logError) {
      console.error('Erro ao criar log:', logError);
    }

    const startTime = Date.now();

    // Simular dados da view cpReceitas do sistema legado
    const receitasData = await simulateCpReceitasData();
    
    console.log(`Encontradas ${receitasData.length} receitas na view cpReceitas`);

    // Sincronizar receitas
    const result = await syncReceitas(supabaseClient, receitasData);

    const executionTime = Date.now() - startTime;

    // Log de sucesso
    await supabaseClient
      .from('sync_logs')
      .insert({
        operacao: 'sync_cp_receitas',
        tabela_destino: 'receitas_legado',
        status: 'concluido',
        registros_processados: result.processed,
        tempo_execucao_ms: executionTime,
        detalhes: {
          fonte: 'cpReceitas view',
          sucessos: result.success,
          erros: result.errors,
          pulos: result.skipped
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${result.processed} receitas processadas`,
        details: result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na sincronização:', error);

    // Log de erro
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient
      .from('sync_logs')
      .insert({
        operacao: 'sync_cp_receitas',
        tabela_destino: 'receitas_legado',
        status: 'erro',
        erro_msg: error.message,
        detalhes: { fonte: 'cpReceitas view' }
      });

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function simulateCpReceitasData(): Promise<CpReceita[]> {
  // Simular dados da view cpReceitas baseados na estrutura mostrada
  return [
    {
      receita_id: 1001,
      nome: "Arroz com Feijão Completo",
      modo_preparo: "Refogue a cebola, adicione o arroz e água. Cozinhe o feijão separadamente.",
      ingredientes: [
        { produto_id: "P001", nome: "Arroz", quantidade: 2, unidade: "kg" },
        { produto_id: "P002", nome: "Feijão", quantidade: 1, unidade: "kg" },
        { produto_id: "P003", nome: "Cebola", quantidade: 0.5, unidade: "kg" }
      ],
      tempo_preparo: 45,
      porcoes: 10,
      custo_total: 25.50,
      categoria_id: 1,
      categoria_descricao: "Pratos Principais",
      quantidade_refeicoes: 10,
      inativa: false,
      usuario: "chef_principal",
      criado_em: "2024-01-15T10:30:00Z"
    },
    {
      receita_id: 1002,
      nome: "Frango Grelhado com Legumes",
      modo_preparo: "Tempere o frango e grelhe. Refogue os legumes com temperos.",
      ingredientes: [
        { produto_id: "P004", nome: "Peito de Frango", quantidade: 2.5, unidade: "kg" },
        { produto_id: "P005", nome: "Cenoura", quantidade: 1, unidade: "kg" },
        { produto_id: "P006", nome: "Abobrinha", quantidade: 1, unidade: "kg" }
      ],
      tempo_preparo: 35,
      porcoes: 8,
      custo_total: 45.80,
      categoria_id: 1,
      categoria_descricao: "Pratos Principais",
      quantidade_refeicoes: 8,
      inativa: false,
      usuario: "chef_carnes",
      criado_em: "2024-01-16T14:20:00Z"
    },
    {
      receita_id: 1003,
      nome: "Salada Verde Especial",
      modo_preparo: "Lave bem as folhas, corte os ingredientes e tempere com azeite e vinagre.",
      ingredientes: [
        { produto_id: "P007", nome: "Alface", quantidade: 0.5, unidade: "kg" },
        { produto_id: "P008", nome: "Tomate", quantidade: 1, unidade: "kg" },
        { produto_id: "P009", nome: "Pepino", quantidade: 0.5, unidade: "kg" }
      ],
      tempo_preparo: 15,
      porcoes: 12,
      custo_total: 18.30,
      categoria_id: 2,
      categoria_descricao: "Saladas",
      quantidade_refeicoes: 12,
      inativa: false,
      usuario: "chef_saladas",
      criado_em: "2024-01-17T09:15:00Z"
    },
    {
      receita_id: 1004,
      nome: "Sopa de Legumes Antiga",
      modo_preparo: "Receita descontinuada - não usar mais.",
      ingredientes: [],
      tempo_preparo: 0,
      porcoes: 0,
      custo_total: 0,
      categoria_id: 3,
      categoria_descricao: "Sopas",
      quantidade_refeicoes: 0,
      inativa: true,
      usuario: "chef_antigo",
      criado_em: "2023-12-01T08:00:00Z"
    }
  ];
}

async function syncReceitas(supabaseClient: any, receitas: CpReceita[]) {
  let processed = 0;
  let success = 0;
  let errors = 0;
  let skipped = 0;

  for (const receita of receitas) {
    try {
      processed++;

      // Verificar se a receita já existe
      const { data: existing } = await supabaseClient
        .from('receitas_legado')
        .select('id')
        .eq('receita_id_legado', receita.receita_id.toString())
        .single();

      const receitaData = {
        receita_id_legado: receita.receita_id.toString(),
        nome_receita: receita.nome,
        modo_preparo: receita.modo_preparo || '',
        ingredientes: receita.ingredientes || [],
        tempo_preparo: receita.tempo_preparo || 0,
        porcoes: receita.porcoes || 1,
        custo_total: receita.custo_total || 0,
        categoria_id: receita.categoria_id,
        categoria_receita: receita.categoria_descricao,
        categoria_descricao: receita.categoria_descricao,
        quantidade_refeicoes: receita.quantidade_refeicoes || 1,
        inativa: receita.inativa,
        usuario: receita.usuario,
        sync_at: new Date().toISOString()
      };

      if (existing) {
        // Atualizar receita existente
        const { error } = await supabaseClient
          .from('receitas_legado')
          .update(receitaData)
          .eq('id', existing.id);

        if (error) {
          console.error(`Erro ao atualizar receita ${receita.receita_id}:`, error);
          errors++;
        } else {
          success++;
          console.log(`Receita ${receita.receita_id} atualizada com sucesso`);
        }
      } else {
        // Inserir nova receita
        const { error } = await supabaseClient
          .from('receitas_legado')
          .insert(receitaData);

        if (error) {
          console.error(`Erro ao inserir receita ${receita.receita_id}:`, error);
          errors++;
        } else {
          success++;
          console.log(`Receita ${receita.receita_id} inserida com sucesso`);
        }
      }

    } catch (error) {
      console.error(`Erro ao processar receita ${receita.receita_id}:`, error);
      errors++;
    }
  }

  return { processed, success, errors, skipped };
}