
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
    targetTable: 'produtos_legado',
    fields: ['produto_id', 'nome_produto', 'categoria', 'unidade', 'preco_unitario']
  },
  vwCpReceita: {
    description: 'Receitas',
    targetTable: 'receitas_legado',
    fields: ['receita_id', 'nome_receita', 'categoria_receita', 'tempo_preparo', 'porcoes']
  },
  vwCpReceitaProduto: {
    description: 'Ingredientes das Receitas',
    targetTable: 'receitas_legado',
    fields: ['receita_id', 'produto_id', 'quantidade', 'unidade']
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

    const { viewName, action } = await req.json();
    console.log(`Processing request for view: ${viewName}, action: ${action}`);

    if (action === 'checkViews') {
      return await checkViewsAvailability(supabaseClient);
    }

    if (viewName && VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING]) {
      return await syncView(supabaseClient, viewName);
    }

    throw new Error('Invalid view name or action');

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
  
  // Simular verificação de views - em produção usaria driver SQL Server
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

async function syncView(supabaseClient: any, viewName: string) {
  console.log(`Syncing view: ${viewName}`);
  
  const startTime = Date.now();
  
  // Log sync start
  const { data: logData } = await supabaseClient
    .from('sync_logs')
    .insert({
      tabela_destino: viewName,
      operacao: 'sync_view',
      status: 'iniciado'
    })
    .select()
    .single();

  const logId = logData?.id;

  try {
    // Simular dados da view - em produção consultaria SQL Server
    const mockData = await getMockDataForView(viewName);
    
    const recordCount = await processViewData(supabaseClient, viewName, mockData);
    
    const executionTime = Date.now() - startTime;

    // Update sync log with success
    if (logId) {
      await supabaseClient
        .from('sync_logs')
        .update({
          status: 'concluido',
          registros_processados: recordCount,
          tempo_execucao_ms: executionTime,
          detalhes: { viewName, recordCount }
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        viewName,
        recordCount,
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
          tempo_execucao_ms: Date.now() - startTime
        })
        .eq('id', logId);
    }

    throw error;
  }
}

async function getMockDataForView(viewName: string) {
  // Simular delay de consulta SQL Server
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const mockData: Record<string, any[]> = {
    vwCoSolicitacaoFilialCusto: [
      { filial_id: 'FIL001', custo_total: 25000, orcamento_mensal: 30000, nome_filial: 'Matriz SP' },
      { filial_id: 'FIL002', custo_total: 18000, orcamento_mensal: 22000, nome_filial: 'Filial RJ' }
    ],
    vwCoSolicitacaoProdutoListagem: [
      { produto_id: 'PROD001', nome_produto: 'Frango Peito', categoria: 'Proteína', unidade: 'kg', preco_unitario: 12.50 },
      { produto_id: 'PROD002', nome_produto: 'Arroz Integral', categoria: 'Carboidrato', unidade: 'kg', preco_unitario: 4.80 }
    ],
    vwCpReceita: [
      { receita_id: 'REC001', nome_receita: 'Frango Grelhado', categoria_receita: 'Prato Principal', tempo_preparo: 25, porcoes: 4 },
      { receita_id: 'REC002', nome_receita: 'Salada Verde', categoria_receita: 'Acompanhamento', tempo_preparo: 10, porcoes: 6 }
    ],
    vwCpReceitaProduto: [
      { receita_id: 'REC001', produto_id: 'PROD001', quantidade: 0.15, unidade: 'kg' },
      { receita_id: 'REC002', produto_id: 'PROD003', quantidade: 0.1, unidade: 'kg' }
    ],
    vwEstProdutoBase: [
      { produto_id: 'PROD001', nome: 'Frango Peito', categoria: 'Proteína', unidade: 'kg', preco_unitario: 12.50, peso_unitario: 1.0 },
      { produto_id: 'PROD002', nome: 'Arroz Integral', categoria: 'Carboidrato', unidade: 'kg', preco_unitario: 4.80, peso_unitario: 1.0 }
    ],
    vwOrFiliaisAtiva: [
      { filial_id: 'FIL001', nome_empresa: 'Tech Solutions Ltda', total_funcionarios: 120, ativo: true },
      { filial_id: 'FIL002', nome_empresa: 'Inovação Corp', total_funcionarios: 85, ativo: true }
    ]
  };

  return mockData[viewName] || [];
}

async function processViewData(supabaseClient: any, viewName: string, data: any[]) {
  const mapping = VIEW_MAPPING[viewName as keyof typeof VIEW_MAPPING];
  let processedCount = 0;

  for (const record of data) {
    try {
      if (mapping.targetTable === 'produtos_legado') {
        await supabaseClient
          .from('produtos_legado')
          .upsert({
            produto_id_legado: record.produto_id,
            nome: record.nome_produto || record.nome,
            categoria: record.categoria,
            unidade: record.unidade,
            preco_unitario: record.preco_unitario,
            peso_unitario: record.peso_unitario || 1.0,
            disponivel: true
          });
      } else if (mapping.targetTable === 'receitas_legado') {
        if (viewName === 'vwCpReceita') {
          await supabaseClient
            .from('receitas_legado')
            .upsert({
              receita_id_legado: record.receita_id,
              nome_receita: record.nome_receita,
              categoria_receita: record.categoria_receita,
              tempo_preparo: record.tempo_preparo,
              porcoes: record.porcoes,
              ingredientes: []
            });
        }
      } else if (mapping.targetTable === 'contratos_corporativos') {
        await supabaseClient
          .from('contratos_corporativos')
          .upsert({
            cliente_id_legado: record.filial_id,
            nome_empresa: record.nome_filial || record.nome_empresa,
            total_funcionarios: record.total_funcionarios || 0,
            custo_maximo_refeicao: record.custo_total ? record.custo_total / 30 : 15.0,
            ativo: record.ativo !== false
          });
      }
      
      processedCount++;
    } catch (error) {
      console.error(`Error processing record for ${viewName}:`, error);
    }
  }

  return processedCount;
}
