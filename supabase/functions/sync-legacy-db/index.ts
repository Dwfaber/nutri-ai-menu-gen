
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

      // Connect to real SQL Server legacy database
      const legacyData = await fetchRealLegacyData(operation);
      
      if (operation === 'produtos' || operation === 'all') {
        processedRecords += await syncProducts(supabaseClient, legacyData.products);
      }

      if (operation === 'receitas' || operation === 'all') {
        processedRecords += await syncRecipes(supabaseClient, legacyData.recipes);
      }

      if (operation === 'clientes' || operation === 'all') {
        processedRecords += await syncClients(supabaseClient, legacyData.clients);
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

async function fetchRealLegacyData(operation: string) {
  console.log(`Connecting to SQL Server for operation: ${operation}`);
  
  let sqlClient: Client | null = null;
  
  try {
    // Create SQL Server connection using environment variables
    const connectionString = `postgresql://${Deno.env.get('LEGACY_DB_USER')}:${Deno.env.get('LEGACY_DB_PASSWORD')}@${Deno.env.get('LEGACY_DB_HOST')}:${Deno.env.get('LEGACY_DB_PORT')}/legacy_db`;
    
    sqlClient = new Client(connectionString);
    await sqlClient.connect();
    console.log('Connected to legacy database successfully');

    const result = {
      products: [] as LegacyProduct[],
      recipes: [] as LegacyRecipe[],
      clients: [] as LegacyClient[]
    };

    // Fetch products if requested
    if (operation === 'produtos' || operation === 'all') {
      console.log('Fetching products from legacy database...');
      const productsResult = await sqlClient.queryArray(`
        SELECT 
          id,
          nome,
          categoria,
          unidade,
          preco_unitario,
          peso_unitario,
          CASE WHEN disponivel = 1 THEN true ELSE false END as disponivel
        FROM produtos 
        WHERE ativo = 1
        ORDER BY id
      `);
      
      result.products = productsResult.rows.map(row => ({
        id: String(row[0]),
        nome: String(row[1] || ''),
        categoria: String(row[2] || ''),
        unidade: String(row[3] || ''),
        preco_unitario: Number(row[4] || 0),
        peso_unitario: Number(row[5] || 0),
        disponivel: Boolean(row[6])
      }));
      
      console.log(`Fetched ${result.products.length} products`);
    }

    // Fetch recipes if requested
    if (operation === 'receitas' || operation === 'all') {
      console.log('Fetching recipes from legacy database...');
      const recipesResult = await sqlClient.queryArray(`
        SELECT 
          r.id,
          r.nome_receita,
          r.categoria_receita,
          r.modo_preparo,
          r.tempo_preparo,
          r.porcoes,
          r.custo_total,
          COALESCE(
            (SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'produto_id', ri.produto_id,
                'quantidade', ri.quantidade,
                'unidade', ri.unidade
              )
            ) FROM receita_ingredientes ri WHERE ri.receita_id = r.id),
            '[]'::json
          ) as ingredientes
        FROM receitas r 
        WHERE r.ativo = 1
        ORDER BY r.id
      `);
      
      result.recipes = recipesResult.rows.map(row => ({
        id: String(row[0]),
        nome_receita: String(row[1] || ''),
        categoria_receita: String(row[2] || ''),
        ingredientes: row[7] ? JSON.parse(String(row[7])) : [],
        modo_preparo: String(row[3] || ''),
        tempo_preparo: Number(row[4] || 0),
        porcoes: Number(row[5] || 1),
        custo_total: Number(row[6] || 0)
      }));
      
      console.log(`Fetched ${result.recipes.length} recipes`);
    }

    // Fetch clients if requested
    if (operation === 'clientes' || operation === 'all') {
      console.log('Fetching clients from legacy database...');
      const clientsResult = await sqlClient.queryArray(`
        SELECT 
          c.id,
          c.nome_empresa,
          c.total_funcionarios,
          c.custo_maximo_refeicao,
          COALESCE(c.restricoes_alimentares, '[]'::json) as restricoes_alimentares,
          c.total_refeicoes_mes
        FROM clientes c 
        WHERE c.ativo = 1
        ORDER BY c.id
      `);
      
      result.clients = clientsResult.rows.map(row => ({
        id: String(row[0]),
        nome_empresa: String(row[1] || ''),
        total_funcionarios: Number(row[2] || 0),
        custo_maximo_refeicao: Number(row[3] || 0),
        restricoes_alimentares: row[4] ? JSON.parse(String(row[4])) : [],
        total_refeicoes_mes: Number(row[5] || 0)
      }));
      
      console.log(`Fetched ${result.clients.length} clients`);
    }

    return result;

  } catch (error) {
    console.error('Legacy database connection error:', {
      error: error.message,
      operation,
      host: Deno.env.get('LEGACY_DB_HOST'),
      port: Deno.env.get('LEGACY_DB_PORT'),
      user: Deno.env.get('LEGACY_DB_USER'),
      timestamp: new Date().toISOString()
    });
    
    // Fallback to empty data on connection failure
    console.log('Falling back to empty dataset due to connection error');
    return {
      products: [],
      recipes: [],
      clients: []
    };
  } finally {
    if (sqlClient) {
      try {
        await sqlClient.end();
        console.log('Legacy database connection closed');
      } catch (closeError) {
        console.error('Error closing legacy database connection:', closeError);
      }
    }
  }
}

async function syncProducts(supabaseClient: any, products: LegacyProduct[]) {
  let count = 0;
  
  console.log(`Starting products sync: ${products.length} products to process`);
  
  for (const product of products) {
    try {
      // Validate required fields
      if (!product.id || !product.nome || !product.unidade) {
        console.warn(`Skipping invalid product:`, { 
          id: product.id, 
          nome: product.nome, 
          unidade: product.unidade 
        });
        continue;
      }

      const { error } = await supabaseClient
        .from('produtos_legado')
        .upsert({
          produto_id_legado: product.id,
          nome: product.nome.trim(),
          categoria: product.categoria?.trim() || null,
          unidade: product.unidade.trim(),
          preco_unitario: Math.max(0, product.preco_unitario || 0),
          peso_unitario: Math.max(0, product.peso_unitario || 0),
          disponivel: Boolean(product.disponivel)
        }, {
          onConflict: 'produto_id_legado'
        });
      
      if (error) {
        console.error(`Error syncing product ${product.id}:`, error);
      } else {
        count++;
      }
    } catch (error) {
      console.error(`Exception syncing product ${product.id}:`, error);
    }
  }
  
  console.log(`Products sync completed: ${count}/${products.length} products synced successfully`);
  return count;
}

async function syncRecipes(supabaseClient: any, recipes: LegacyRecipe[]) {
  let count = 0;
  
  console.log(`Starting recipes sync: ${recipes.length} recipes to process`);
  
  for (const recipe of recipes) {
    try {
      // Validate required fields
      if (!recipe.id || !recipe.nome_receita) {
        console.warn(`Skipping invalid recipe:`, { 
          id: recipe.id, 
          nome_receita: recipe.nome_receita 
        });
        continue;
      }

      const { error } = await supabaseClient
        .from('receitas_legado')
        .upsert({
          receita_id_legado: recipe.id,
          nome_receita: recipe.nome_receita.trim(),
          categoria_receita: recipe.categoria_receita?.trim() || null,
          modo_preparo: recipe.modo_preparo?.trim() || null,
          tempo_preparo: Math.max(0, recipe.tempo_preparo || 0),
          porcoes: Math.max(1, recipe.porcoes || 1),
          custo_total: Math.max(0, recipe.custo_total || 0)
        }, {
          onConflict: 'receita_id_legado'
        });
      
      if (error) {
        console.error(`Error syncing recipe ${recipe.id}:`, error);
      } else {
        count++;
      }
    } catch (error) {
      console.error(`Exception syncing recipe ${recipe.id}:`, error);
    }
  }
  
  console.log(`Recipes sync completed: ${count}/${recipes.length} recipes synced successfully`);
  return count;
}

async function syncClients(supabaseClient: any, clients: LegacyClient[]) {
  let count = 0;
  
  console.log(`Starting clients sync: ${clients.length} clients to process`);
  
  for (const client of clients) {
    try {
      // Validate required fields
      if (!client.id || !client.nome_empresa) {
        console.warn(`Skipping invalid client:`, { 
          id: client.id, 
          nome_empresa: client.nome_empresa 
        });
        continue;
      }

      const { error } = await supabaseClient
        .from('contratos_corporativos')
        .upsert({
          cliente_id_legado: client.id,
          nome_empresa: client.nome_empresa.trim(),
          total_funcionarios: Math.max(0, client.total_funcionarios || 0),
          custo_maximo_refeicao: Math.max(0, client.custo_maximo_refeicao || 0),
          restricoes_alimentares: Array.isArray(client.restricoes_alimentares) ? client.restricoes_alimentares : [],
          total_refeicoes_mes: Math.max(0, client.total_refeicoes_mes || 0)
        }, {
          onConflict: 'cliente_id_legado'
        });
      
      if (error) {
        console.error(`Error syncing client ${client.id}:`, error);
      } else {
        count++;
      }
    } catch (error) {
      console.error(`Exception syncing client ${client.id}:`, error);
    }
  }
  
  console.log(`Clients sync completed: ${count}/${clients.length} clients synced successfully`);
  return count;
}
