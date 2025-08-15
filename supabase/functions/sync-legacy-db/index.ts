
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LegacyProduct {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  preco_unitario: number;
  peso_unitario: number;
  disponivel: boolean;
}

interface LegacyRecipe {
  id: string;
  nome_receita: string;
  categoria_receita: string;
  ingredientes: any[];
  modo_preparo: string;
  tempo_preparo: number;
  porcoes: number;
  custo_total: number;
}

interface LegacyClient {
  id: string;
  nome_empresa: string;
  total_funcionarios: number;
  custo_maximo_refeicao: number;
  restricoes_alimentares: string[];
  total_refeicoes_mes: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { operation } = await req.json();
    console.log(`Starting sync operation: ${operation}`);

    // Log sync start
    const { data: logData } = await supabaseClient
      .from('sync_logs')
      .insert({
        tabela_destino: operation === 'all' ? 'todas' : operation,
        operacao: 'sync',
        status: 'iniciado'
      })
      .select()
      .maybeSingle();

    const logId = logData?.id;
    const startTime = Date.now();

    try {
      let processedRecords = 0;

      // Simulate SQL Server connection and data fetch
      // In production, you would use a proper SQL Server driver
      const mockLegacyData = await simulateLegacyDataFetch(operation);
      
      if (operation === 'produtos' || operation === 'all') {
        processedRecords += await syncProducts(supabaseClient, mockLegacyData.products);
      }

      if (operation === 'receitas' || operation === 'all') {
        processedRecords += await syncRecipes(supabaseClient, mockLegacyData.recipes);
      }

      if (operation === 'clientes' || operation === 'all') {
        processedRecords += await syncClients(supabaseClient, mockLegacyData.clients);
      }

      const executionTime = Date.now() - startTime;

      // Update sync log with success
      if (logId) {
        await supabaseClient
          .from('sync_logs')
          .update({
            status: 'concluido',
            registros_processados: processedRecords,
            tempo_execucao_ms: executionTime,
            detalhes: { operation, processedRecords }
          })
          .eq('id', logId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          operation,
          processedRecords,
          executionTime: `${executionTime}ms`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Sync error:', error);
      
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

  } catch (error) {
    console.error('Error in sync-legacy-db function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function simulateLegacyDataFetch(operation: string) {
  // Simulate SQL Server connection
  console.log('Connecting to SQL Server...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    products: [
      {
        id: 'PROD001',
        nome: 'Frango Peito s/ Osso',
        categoria: 'Proteína Animal',
        unidade: 'kg',
        preco_unitario: 12.50,
        peso_unitario: 1.0,
        disponivel: true
      },
      {
        id: 'PROD002',
        nome: 'Arroz Integral',
        categoria: 'Carboidrato',
        unidade: 'kg',
        preco_unitario: 4.80,
        peso_unitario: 1.0,
        disponivel: true
      },
      {
        id: 'PROD003',
        nome: 'Brócolis Congelado',
        categoria: 'Vegetal',
        unidade: 'kg',
        preco_unitario: 8.90,
        peso_unitario: 1.0,
        disponivel: true
      }
    ],
    recipes: [
      {
        id: 'REC001',
        nome_receita: 'Frango Grelhado com Quinoa',
        categoria_receita: 'Prato Principal',
        ingredientes: [
          { produto_id: 'PROD001', quantidade: 0.15, unidade: 'kg' },
          { produto_id: 'PROD004', quantidade: 0.08, unidade: 'kg' }
        ],
        modo_preparo: 'Temperar o frango e grelhar. Cozinhar a quinoa em caldo de legumes.',
        tempo_preparo: 25,
        porcoes: 1,
        custo_total: 8.50
      }
    ],
    clients: [
      {
        id: 'CLI001',
        nome_empresa: 'Tech Solutions Ltda',
        total_funcionarios: 120,
        custo_maximo_refeicao: 15.00,
        restricoes_alimentares: ['vegetarian-options'],
        total_refeicoes_mes: 2400
      }
    ]
  };
}

async function syncProducts(supabaseClient: any, products: LegacyProduct[]) {
  let count = 0;
  for (const product of products) {
    const { error } = await supabaseClient
      .from('produtos_legado')
      .upsert({
        produto_id_legado: product.id,
        nome: product.nome,
        categoria: product.categoria,
        unidade: product.unidade,
        preco_unitario: product.preco_unitario,
        peso_unitario: product.peso_unitario,
        disponivel: product.disponivel
      });
    
    if (!error) count++;
  }
  return count;
}

async function syncRecipes(supabaseClient: any, recipes: LegacyRecipe[]) {
  let count = 0;
  for (const recipe of recipes) {
    const { error } = await supabaseClient
      .from('receitas_legado')
      .upsert({
        receita_id_legado: recipe.id,
        nome_receita: recipe.nome_receita,
        categoria_receita: recipe.categoria_receita,
        ingredientes: recipe.ingredientes,
        modo_preparo: recipe.modo_preparo,
        tempo_preparo: recipe.tempo_preparo,
        porcoes: recipe.porcoes,
        custo_total: recipe.custo_total
      });
    
    if (!error) count++;
  }
  return count;
}

async function syncClients(supabaseClient: any, clients: LegacyClient[]) {
  let count = 0;
  for (const client of clients) {
    const { error } = await supabaseClient
      .from('contratos_corporativos')
      .upsert({
        cliente_id_legado: client.id,
        nome_empresa: client.nome_empresa,
        total_funcionarios: client.total_funcionarios,
        custo_maximo_refeicao: client.custo_maximo_refeicao,
        restricoes_alimentares: client.restricoes_alimentares,
        total_refeicoes_mes: client.total_refeicoes_mes
      });
    
    if (!error) count++;
  }
  return count;
}
