
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
        detalhes: { fonte: 'cpReceitas view - dados reais do n8n' }
      });

    if (logError) {
      console.error('Erro ao criar log:', logError);
    }

    const startTime = Date.now();

    // Ler dados reais enviados pelo n8n
    const requestBody = await req.json();
    
    // Validar se os dados foram enviados corretamente
    if (!requestBody || !Array.isArray(requestBody)) {
      throw new Error('Dados inválidos: esperado array de receitas do n8n');
    }

    const receitasData = requestBody as CpReceita[];
    
    console.log(`Recebido lote com ${receitasData.length} receitas do n8n`);
    console.log(`IDs das receitas recebidas: ${receitasData.slice(0, 10).map(r => r.receita_id).join(', ')}${receitasData.length > 10 ? '...' : ''}`);

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
          fonte: 'cpReceitas view - dados reais do n8n',
          lote_tamanho: receitasData.length,
          sucessos: result.success,
          erros: result.errors,
          pulos: result.skipped
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${result.processed} receitas processadas de ${receitasData.length} recebidas`,
        details: {
          ...result,
          lote_tamanho: receitasData.length
        }
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
        detalhes: { fonte: 'cpReceitas view - dados reais do n8n' }
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

async function syncReceitas(supabaseClient: any, receitas: CpReceita[]) {
  let processed = 0;
  let success = 0;
  let errors = 0;
  let skipped = 0;

  for (const receita of receitas) {
    try {
      processed++;

      // Log para rastrear progresso em lotes grandes
      if (processed % 50 === 0) {
        console.log(`Processando receita ${processed}/${receitas.length}: ID ${receita.receita_id}`);
      }

      // Preparar dados da receita
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

      // Usar UPSERT para inserir ou atualizar automaticamente
      const { error } = await supabaseClient
        .from('receitas_legado')
        .upsert(receitaData, {
          onConflict: 'receita_id_legado',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`Erro ao fazer upsert da receita ${receita.receita_id}:`, error);
        errors++;
      } else {
        success++;
        if (processed <= 10 || processed % 100 === 0) {
          console.log(`Receita ${receita.receita_id} sincronizada com sucesso (upsert)`);
        }
      }

    } catch (error) {
      console.error(`Erro ao processar receita ${receita.receita_id}:`, error);
      errors++;
    }
  }

  console.log(`Sincronização finalizada: ${success} sucessos, ${errors} erros de ${processed} processadas`);
  return { processed, success, errors, skipped };
}
