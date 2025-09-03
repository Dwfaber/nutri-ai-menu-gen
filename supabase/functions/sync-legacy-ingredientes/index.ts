import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CpReceitaIngrediente {
  ReceitaId: string;
  ProdutoBaseId: number;
  Quantidade: number;
  Unidade: string;
  Nome: string;
  ProdutoBaseDescricao: string;
  CategoriaDescricao: string;
  ReceitaProdutoId: number;
  ProdutoId: number;
  UnidadeMedidaId: number;
  ReceitaProdutoClassificacaoId: number;
  QuantidadeRefeicoes: number;
  Notas: string;
  UserName: string;
  UserDateTime: string;
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

    console.log('Iniciando sincronização de ingredientes de receitas...');

    // Parse dos dados recebidos
    const ingredientesData: CpReceitaIngrediente[] = await req.json();
    console.log(`Recebidos ${ingredientesData.length} ingredientes para sincronização`);

    if (!ingredientesData || ingredientesData.length === 0) {
      console.log('Nenhum ingrediente recebido para sincronização');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum ingrediente recebido',
          processedRecords: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar apenas ingredientes válidos (com receita_id e produto_base_id)
    const ingredientesValidos = ingredientesData.filter(item => 
      item.ReceitaId && item.ProdutoBaseId
    );

    console.log(`Ingredientes válidos após filtro: ${ingredientesValidos.length}`);

    // Mapear para o formato esperado pelo Supabase
    const ingredientesFormatados = ingredientesValidos.map(item => ({
      receita_id_legado: String(item.ReceitaId),
      produto_base_id: Number(item.ProdutoBaseId),
      quantidade: Number(item.Quantidade) || 0,
      unidade: item.Unidade || '',
      nome: item.Nome || item.ProdutoBaseDescricao || '',
      produto_base_descricao: item.ProdutoBaseDescricao || item.Nome || '',
      categoria_descricao: item.CategoriaDescricao || '',
      receita_produto_id: Number(item.ReceitaProdutoId) || 0,
      produto_id: Number(item.ProdutoId) || 1,
      unidade_medida_id: Number(item.UnidadeMedidaId) || 1,
      receita_produto_classificacao_id: Number(item.ReceitaProdutoClassificacaoId) || 1,
      quantidade_refeicoes: Number(item.QuantidadeRefeicoes) || 1,
      notas: item.Notas || '',
      user_name: item.UserName || '',
      user_date_time: item.UserDateTime || new Date().toISOString(),
      sync_at: new Date().toISOString(),
      created_at: item.UserDateTime || new Date().toISOString()
    }));

    console.log(`Ingredientes formatados: ${ingredientesFormatados.length}`);

    // Chamar o hybrid-sync-manager para processar os dados
    const hybridSyncResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/hybrid-sync-manager`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync_table',
          targetTable: 'receita_ingredientes',
          data: ingredientesFormatados
        })
      }
    );

    const syncResult = await hybridSyncResponse.json();

    if (!hybridSyncResponse.ok) {
      console.error('Erro no hybrid-sync-manager:', syncResult);
      throw new Error(`Hybrid sync failed: ${syncResult.error || 'Unknown error'}`);
    }

    console.log('Sincronização de ingredientes concluída com sucesso:', syncResult);

    // Log do resultado
    await supabaseClient
      .from('sync_logs')
      .insert({
        tabela_destino: 'receita_ingredientes',
        operacao: 'sync_legacy_ingredientes',
        status: 'concluido',
        registros_processados: syncResult.processedRecords || 0,
        detalhes: {
          total_received: ingredientesData.length,
          valid_ingredients: ingredientesValidos.length,
          formatted_ingredients: ingredientesFormatados.length,
          sync_result: syncResult
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Ingredientes sincronizados com sucesso',
        totalReceived: ingredientesData.length,
        validIngredients: ingredientesValidos.length,
        processedRecords: syncResult.processedRecords || 0,
        syncDetails: syncResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na sincronização de ingredientes:', error);

    // Log do erro
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseClient
        .from('sync_logs')
        .insert({
          tabela_destino: 'receita_ingredientes',
          operacao: 'sync_legacy_ingredientes',
          status: 'erro',
          erro_msg: error.message,
          detalhes: {
            error_stack: error.stack || error.toString(),
            timestamp: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    return new Response(
      JSON.stringify({
        error: 'Falha na sincronização de ingredientes',
        message: error.message,
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});