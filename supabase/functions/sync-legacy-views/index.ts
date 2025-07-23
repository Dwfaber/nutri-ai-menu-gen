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
    targetTable: 'produtos_legado',
    fields: ['produto_id', 'nome', 'categoria', 'unidade', 'preco_unitario', 'peso_unitario']
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
        return await syncViewWithData(supabaseClient, requestBody.viewName, validData);
      } else {
        console.log(`Nenhum registro válido encontrado para ${requestBody.viewName} - tratando como teste manual`);
        return await syncViewWithData(supabaseClient, requestBody.viewName, []);
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

async function syncViewWithData(supabaseClient: any, viewName: string, data: any[]) {
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
    .single();

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
    
    const recordCount = await processViewData(supabaseClient, viewName, data);
    
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

async function processViewData(supabaseClient: any, viewName: string, data: any[]) {
  const mapping = VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING];
  let processedCount = 0;

  // PROCESSAMENTO SIMPLIFICADO para vwCoSolicitacaoFilialCusto - mapeamento direto
  if (viewName === 'vwCoSolicitacaoFilialCusto') {
    console.log(`Processamento simplificado de custos de filiais - ${data.length} registros`);
    
    for (const record of data) {
      try {
        // LOG DETALHADO: Ver o que está chegando
        console.log(`Processando registro ${processedCount + 1}:`, {
          cliente_id_legado: record.cliente_id_legado,
          filial_id: record.filial_id,
          RefCustoSegunda: record.RefCustoSegunda,
          custo_total: record.custo_total
        });

        // MAPEAMENTO DIRETO - sem conversões complexas, apenas conversões de tipo básicas
        const dataToInsert = {
          cliente_id_legado: record.cliente_id_legado ? parseInt(record.cliente_id_legado.toString()) : record.filial_id ? parseInt(record.filial_id.toString()) : null,
          filial_id: record.filial_id ? parseInt(record.filial_id.toString()) : null,
          nome_filial: record.nome_filial || record.nome_empresa || null,
          custo_total: record.custo_total ? parseFloat(record.custo_total.toString()) : null,
          // Mapeamento direto dos campos RefCusto*
          RefCustoSegunda: record.RefCustoSegunda ? parseFloat(record.RefCustoSegunda.toString()) : null,
          RefCustoTerca: record.RefCustoTerca ? parseFloat(record.RefCustoTerca.toString()) : null,
          RefCustoQuarta: record.RefCustoQuarta ? parseFloat(record.RefCustoQuarta.toString()) : null,
          RefCustoQuinta: record.RefCustoQuinta ? parseFloat(record.RefCustoQuinta.toString()) : null,
          RefCustoSexta: record.RefCustoSexta ? parseFloat(record.RefCustoSexta.toString()) : null,
          RefCustoSabado: record.RefCustoSabado ? parseFloat(record.RefCustoSabado.toString()) : null,
          RefCustoDomingo: record.RefCustoDomingo ? parseFloat(record.RefCustoDomingo.toString()) : null,
          RefCustoDiaEspecial: record.RefCustoDiaEspecial ? parseFloat(record.RefCustoDiaEspecial.toString()) : null,
          // Campos adicionais - mapeamento direto
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
        };

        console.log(`Dados para inserção:`, {
          cliente_id_legado: dataToInsert.cliente_id_legado,
          RefCustoSegunda: dataToInsert.RefCustoSegunda,
          custo_total: dataToInsert.custo_total
        });

        // CORREÇÃO: Usar upsert com onConflict para evitar erro de chave duplicada
        const { error } = await supabaseClient
          .from('custos_filiais')
          .upsert(dataToInsert, { onConflict: 'cliente_id_legado,filial_id' });

        if (error) {
          console.error(`Erro ao processar custo de filial:`, error);
          console.error(`Dados que causaram erro:`, dataToInsert);
        } else {
          processedCount++;
          
          if (processedCount % 1000 === 0) {
            console.log(`Processados ${processedCount} registros de custos de filiais`);
          }
        }
      } catch (error) {
        console.error(`Erro ao processar registro de custo:`, error);
        console.error(`Registro problemático:`, record);
      }
    }
    
    console.log(`Processamento de custos concluído: ${processedCount} registros inseridos/atualizados`);
    return processedCount;
  }

  // Tratamento especial para vwCpReceitaProduto (ingredientes das receitas)
  if (viewName === 'vwCpReceitaProduto') {
    console.log(`Processamento de ingredientes de receitas - ${data.length} registros`);
    
    for (const record of data) {
      try {
        // CORREÇÃO: Usar upsert com onConflict para evitar erro de chave duplicada
        const { error } = await supabaseClient
          .from('receita_ingredientes')
          .upsert({
            receita_id_legado: record.receita_id?.toString(),
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
    return processedCount;
  }

  // Processamento padrão para outras views
  for (const record of data) {
    try {
      // Log progresso para lotes grandes
      if (processedCount > 0 && processedCount % 500 === 0) {
        console.log(`Processando registro ${processedCount}/${data.length} da view ${viewName}`);
      }

      if (mapping.targetTable === 'co_solicitacao_produto_listagem') {
        console.log(`Processando produto solicitação com ID: ${record.solicitacao_produto_listagem_id || record.id}`);
        
        // Mapeamento exato conforme dados do N8N
        const dataToInsert = {
          solicitacao_produto_listagem_id: record.solicitacao_produto_listagem_id ? parseInt(record.solicitacao_produto_listagem_id.toString()) : null,
          solicitacao_produto_categoria_id: record.solicitacao_produto_categoria_id ? parseInt(record.solicitacao_produto_categoria_id.toString()) : null,
          categoria_descricao: record.categoria_descricao?.toString() || null,
          grupo: record.grupo?.toString() || null,
          produto_id: record.produto_id ? parseInt(record.produto_id.toString()) : null,
          preco: record.preco ? parseFloat(record.preco.toString()) : null,
          per_capita: record.per_capita ? parseFloat(record.per_capita.toString()) : null,
          apenas_valor_inteiro_sim_nao: record.apenas_valor_inteiro_sim_nao === true || record.apenas_valor_inteiro_sim_nao === 'true',
          arredondar_tipo: record.arredondar_tipo ? parseInt(record.arredondar_tipo.toString()) : null,
          em_promocao_sim_nao: record.em_promocao_sim_nao === true || record.em_promocao_sim_nao === 'true',
          descricao: record.descricao?.toString() || null,
          unidade: record.unidade?.toString() || null,
          preco_compra: record.preco_compra ? parseFloat(record.preco_compra.toString()) : null,
          produto_base_id: record.produto_base_id ? parseInt(record.produto_base_id.toString()) : null,
          produto_base_quantidade_embalagem: record.produto_base_quantidade_embalagem ? parseFloat(record.produto_base_quantidade_embalagem.toString()) : null,
          criado_em: new Date().toISOString(),
          solicitacao_id: Math.floor(Date.now() / 1000) // Timestamp como ID da solicitação
        };
        
        console.log(`Dados mapeados para inserção:`, {
          id: dataToInsert.solicitacao_produto_listagem_id,
          categoria: dataToInsert.categoria_descricao,
          produto: dataToInsert.descricao,
          preco: dataToInsert.preco
        });

        // CORREÇÃO PRINCIPAL: Usar upsert com onConflict para resolver o erro de chave duplicada
        const { error } = await supabaseClient
          .from('co_solicitacao_produto_listagem')
          .upsert(dataToInsert, { 
            onConflict: 'solicitacao_produto_listagem_id',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`Erro ao processar produto solicitação ID ${record.solicitacao_produto_listagem_id}:`, error);
          console.error(`Dados problemáticos:`, dataToInsert);
        } else {
          processedCount++;
          console.log(`Produto solicitação ID ${record.solicitacao_produto_listagem_id} processado com sucesso`);
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

