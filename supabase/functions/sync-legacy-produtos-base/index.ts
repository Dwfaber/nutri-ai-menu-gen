import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: requestData } = await req.json();
    console.log('🔄 Iniciando sincronização de produtos base...');

    if (!requestData || !Array.isArray(requestData)) {
      throw new Error('Dados de produtos base não fornecidos ou inválidos');
    }

    console.log(`📦 Processando ${requestData.length} produtos base...`);

    // Usar hybrid-sync-manager para sincronização
    const { data: syncResult, error: syncError } = await supabaseClient.functions.invoke('hybrid-sync-manager', {
      body: {
        action: 'sync_table',
        targetTable: 'produtos_base',
        data: requestData,
        syncConfig: {
          strategy: 'upsert_cleanup',
          backup: true,
          batchSize: 1000,
          cleanupOrphans: true,
          orphanDays: 30
        }
      }
    });

    if (syncError) {
      console.error('❌ Erro na sincronização:', syncError);
      throw syncError;
    }

    console.log('✅ Sincronização de produtos base concluída:', syncResult);

    // Log no sistema
    await supabaseClient.from('sync_logs').insert({
      tabela_destino: 'produtos_base',
      operacao: 'sync_legacy_produtos',
      status: 'concluido',
      registros_processados: syncResult.processedRecords,
      detalhes: {
        ...syncResult,
        fonte: 'sync-legacy-produtos-base',
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Produtos base sincronizados com sucesso',
        processedRecords: syncResult.processedRecords,
        insertedRecords: syncResult.insertedRecords,
        updatedRecords: syncResult.updatedRecords,
        cleanupRecords: syncResult.cleanupRecords,
        executionTime: syncResult.executionTime
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro geral na sincronização de produtos base:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno na sincronização'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});