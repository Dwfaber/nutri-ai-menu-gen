
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações do SQL Server legado
const legacyDbConfig = {
  host: Deno.env.get('LEGACY_DB_HOST'),
  user: Deno.env.get('LEGACY_DB_USER'),
  password: Deno.env.get('LEGACY_DB_PASSWORD'),
  port: parseInt(Deno.env.get('LEGACY_DB_PORT') || '1433'),
  database: Deno.env.get('LEGACY_DB_NAME') || 'master'
};

// Configurações de timeout e retry
const CONNECTION_TIMEOUT = 10000; // 10 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 segundos

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // CORREÇÃO DE SEGURANÇA: Usar SERVICE_ROLE_KEY para operações de escrita
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action } = await req.json();
    console.log(`Schema discovery action: ${action}`);

    if (action === 'discoverSchema') {
      return await discoverDatabaseSchema(supabaseClient);
    } else if (action === 'mapTables') {
      return await mapLegacyTables(supabaseClient);
    } else if (action === 'adaptCodes') {
      return await adaptProductCodes(supabaseClient);
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in discover-legacy-schema function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function discoverDatabaseSchema(supabaseClient: any) {
  console.log('Conectando ao SQL Server para descoberta de schema...');
  
  let legacyClient: Client | null = null;
  let discoveredSchema: any = null;
  
  try {
    // Validar configurações obrigatórias
    if (!legacyDbConfig.host || !legacyDbConfig.user || !legacyDbConfig.password) {
      throw new Error('Configurações do banco SQL Server legado não encontradas');
    }

    // Tentar conectar ao SQL Server com retry logic
    legacyClient = await connectWithRetry();
    console.log('Conexão com SQL Server estabelecida com sucesso');

    // Descobrir tabelas reais do banco
    const tables = await discoverTables(legacyClient);
    console.log(`Descobertas ${tables.length} tabelas no banco legado`);

    // Descobrir relacionamentos FK
    const relationships = await discoverRelationships(legacyClient);
    console.log(`Descobertos ${relationships.length} relacionamentos FK`);

    discoveredSchema = {
      database: legacyDbConfig.database,
      discoveredAt: new Date().toISOString(),
      tables,
      relationships,
      connectionStatus: 'successful'
    };

    // Validar schema descoberto
    if (!validateDiscoveredSchema(discoveredSchema)) {
      throw new Error('Schema descoberto não passou na validação');
    }

  } catch (error) {
    console.error('Erro durante descoberta de schema:', error);
    
    // Log detalhado do erro
    const errorLog = {
      error: error.message,
      stack: error.stack,
      config: {
        host: legacyDbConfig.host,
        port: legacyDbConfig.port,
        database: legacyDbConfig.database,
        hasCredentials: !!(legacyDbConfig.user && legacyDbConfig.password)
      },
      timestamp: new Date().toISOString()
    };

    // Salvar erro nos logs
    await supabaseClient
      .from('sync_logs')
      .insert({
        tabela_destino: 'schema_discovery',
        operacao: 'discover',
        status: 'erro',
        erro_msg: error.message,
        detalhes: errorLog
      });

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: errorLog
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } finally {
    // Sempre fechar conexão
    if (legacyClient) {
      try {
        await legacyClient.end();
        console.log('Conexão SQL Server fechada');
      } catch (closeError) {
        console.error('Erro ao fechar conexão:', closeError);
      }
    }
  }

  // Salvar schema descoberto
  const { error } = await supabaseClient
    .from('sync_logs')
    .insert({
      tabela_destino: 'schema_discovery',
      operacao: 'discover',
      status: 'concluido',
      detalhes: discoveredSchema,
      registros_processados: discoveredSchema.tables.length
    });

  if (error) {
    console.error('Erro ao salvar schema descoberto:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Falha ao salvar schema no Supabase',
        details: error
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log('Schema descoberto e salvo com sucesso');
  return new Response(
    JSON.stringify({ 
      success: true, 
      schema: discoveredSchema,
      message: `Schema real descoberto: ${discoveredSchema.tables.length} tabelas, ${discoveredSchema.relationships.length} relacionamentos`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Função para conectar com retry logic
async function connectWithRetry(): Promise<Client> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Tentativa de conexão ${attempt}/${MAX_RETRIES}`);
      
      const client = new Client({
        hostname: legacyDbConfig.host,
        port: legacyDbConfig.port,
        user: legacyDbConfig.user,
        password: legacyDbConfig.password,
        database: legacyDbConfig.database,
      });

      // Conectar com timeout
      const connectPromise = client.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      
      // Testar conexão com query simples
      await client.queryArray('SELECT 1');
      
      return client;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`Tentativa ${attempt} falhou:`, error.message);
      
      if (attempt < MAX_RETRIES) {
        console.log(`Aguardando ${RETRY_DELAY}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  
  throw new Error(`Falha ao conectar após ${MAX_RETRIES} tentativas. Último erro: ${lastError.message}`);
}

// Descobrir tabelas reais do banco
async function discoverTables(client: Client) {
  const tablesQuery = `
    SELECT 
      t.table_name,
      c.column_name,
      c.data_type,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.is_nullable,
      c.column_default,
      CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    LEFT JOIN information_schema.key_column_usage pk ON 
      c.table_name = pk.table_name AND 
      c.column_name = pk.column_name AND
      pk.constraint_name LIKE 'PK_%'
    WHERE t.table_type = 'BASE TABLE'
      AND t.table_schema = 'dbo'
    ORDER BY t.table_name, c.ordinal_position
  `;

  const result = await client.queryArray(tablesQuery);
  const tablesMap = new Map();

  for (const row of result.rows) {
    const [tableName, columnName, dataType, maxLength, precision, scale, nullable, defaultValue, isPrimaryKey] = row;
    
    if (!tablesMap.has(tableName)) {
      tablesMap.set(tableName, {
        name: tableName,
        columns: []
      });
    }

    tablesMap.get(tableName).columns.push({
      name: columnName,
      type: dataType,
      length: maxLength,
      precision: precision,
      scale: scale,
      nullable: nullable === 'YES',
      defaultValue: defaultValue,
      isPrimaryKey: isPrimaryKey
    });
  }

  return Array.from(tablesMap.values());
}

// Descobrir relacionamentos FK
async function discoverRelationships(client: Client) {
  const relationshipsQuery = `
    SELECT 
      fk.constraint_name,
      fk.table_name as from_table,
      fk.column_name as from_column,
      pk.table_name as to_table,
      pk.column_name as to_column
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage fk ON rc.constraint_name = fk.constraint_name
    JOIN information_schema.key_column_usage pk ON rc.unique_constraint_name = pk.constraint_name
    WHERE fk.table_schema = 'dbo' AND pk.table_schema = 'dbo'
    ORDER BY fk.table_name, fk.column_name
  `;

  const result = await client.queryArray(relationshipsQuery);
  
  return result.rows.map(row => {
    const [constraintName, fromTable, fromColumn, toTable, toColumn] = row;
    return {
      constraintName,
      fromTable,
      fromColumn,
      toTable,
      toColumn
    };
  });
}

// Validar schema descoberto
function validateDiscoveredSchema(schema: any): boolean {
  if (!schema || !schema.tables || !Array.isArray(schema.tables)) {
    console.error('Schema inválido: estrutura de tabelas ausente');
    return false;
  }

  if (schema.tables.length === 0) {
    console.error('Schema inválido: nenhuma tabela descoberta');
    return false;
  }

  // Validar cada tabela
  for (const table of schema.tables) {
    if (!table.name || !table.columns || !Array.isArray(table.columns)) {
      console.error(`Tabela inválida: ${table.name || 'sem nome'}`);
      return false;
    }

    if (table.columns.length === 0) {
      console.error(`Tabela sem colunas: ${table.name}`);
      return false;
    }

    // Validar cada coluna
    for (const column of table.columns) {
      if (!column.name || !column.type) {
        console.error(`Coluna inválida na tabela ${table.name}: ${JSON.stringify(column)}`);
        return false;
      }
    }
  }

  console.log('Schema validado com sucesso');
  return true;
}

async function mapLegacyTables(supabaseClient: any) {
  // Mapeamento das tabelas legadas para estrutura Supabase
  const tableMapping = {
    produtos: {
      legacyTable: 'produtos',
      supabaseTable: 'produtos_legado',
      columnMapping: {
        'cod_produto': 'produto_id_legado',
        'nome_produto': 'nome',
        'categoria_id': 'categoria',
        'unidade_medida': 'unidade',
        'preco_custo': 'preco_unitario',
        'peso_kg': 'peso_unitario',
        'ativo': 'disponivel'
      }
    },
    receitas: {
      legacyTable: 'receitas',
      supabaseTable: 'receitas_legado',
      columnMapping: {
        'id_receita': 'receita_id_legado',
        'nome_receita': 'nome_receita',
        'tipo_receita': 'categoria_receita',
        'rendimento': 'porcoes',
        'tempo_preparo_min': 'tempo_preparo',
        'instrucoes': 'modo_preparo',
        'custo_estimado': 'custo_total'
      }
    },
    clientes: {
      legacyTable: 'clientes_corporativos',
      supabaseTable: 'contratos_corporativos',
      columnMapping: {
        'id_cliente': 'cliente_id_legado',
        'razao_social': 'nome_empresa',
        'num_funcionarios': 'total_funcionarios',
        'orcamento_mensal': 'custo_maximo_refeicao',
        'restricoes_json': 'restricoes_alimentares',
        'status_contrato': 'ativo'
      }
    }
  };

  // Salvar mapeamento
  const { error } = await supabaseClient
    .from('sync_logs')
    .insert({
      tabela_destino: 'table_mapping',
      operacao: 'map',
      status: 'concluido',
      detalhes: tableMapping
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      mapping: tableMapping,
      message: 'Mapeamento de tabelas criado com sucesso'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function adaptProductCodes(supabaseClient: any) {
  // Adaptação de códigos de produtos específicos do sistema legado
  const codeAdaptation = {
    productCodeFormat: {
      pattern: /^[A-Z]{2,3}\d{3,5}$/,
      examples: ['FRA001', 'VEG025', 'CAR100'],
      description: 'Formato: 2-3 letras + 3-5 números'
    },
    categoryMapping: {
      'FRA': { name: 'Proteína Animal - Frango', group: 'Proteína' },
      'CAR': { name: 'Proteína Animal - Carne', group: 'Proteína' },
      'PEI': { name: 'Proteína Animal - Peixe', group: 'Proteína' },
      'VEG': { name: 'Vegetais e Verduras', group: 'Vegetal' },
      'ARR': { name: 'Carboidratos - Arroz', group: 'Carboidrato' },
      'MAS': { name: 'Carboidratos - Massas', group: 'Carboidrato' },
      'LEG': { name: 'Leguminosas', group: 'Proteína Vegetal' },
      'LAT': { name: 'Laticínios', group: 'Proteína' },
      'TEM': { name: 'Temperos e Condimentos', group: 'Tempero' },
      'OLE': { name: 'Óleos e Gorduras', group: 'Gordura' }
    },
    unitMapping: {
      'KG': 'kg',
      'G': 'g',
      'L': 'l',
      'ML': 'ml',
      'UN': 'unidade',
      'PCT': 'pacote',
      'CX': 'caixa'
    },
    priceCalculation: {
      defaultMargin: 0.15, // 15% de margem
      bulkDiscounts: {
        'minQuantity': 10,
        'discountPercent': 0.05
      }
    }
  };

  // Salvar adaptação de códigos
  const { error } = await supabaseClient
    .from('sync_logs')
    .insert({
      tabela_destino: 'code_adaptation',
      operacao: 'adapt',
      status: 'concluido',
      detalhes: codeAdaptation
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      adaptation: codeAdaptation,
      message: 'Adaptação de códigos configurada com sucesso'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
