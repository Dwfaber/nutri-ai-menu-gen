import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento das views e suas finalidades - ATUALIZADO com separação
const VIEW_MAPPING = {
  vwCoSolicitacaoFilialCusto: {
    description: 'Custos por Filial',
    targetTable: 'custos_filiais', // Nova tabela específica
    fields: ['cliente_id_legado', 'filial_id', 'nome_filial', 'custo_total', 'RefCustoSegunda', 'RefCustoTerca', 'RefCustoQuarta', 'RefCustoQuinta', 'RefCustoSexta', 'RefCustoSabado', 'RefCustoDomingo', 'RefCustoDiaEspecial', 'QtdeRefeicoesUsarMediaValidarSimNao', 'PorcentagemLimiteAcimaMedia', 'custo_medio_semanal', 'solicitacao_filial_custo_id', 'solicitacao_compra_tipo_id', 'user_name', 'user_date_time', 'nome_fantasia', 'razao_social', 'solicitacao_compra_tipo_descricao']
  },
  vwCoSolicitacaoProdutoListagem: {
    description: 'Produtos Solicitados',
    targetTable: 'co_solicitacao_produto_listagem',
    fields: ['produto_id', 'nome_produto', 'categoria', 'unidade', 'preco_unitario', 'quantidade_embalagem', 'preco_compra']
  },
  // Adicionar mapeamento para o formato N8N (compatibilidade)
  co_solicitacao_produto_listagem: {
    description: 'Produtos Solicitados (formato N8N)',
    targetTable: 'co_solicitacao_produto_listagem',
    fields: ['solicitacao_produto_listagem_id', 'solicitacao_produto_categoria_id', 'categoria_descricao', 'grupo', 'produto_id', 'preco', 'per_capita', 'apenas_valor_inteiro_sim_nao', 'arredondar_tipo', 'em_promocao_sim_nao', 'descricao', 'unidade', 'preco_compra', 'produto_base_id', 'produto_base_quantidade_embalagem']
  },
  vwCpReceita: {
    description: 'Receitas',
    targetTable: 'receitas_legado',
    fields: ['receita_id', 'nome_receita', 'categoria_receita', 'tempo_preparo', 'porcoes']
  },
  vwCpReceitaProduto: {
    description: 'Ingredientes das Receitas',
    targetTable: 'receita_ingredientes',
    fields: ['receita_id_legado', 'receita_produto_id', 'produto_base_id', 'produto_id', 'quantidade', 'unidade_medida_id', 'unidade', 'notas', 'receita_produto_classificacao_id', 'user_name', 'user_date_time']
  },
  vwEstProdutoBase: {
    description: 'Produtos Base',
    targetTable: 'produtos_base',
    fields: ['ProdutoBaseId', 'Descricao', 'UnidadeMedidaId', 'UserName', 'UserDateTime', 'Unidade']
  },
  // Adicionar mapeamento para EstProdutoBase (formato N8N)
  EstProdutoBase: {
    description: 'Produtos Base (formato N8N)',
    targetTable: 'produtos_base', 
    fields: ['ProdutoBaseId', 'Descricao', 'UnidadeMedidaId', 'UserName', 'UserDateTime', 'Unidade']
  },
  vwOrFiliaisAtiva: {
    description: 'Filiais Ativas (Contratos)',
    targetTable: 'contratos_corporativos', // Mantém na tabela original
    fields: ['cliente_id_legado', 'nome_empresa', 'total_funcionarios', 'ativo', 'periodicidade', 'restricoes_alimentares']
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const requestBody = await req.json();
    console.log(`Processing request:`, requestBody);

    // Verificar se é uma requisição de checagem de views
    if (requestBody.action === 'checkViews') {
      return await checkViewsAvailability(supabaseClient);
    }

    // Verificar se é uma sincronização de view específica com dados do n8n
    if (requestBody.viewName && VIEW_MAPPING[requestBody.viewName as keyof typeof VIEW_MAPPING]) {
      let dataToProcess = [];
      
      // Extrair configurações de sincronização (opcionais)
      const syncConfig = {
        strategy: requestBody.syncStrategy || 'replace_all', // 'replace_all' ou 'merge'
        cleanup: requestBody.enableCleanup !== false, // default true
        batchSize: requestBody.batchSize || 100,
        keepVersions: requestBody.keepVersions || 5
      };
      
      console.log(`Configuração de sincronização:`, syncConfig);
      
      // Converter dados do N8N para formato array
      if (requestBody.data) {
        if (Array.isArray(requestBody.data)) {
          dataToProcess = requestBody.data;
        } else if (typeof requestBody.data === 'object') {
          // N8N envia objeto único, converter para array
          console.log(`Convertendo objeto único para array para ${requestBody.viewName}`);
          dataToProcess = [requestBody.data];
        }
      }
      
      // Filtrar registros válidos (não vazios)
      const validData = dataToProcess.filter(record => {
        if (!record || typeof record !== 'object') return false;
        
        // Verificar se pelo menos um campo tem valor não vazio
        const hasValidData = Object.values(record).some(value => 
          value !== null && value !== undefined && value !== ''
        );
        
        if (!hasValidData) {
          console.log(`Registro ignorado (todos os campos vazios):`, record);
          return false;
        }
        
        return true;
      });
      
      console.log(`Dados processados: ${dataToProcess.length} registros recebidos, ${validData.length} válidos para ${requestBody.viewName}`);
      
      if (validData.length > 0) {
        console.log(`Processando ${validData.length} registros válidos do n8n para ${requestBody.viewName}`);
        return await syncViewWithData(supabaseClient, requestBody.viewName, validData, syncConfig);
      } else {
        console.log(`Nenhum registro válido encontrado para ${requestBody.viewName} - tratando como teste manual`);
        return await syncViewWithData(supabaseClient, requestBody.viewName, [], syncConfig);
      }
    }

    throw new Error('Invalid request format. Expected: { viewName, data } or { action: "checkViews" }');

  } catch (error) {
    console.error('Error in sync-legacy-views function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function checkViewsAvailability(supabaseClient: any) {
  console.log('Checking views availability...');
  
  // Views disponíveis para sincronização - ATUALIZADO
  const availableViews = [
    'vwCoSolicitacaoFilialCusto', // → custos_filiais (estrutura padronizada)
    'vwCoSolicitacaoProdutoListagem',
    'co_solicitacao_produto_listagem', // → Formato N8N compatível
    'vwCpReceita',
    'vwCpReceitaProduto',
    'vwEstProdutoBase',
    'vwOrFiliaisAtiva' // → contratos_corporativos
  ];

  // Log da verificação
  const { error } = await supabaseClient
    .from('sync_logs')
    .insert({
      tabela_destino: 'views_check',
      operacao: 'check_availability',
      status: 'concluido',
      detalhes: { 
        availableViews,
        custos_filiais_padronizada: true,
        campos_duplicados_removidos: true,
        estrutura_legado_mantida: true
      }
    });

  if (error) {
    console.error('Error logging view check:', error);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      availableViews,
      message: 'Views verificadas - tabela custos_filiais padronizada com estrutura do sistema legado'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function syncViewWithData(supabaseClient: any, viewName: string, data: any[], syncConfig?: any) {
  console.log(`Syncing view: ${viewName} with ${data.length} records from n8n`);
  
  const startTime = Date.now();
  
  // Log sync start
  const { data: logData } = await supabaseClient
    .from('sync_logs')
    .insert({
      tabela_destino: viewName,
      operacao: 'sync_view_n8n',
      status: 'iniciado',
      detalhes: { 
        fonte: 'n8n dados reais',
        lote_tamanho: data.length,
        target_table: VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING]?.targetTable
      }
    })
    .select()
    .maybeSingle();

  const logId = logData?.id;

  try {
    // Se não há dados, é um teste manual
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`Teste manual para ${viewName} - sem processamento de dados`);
      
      if (logId) {
        await supabaseClient
          .from('sync_logs')
          .update({
            status: 'concluido',
            registros_processados: 0,
            tempo_execucao_ms: Date.now() - startTime,
            detalhes: { 
              viewName, 
              recordCount: 0,
              fonte: 'teste manual - sem dados',
              target_table: VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING]?.targetTable
            }
          })
          .eq('id', logId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          viewName,
          recordCount: 0,
          targetTable: VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING]?.targetTable,
          message: 'Teste manual executado - aguardando dados reais do n8n'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando ${data.length} registros reais da view ${viewName}`);
    
    // Log detalhes do primeiro registro para debug
    if (data.length > 0) {
      console.log(`Exemplo de registro recebido:`, JSON.stringify(data[0], null, 2));
    }
    
    const recordCount = await processViewData(supabaseClient, viewName, data, syncConfig);
    
    const executionTime = Date.now() - startTime;

    // Update sync log with success
    if (logId) {
      await supabaseClient
        .from('sync_logs')
        .update({
          status: 'concluido',
          registros_processados: recordCount,
          tempo_execucao_ms: executionTime,
          detalhes: { 
            viewName, 
            recordCount,
            fonte: 'n8n dados reais',
            lote_tamanho: data.length,
            target_table: VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING]?.targetTable
          }
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        viewName,
        recordCount,
        targetTable: VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING]?.targetTable,
        lote_tamanho: data.length,
        executionTime: `${executionTime}ms`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`Sync error for ${viewName}:`, error);
    
    // Update sync log with error
    if (logId) {
      await supabaseClient
        .from('sync_logs')
        .update({
          status: 'erro',
          erro_msg: error.message,
          tempo_execucao_ms: Date.now() - startTime,
          detalhes: {
            fonte: 'n8n dados reais',
            lote_tamanho: data.length,
            target_table: VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING]?.targetTable
          }
        })
        .eq('id', logId);
    }

    throw error;
  }
}

async function processViewData(supabaseClient: any, viewName: string, data: any[], syncConfig?: any) {
  const mapping = VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING];
  let processedCount = 0;

  // PROCESSAMENTO HÍBRIDO para vwCoSolicitacaoFilialCusto - usar strategy UPSERT_CLEANUP
  if (viewName === 'vwCoSolicitacaoFilialCusto') {
    console.log(`Processamento híbrido de custos de filiais - ${data.length} registros`);
    
    // Mapear dados para formato correto
    const mappedData = data.map(record => ({
      cliente_id_legado: record.cliente_id_legado ? parseInt(record.cliente_id_legado.toString()) : record.filial_id ? parseInt(record.filial_id.toString()) : null,
      filial_id: record.filial_id ? parseInt(record.filial_id.toString()) : null,
      nome_filial: record.nome_filial || record.nome_empresa || null,
      custo_total: record.custo_total ? parseFloat(record.custo_total.toString()) : null,
      RefCustoSegunda: record.RefCustoSegunda ? parseFloat(record.RefCustoSegunda.toString()) : null,
      RefCustoTerca: record.RefCustoTerca ? parseFloat(record.RefCustoTerca.toString()) : null,
      RefCustoQuarta: record.RefCustoQuarta ? parseFloat(record.RefCustoQuarta.toString()) : null,
      RefCustoQuinta: record.RefCustoQuinta ? parseFloat(record.RefCustoQuinta.toString()) : null,
      RefCustoSexta: record.RefCustoSexta ? parseFloat(record.RefCustoSexta.toString()) : null,
      RefCustoSabado: record.RefCustoSabado ? parseFloat(record.RefCustoSabado.toString()) : null,
      RefCustoDomingo: record.RefCustoDomingo ? parseFloat(record.RefCustoDomingo.toString()) : null,
      RefCustoDiaEspecial: record.RefCustoDiaEspecial ? parseFloat(record.RefCustoDiaEspecial.toString()) : null,
      QtdeRefeicoesUsarMediaValidarSimNao: record.QtdeRefeicoesUsarMediaValidarSimNao === true || record.QtdeRefeicoesUsarMediaValidarSimNao === 'true' || record.QtdeRefeicoesUsarMediaValidarSimNao === 1,
      PorcentagemLimiteAcimaMedia: record.PorcentagemLimiteAcimaMedia ? parseInt(record.PorcentagemLimiteAcimaMedia.toString()) : null,
      custo_medio_semanal: record.custo_medio_semanal ? parseFloat(record.custo_medio_semanal.toString()) : null,
      solicitacao_filial_custo_id: record.solicitacao_filial_custo_id ? parseInt(record.solicitacao_filial_custo_id.toString()) : null,
      solicitacao_compra_tipo_id: record.solicitacao_compra_tipo_id ? parseInt(record.solicitacao_compra_tipo_id.toString()) : null,
      user_name: record.user_name?.toString() || null,
      user_date_time: record.user_date_time || null,
      nome_fantasia: record.nome_fantasia?.toString() || null,
      razao_social: record.razao_social?.toString() || null,
      solicitacao_compra_tipo_descricao: record.solicitacao_compra_tipo_descricao?.toString() || null,
      sync_at: new Date().toISOString()
    }));

    // Usar hybrid sync manager para custos
    const hybridResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/hybrid-sync-manager`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'sync_table',
        targetTable: 'custos_filiais',
        data: mappedData
      })
    });

    const result = await hybridResponse.json();
    
    if (!result.success) {
      throw new Error(`Custos sync failed: ${result.error}`);
    }
    
    console.log(`Custos sync completed: ${result.processedRecords}/${data.length} registros usando ${result.strategy}`);
    return result.processedRecords;
  }

  // Tratamento especial para vwCpReceitaProduto (ingredientes das receitas)
  if (viewName === 'vwCpReceitaProduto') {
    console.log(`Processamento de ingredientes de receitas - ${data.length} registros`);
    
    // Buscar todas as receitas disponíveis para mapear nomes
    console.log('Buscando receitas para mapear nomes...');
    const { data: receitasData, error: receitasError } = await supabaseClient
      .from('receitas_legado')
      .select('receita_id_legado, nome_receita');
    
    if (receitasError) {
      console.error('Erro ao buscar receitas:', receitasError);
    }
    
    // Criar mapa receita_id -> nome_receita para performance
    const receitaNomeMap = new Map();
    if (receitasData) {
      receitasData.forEach(receita => {
        receitaNomeMap.set(receita.receita_id_legado, receita.nome_receita);
      });
      console.log(`Mapa de receitas criado: ${receitaNomeMap.size} receitas encontradas`);
    }
    
    let receitasEncontradas = 0;
    let receitasNaoEncontradas = 0;
    
    for (const record of data) {
      try {
        const receitaId = record.receita_id?.toString();
        const nomeReceita = receitaNomeMap.get(receitaId);
        
        if (nomeReceita) {
          receitasEncontradas++;
        } else {
          receitasNaoEncontradas++;
          console.warn(`Receita não encontrada para ID: ${receitaId}`);
        }
        
        // CORREÇÃO: Usar upsert com onConflict para evitar erro de chave duplicada
        const { error } = await supabaseClient
          .from('receita_ingredientes')
          .upsert({
            receita_id_legado: receitaId,
            receita_produto_id: record.receita_produto_id,
            produto_base_id: record.produto_base_id,
            produto_id: record.produto_id,
            quantidade: record.quantidade || 0,
            unidade_medida_id: record.unidade_medida_id,
            unidade: record.unidade,
            notas: record.notas,
            receita_produto_classificacao_id: record.receita_produto_classificacao_id,
            user_name: record.user_name,
            user_date_time: record.user_date_time,
            nome: nomeReceita || null, // Nova coluna com nome da receita
            sync_at: new Date().toISOString()
          }, { onConflict: 'receita_id_legado,receita_produto_id' });

        if (error) {
          console.error(`Erro ao processar ingrediente:`, error);
        } else {
          processedCount++;
        }
      } catch (error) {
        console.error(`Erro ao processar ingrediente:`, error);
      }
    }
    
    console.log(`Processamento de ingredientes concluído: ${processedCount} ingredientes inseridos/atualizados`);
    console.log(`Receitas encontradas: ${receitasEncontradas}, não encontradas: ${receitasNaoEncontradas}`);
    return processedCount;
  }

  // TRATAMENTO ESPECIAL PARA co_solicitacao_produto_listagem: REPLACE ALL
  // USAR HYBRID SYNC MANAGER para co_solicitacao_produto_listagem
  if (mapping.targetTable === 'co_solicitacao_produto_listagem') {
    console.log(`🔄 Usando Hybrid Sync Manager para co_solicitacao_produto_listagem - ${data.length} registros`);
    
    // Usar hybrid sync manager com UPSERT_CLEANUP para evitar duplicatas
    const hybridResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/hybrid-sync-manager`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'sync_table',
        targetTable: 'co_solicitacao_produto_listagem',
        data: data,
        syncConfig: {
          strategy: 'upsert_cleanup',
          cleanup: true,
          batchSize: 100,
          uniqueColumns: ['solicitacao_id', 'produto_base_id']
        }
      })
    });

    const result = await hybridResponse.json();
    
    if (!result.success) {
      throw new Error(`co_solicitacao_produto_listagem sync failed: ${result.error}`);
    }
    
    console.log(`✅ co_solicitacao_produto_listagem sync completed: ${result.processedRecords}/${data.length} registros usando ${result.strategy}`);
    return result.processedRecords;
  }

  // Processamento padrão para outras views
  for (const record of data) {
    try {
      // Log progresso para lotes grandes
      if (processedCount > 0 && processedCount % 500 === 0) {
        console.log(`Processando registro ${processedCount}/${data.length} da view ${viewName}`);
      }

      if (mapping.targetTable === 'produtos_base') {
        console.log(`Processando produto base com ID: ${record.ProdutoBaseId || record.produto_base_id}`);
        
        // Mapeamento exato conforme dados do N8N para EstProdutoBase
        const dataToInsert = {
          produto_base_id: record.ProdutoBaseId ? parseInt(record.ProdutoBaseId.toString()) : null,
          descricao: record.Descricao?.toString() || null,
          unidade_medida_id: record.UnidadeMedidaId ? parseInt(record.UnidadeMedidaId.toString()) : null,
          user_name: record.UserName?.toString() || null,
          user_date_time: record.UserDateTime || null,
          unidade: record.Unidade?.toString() || null,
          sync_at: new Date().toISOString()
        };
        
        // Validação rigorosa dos dados antes do upsert
        if (!dataToInsert.produto_base_id) {
          console.error(`ERRO: produto_base_id é obrigatório mas está ausente:`, record);
          continue; // Pula este registro inválido
        }

        console.log(`Dados validados para upsert do produto base:`, {
          id: dataToInsert.produto_base_id,
          descricao: dataToInsert.descricao,
          unidade: dataToInsert.unidade
        });

        // CORREÇÃO DEFINITIVA: Usar constraint name correto e validação rigorosa
        const { error } = await supabaseClient
          .from('produtos_base')
          .upsert(dataToInsert, { 
            onConflict: 'produtos_base_produto_base_id_key',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`Erro ao processar produto base ID ${record.ProdutoBaseId}:`, error);
          console.error(`Dados problemáticos:`, dataToInsert);
        } else {
          console.log(`Produto base ID ${record.ProdutoBaseId} processado com sucesso`);
        }
      } else if (mapping.targetTable === 'produtos_legado') {
        // CORREÇÃO: Usar upsert com onConflict para evitar erro de chave duplicada
        const { error } = await supabaseClient
          .from('produtos_legado')
          .upsert({
            produto_id_legado: record.produto_id?.toString() || record.id?.toString(),
            nome: record.nome_produto || record.nome,
            categoria: record.categoria,
            unidade: record.unidade,
            preco_unitario: record.preco_unitario || 0,
            peso_unitario: record.peso_unitario || 1.0,
            disponivel: record.disponivel !== false,
            sync_at: new Date().toISOString()
          }, { onConflict: 'produto_id_legado' });

        if (error) {
          console.error(`Erro ao processar produto:`, error);
        }
      } else if (mapping.targetTable === 'receitas_legado') {
        if (viewName === 'vwCpReceita') {
          // CORREÇÃO: Usar upsert com onConflict para evitar erro de chave duplicada
          const { error } = await supabaseClient
            .from('receitas_legado')
            .upsert({
              receita_id_legado: record.receita_id?.toString() || record.id?.toString(),
              nome_receita: record.nome_receita || record.nome,
              categoria_receita: record.categoria_receita || record.categoria,
              tempo_preparo: record.tempo_preparo || 0,
              porcoes: record.porcoes || 1,
              ingredientes: record.ingredientes || [],
              sync_at: new Date().toISOString()
            }, { onConflict: 'receita_id_legado' });

          if (error) {
            console.error(`Erro ao processar receita:`, error);
          }
        }
      } else if (mapping.targetTable === 'contratos_corporativos' && viewName === 'vwOrFiliaisAtiva') {
        // CORREÇÃO: Usar upsert com onConflict para evitar erro de chave duplicada
        const { error } = await supabaseClient
          .from('contratos_corporativos')
          .upsert({
            cliente_id_legado: record.filial_id?.toString() || record.cliente_id_legado?.toString() || record.id?.toString(),
            nome_empresa: record.nome_empresa || record.nome_filial || 'Empresa',
            total_funcionarios: record.total_funcionarios || 0,
            custo_maximo_refeicao: record.custo_maximo_refeicao || 15.0,
            total_refeicoes_mes: record.total_refeicoes_mes || (record.total_funcionarios * 22) || 0,
            periodicidade: record.periodicidade || 'mensal',
            restricoes_alimentares: record.restricoes_alimentares || [],
            ativo: record.ativo !== false,
            sync_at: new Date().toISOString()
          }, { onConflict: 'cliente_id_legado' });

        if (error) {
          console.error(`Erro ao processar contrato:`, error);
        }
      }
      
      processedCount++;
    } catch (error) {
      console.error(`Error processing record for ${viewName}:`, error);
    }
  }

  console.log(`View ${viewName}: ${processedCount} registros processados de ${data.length} recebidos`);
  return processedCount;
}

