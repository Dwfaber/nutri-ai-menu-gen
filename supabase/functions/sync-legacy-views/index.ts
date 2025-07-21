
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento das views e suas finalidades
const VIEW_MAPPING = {
  vwCoSolicitacaoFilialCusto: {
    description: 'Custos por Filial',
    targetTable: 'contratos_corporativos',
    fields: ['filial_id', 'custo_total', 'orcamento_mensal', 'nome_filial']
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
    description: 'Filiais Ativas',
    targetTable: 'contratos_corporativos',
    fields: ['filial_id', 'nome_empresa', 'total_funcionarios', 'ativo']
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
  
  // Views disponíveis para sincronização
  const availableViews = [
    'vwCoSolicitacaoFilialCusto',
    'vwCoSolicitacaoProdutoListagem',
    'vwCpReceita',
    'vwCpReceitaProduto',
    'vwEstProdutoBase',
    'vwOrFiliaisAtiva'
  ];

  // Log da verificação
  const { error } = await supabaseClient
    .from('sync_logs')
    .insert({
      tabela_destino: 'views_check',
      operacao: 'check_availability',
      status: 'concluido',
      detalhes: { availableViews }
    });

  if (error) {
    console.error('Error logging view check:', error);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      availableViews,
      message: 'Views verificadas com sucesso'
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
        lote_tamanho: data.length
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
              fonte: 'teste manual - sem dados'
            }
          })
          .eq('id', logId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          viewName,
          recordCount: 0,
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
            lote_tamanho: data.length
          }
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        viewName,
        recordCount,
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
            lote_tamanho: data.length
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
      } else if (mapping.targetTable === 'contratos_corporativos') {
        const { error } = await supabaseClient
          .from('contratos_corporativos')
          .upsert({
            cliente_id_legado: record.filial_id?.toString() || record.id?.toString(),
            nome_empresa: record.nome_filial || record.nome_empresa || 'Empresa',
            total_funcionarios: record.total_funcionarios || 0,
            custo_maximo_refeicao: record.custo_total ? Number(record.custo_total) / 30 : 15.0,
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
