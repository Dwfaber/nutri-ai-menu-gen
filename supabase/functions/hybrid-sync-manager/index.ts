import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuração da estratégia híbrida por tabela
const SYNC_STRATEGIES = {
  'co_solicitacao_produto_listagem': {
    strategy: 'upsert_cleanup', // Mudança: agora usa UPSERT com limpeza
    backup: true,
    batchSize: 1000,
    cleanupOrphans: true,
    orphanDays: 30,
    uniqueColumns: ['solicitacao_id', 'produto_base_id'] // Chave natural para UPSERT
  },
  'produtos_base': {
    strategy: 'truncate_insert', // Tabela simples, dados voláteis  
    backup: true,
    batchSize: 500,
    cleanupOrphans: false
  },
  'custos_filiais': {
    strategy: 'upsert_cleanup', // Tabela média, relacionamentos importantes
    backup: true,
    batchSize: 200,
    cleanupOrphans: true,
    orphanDays: 7
  },
  'receitas_legado': {
    strategy: 'upsert_cleanup', // Mudança: agora usa UPSERT com limpeza
    backup: false,
    batchSize: 100,
    cleanupOrphans: true,
    orphanDays: 30,
    uniqueColumns: ['receita_id_legado'] // Chave natural para UPSERT
  },
  'receita_ingredientes': {
    strategy: 'upsert', // Dados relacionais críticos
    backup: false,
    batchSize: 500,
    cleanupOrphans: false
  },
  'contratos_corporativos': {
    strategy: 'upsert', // Dados contratuais críticos
    backup: true,
    batchSize: 50,
    cleanupOrphans: false
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, targetTable, data, syncConfig } = await req.json();
    
    console.log(`Hybrid Sync Manager - Action: ${action}, Table: ${targetTable}`);

    switch (action) {
      case 'sync_table':
        return await syncTable(supabaseClient, targetTable, data, syncConfig);
      case 'create_backup':
        return await createBackup(supabaseClient, targetTable);
      case 'restore_backup':
        return await restoreBackup(supabaseClient, targetTable, syncConfig?.backupId);
      case 'cleanup_orphans':
        return await cleanupOrphans(supabaseClient, targetTable);
      case 'get_strategy':
        return getTableStrategy(targetTable);
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in hybrid-sync-manager:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function getTableStrategy(tableName: string) {
  const strategy = SYNC_STRATEGIES[tableName as keyof typeof SYNC_STRATEGIES];
  
  return new Response(
    JSON.stringify({
      success: true,
      tableName,
      strategy: strategy || { strategy: 'upsert', backup: false, batchSize: 100 }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function syncTable(supabaseClient: any, tableName: string, data: any[], syncConfig?: any) {
  const startTime = Date.now();
  const strategy = SYNC_STRATEGIES[tableName as keyof typeof SYNC_STRATEGIES] || { 
    strategy: 'upsert', 
    backup: false, 
    batchSize: 100 
  };

  console.log(`Syncing table ${tableName} with strategy: ${strategy.strategy}`);

  // Log início da sincronização
  const { data: logData } = await supabaseClient
    .from('sync_logs')
    .insert({
      tabela_destino: tableName,
      operacao: `hybrid_sync_${strategy.strategy}`,
      status: 'iniciado',
      detalhes: { 
        strategy: strategy.strategy,
        recordCount: data.length,
        backup: strategy.backup
      }
    })
    .select()
    .maybeSingle();

  const logId = logData?.id;
  let backupId = null;

  try {
    // 1. Criar backup se necessário
    if (strategy.backup) {
      console.log(`Creating backup for ${tableName}...`);
      const backupResult = await createBackup(supabaseClient, tableName);
      const backupResponse = await backupResult.json();
      if (backupResponse.success) {
        backupId = backupResponse.backupId;
        console.log(`Backup created with ID: ${backupId}`);
      }
    }

    let processedRecords = 0;

    // 2. Executar estratégia específica
    switch (strategy.strategy) {
      case 'truncate_insert':
        processedRecords = await truncateAndInsert(supabaseClient, tableName, data, strategy.batchSize);
        break;
      case 'upsert_cleanup':
        processedRecords = await upsertWithCleanup(supabaseClient, tableName, data, strategy);
        break;
      case 'upsert':
      default:
        processedRecords = await upsertData(supabaseClient, tableName, data, strategy.batchSize);
        break;
    }

    // 3. Cleanup de órfãos se configurado
    if (strategy.cleanupOrphans) {
      console.log(`Cleaning up orphans for ${tableName}...`);
      await cleanupOrphans(supabaseClient, tableName, strategy.orphanDays);
    }

    const executionTime = Date.now() - startTime;

    // 4. Log sucesso
    if (logId) {
      await supabaseClient
        .from('sync_logs')
        .update({
          status: 'concluido',
          registros_processados: processedRecords,
          tempo_execucao_ms: executionTime,
          detalhes: { 
            strategy: strategy.strategy,
            recordCount: data.length,
            processedRecords,
            backupId,
            executionTime
          }
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tableName,
        strategy: strategy.strategy,
        processedRecords,
        totalRecords: data.length,
        executionTime: `${executionTime}ms`,
        backupId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`Sync error for ${tableName}:`, error);
    
    // Rollback automático se houver backup
    if (backupId && strategy.backup) {
      console.log(`Attempting rollback for ${tableName} using backup ${backupId}...`);
      try {
        await restoreBackup(supabaseClient, tableName, backupId);
        console.log(`Rollback completed for ${tableName}`);
      } catch (rollbackError) {
        console.error(`Rollback failed for ${tableName}:`, rollbackError);
      }
    }
    
    // Log erro
    if (logId) {
      await supabaseClient
        .from('sync_logs')
        .update({
          status: 'erro',
          erro_msg: error.message,
          tempo_execucao_ms: Date.now() - startTime,
          detalhes: {
            strategy: strategy.strategy,
            recordCount: data.length,
            backupId,
            rollbackAttempted: !!backupId
          }
        })
        .eq('id', logId);
    }

    throw error;
  }
}

async function truncateAndInsert(supabaseClient: any, tableName: string, data: any[], batchSize: number) {
  console.log(`TRUNCATE + INSERT strategy for ${tableName} - ${data.length} records`);
  
  // 1. Truncar tabela
  const { error: deleteError } = await supabaseClient
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

  if (deleteError) {
    throw new Error(`Failed to truncate ${tableName}: ${deleteError.message}`);
  }

  console.log(`Table ${tableName} truncated successfully`);

  // 2. Insert em lotes
  let processedRecords = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const { error: insertError } = await supabaseClient
      .from(tableName)
      .insert(batch);

    if (insertError) {
      console.error(`Batch insert error for ${tableName}:`, insertError);
      throw new Error(`Batch insert failed: ${insertError.message}`);
    }

    processedRecords += batch.length;
    console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} for ${tableName}`);
  }

  return processedRecords;
}

async function upsertWithCleanup(supabaseClient: any, tableName: string, data: any[], strategy: any) {
  console.log(`UPSERT + CLEANUP strategy for ${tableName} - ${data.length} records`);
  
  try {
    // Usar a nova função PostgreSQL simple_upsert_cleanup
    const { data: result, error } = await supabaseClient.rpc('simple_upsert_cleanup', {
      target_table: tableName,
      data_json: data,
      cleanup_days: strategy.orphanDays || 30
    });

    if (error) {
      console.error(`Simple upsert cleanup error for ${tableName}:`, error);
      throw new Error(`Simple upsert cleanup failed: ${error.message}`);
    }

    console.log(`Simple upsert cleanup completed for ${tableName}:`, result);
    return result.processed_records || 0;
    
  } catch (error) {
    console.error(`Falling back to standard upsert for ${tableName}:`, error);
    // Fallback para método padrão se a função falhar
    return await upsertData(supabaseClient, tableName, data, strategy.batchSize);
  }
}

async function upsertData(supabaseClient: any, tableName: string, data: any[], batchSize: number, syncTimestamp?: string) {
  console.log(`UPSERT strategy for ${tableName} - ${data.length} records`);
  
  let processedRecords = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    // Adicionar timestamp de sincronização se fornecido
    const batchWithSync = syncTimestamp 
      ? batch.map(record => ({ ...record, sync_at: syncTimestamp }))
      : batch;
    
    const { error: upsertError } = await supabaseClient
      .from(tableName)
      .upsert(batchWithSync);

    if (upsertError) {
      console.error(`Batch upsert error for ${tableName}:`, upsertError);
      throw new Error(`Batch upsert failed: ${upsertError.message}`);
    }

    processedRecords += batch.length;
    console.log(`Upserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} for ${tableName}`);
  }

  return processedRecords;
}

async function createBackup(supabaseClient: any, tableName: string) {
  const backupTableName = `${tableName}_backup_${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  console.log(`Creating backup table: ${backupTableName}`);
  
  try {
    // Contar registros na tabela original
    const { count } = await supabaseClient
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    // Criar entrada de log do backup
    const { data: backupLog } = await supabaseClient
      .from('sync_logs')
      .insert({
        tabela_destino: backupTableName,
        operacao: 'backup_create',
        status: 'concluido',
        registros_processados: count,
        detalhes: { 
          originalTable: tableName,
          backupTable: backupTableName,
          recordCount: count,
          timestamp 
        }
      })
      .select()
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        backupId: backupLog?.id,
        backupTable: backupTableName,
        recordCount: count,
        timestamp
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`Backup creation failed for ${tableName}:`, error);
    throw new Error(`Backup failed: ${error.message}`);
  }
}

async function restoreBackup(supabaseClient: any, tableName: string, backupId: string) {
  console.log(`Restoring backup for ${tableName} using backup ID: ${backupId}`);
  
  try {
    // Buscar informações do backup
    const { data: backupInfo } = await supabaseClient
      .from('sync_logs')
      .select('detalhes')
      .eq('id', backupId)
      .maybeSingle();

    if (!backupInfo?.detalhes?.backupTable) {
      throw new Error(`Backup not found for ID: ${backupId}`);
    }

    const backupTable = backupInfo.detalhes.backupTable;
    
    // Log início da restauração
    await supabaseClient
      .from('sync_logs')
      .insert({
        tabela_destino: tableName,
        operacao: 'backup_restore',
        status: 'concluido',
        detalhes: { 
          backupId,
          backupTable,
          timestamp: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backup restore completed for ${tableName}`,
        backupId,
        backupTable
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`Backup restore failed for ${tableName}:`, error);
    throw new Error(`Restore failed: ${error.message}`);
  }
}

async function cleanupOrphans(supabaseClient: any, tableName: string, orphanDays: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - orphanDays);
  
  console.log(`Cleaning up orphans in ${tableName} older than ${cutoffDate.toISOString()}`);
  
  try {
    // Para tabelas com sync_at, remove registros antigos não sincronizados
    const { data: deletedRecords, error } = await supabaseClient
      .from(tableName)
      .delete()
      .lt('sync_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error(`Orphan cleanup error for ${tableName}:`, error);
      return 0;
    }

    const deletedCount = deletedRecords?.length || 0;
    console.log(`Cleaned up ${deletedCount} orphan records from ${tableName}`);
    
    // Log da limpeza
    await supabaseClient
      .from('sync_logs')
      .insert({
        tabela_destino: tableName,
        operacao: 'cleanup_orphans',
        status: 'concluido',
        registros_processados: deletedCount,
        detalhes: { 
          cutoffDate: cutoffDate.toISOString(),
          orphanDays,
          deletedCount
        }
      });

    return deletedCount;

  } catch (error) {
    console.error(`Orphan cleanup failed for ${tableName}:`, error);
    return 0;
  }
}