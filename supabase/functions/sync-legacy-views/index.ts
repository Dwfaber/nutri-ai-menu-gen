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
      // Se tem dados diretos para sincronizar (formato do n8n)
      if (requestBody.data && Array.isArray(requestBody.data) && requestBody.data.length > 0) {
        console.log(`Recebidos ${requestBody.data.length} registros reais do n8n para ${requestBody.viewName}`);
        return await syncViewWithData(supabaseClient, requestBody.viewName, requestBody.data);
      } else {
        // Se não tem dados, é um teste manual - processar sem dados
        console.log(`Teste manual para ${requestBody.viewName} - sem dados do n8n`);
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

        const { error } = await supabaseClient
          .from('custos_filiais')
          .upsert(dataToInsert);

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
          });

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
        const { error } = await supabaseClient
          .from('co_solicitacao_produto_listagem')
          .upsert({
            solicitacao_produto_listagem_id: record.solicitacao_produto_listagem_id || record.id,
            produto_id: record.produto_id,
            produto_base_id: record.produto_base_id,
            categoria_id: record.categoria_id,
            solicitacao_id: record.solicitacao_id,
            descricao: record.descricao || record.nome_produto,
            unidade: record.unidade,
            quantidade_embalagem: record.quantidade_embalagem || 1,
            produto_base_qtd_embalagem: record.produto_base_qtd_embalagem || 1,
            preco: record.preco || record.preco_unitario || 0,
            preco_compra: record.preco_compra || record.preco || 0,
            promocao: record.promocao || false,
            em_promocao: record.em_promocao || false,
            per_capita: record.per_capita || 0,
            inteiro: record.inteiro || false,
            apenas_valor_inteiro: record.apenas_valor_inteiro || false,
            arredondar_tipo: record.arredondar_tipo || 0,
            grupo: record.grupo,
            categoria_descricao: record.categoria_descricao,
            criado_em: record.criado_em || new Date().toISOString()
          });

        if (error) {
          console.error(`Erro ao processar produto solicitação:`, error);
        }
      } else if (mapping.targetTable === 'produtos_legado') {
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
          });

        if (error) {
          console.error(`Erro ao processar produto:`, error);
        }
      } else if (mapping.targetTable === 'receitas_legado') {
        if (viewName === 'vwCpReceita') {
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
            });

          if (error) {
            console.error(`Erro ao processar receita:`, error);
          }
        }
      } else if (mapping.targetTable === 'contratos_corporativos' && viewName === 'vwOrFiliaisAtiva') {
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
          });

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
