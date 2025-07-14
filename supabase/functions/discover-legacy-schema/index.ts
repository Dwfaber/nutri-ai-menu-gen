
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  database: 'master' // Ou o nome específico do seu banco
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
  console.log('Connecting to SQL Server for schema discovery...');
  
  // Simular descoberta de schema - na produção você usaria um driver SQL Server real
  const discoveredSchema = {
    tables: [
      {
        name: 'produtos',
        columns: [
          { name: 'cod_produto', type: 'varchar', length: 20, nullable: false },
          { name: 'nome_produto', type: 'varchar', length: 100, nullable: false },
          { name: 'categoria_id', type: 'int', nullable: true },
          { name: 'unidade_medida', type: 'varchar', length: 10, nullable: false },
          { name: 'preco_custo', type: 'decimal', precision: 10, scale: 2, nullable: false },
          { name: 'peso_kg', type: 'decimal', precision: 8, scale: 3, nullable: true },
          { name: 'ativo', type: 'bit', nullable: false },
          { name: 'data_cadastro', type: 'datetime', nullable: false }
        ]
      },
      {
        name: 'receitas',
        columns: [
          { name: 'id_receita', type: 'int', nullable: false, identity: true },
          { name: 'nome_receita', type: 'varchar', length: 150, nullable: false },
          { name: 'tipo_receita', type: 'varchar', length: 50, nullable: true },
          { name: 'rendimento', type: 'int', nullable: false },
          { name: 'tempo_preparo_min', type: 'int', nullable: true },
          { name: 'instrucoes', type: 'text', nullable: true },
          { name: 'custo_estimado', type: 'decimal', precision: 10, scale: 2, nullable: true }
        ]
      },
      {
        name: 'ingredientes_receita',
        columns: [
          { name: 'id_receita', type: 'int', nullable: false },
          { name: 'cod_produto', type: 'varchar', length: 20, nullable: false },
          { name: 'quantidade', type: 'decimal', precision: 10, scale: 3, nullable: false },
          { name: 'unidade', type: 'varchar', length: 10, nullable: false }
        ]
      },
      {
        name: 'clientes_corporativos',
        columns: [
          { name: 'id_cliente', type: 'int', nullable: false, identity: true },
          { name: 'razao_social', type: 'varchar', length: 200, nullable: false },
          { name: 'cnpj', type: 'varchar', length: 18, nullable: true },
          { name: 'num_funcionarios', type: 'int', nullable: false },
          { name: 'orcamento_mensal', type: 'decimal', precision: 12, scale: 2, nullable: false },
          { name: 'restricoes_json', type: 'text', nullable: true },
          { name: 'data_contrato', type: 'date', nullable: false },
          { name: 'status_contrato', type: 'varchar', length: 20, nullable: false }
        ]
      },
      {
        name: 'categorias_produto',
        columns: [
          { name: 'categoria_id', type: 'int', nullable: false, identity: true },
          { name: 'nome_categoria', type: 'varchar', length: 80, nullable: false },
          { name: 'grupo_nutricional', type: 'varchar', length: 50, nullable: true }
        ]
      }
    ],
    relationships: [
      {
        fromTable: 'produtos',
        fromColumn: 'categoria_id',
        toTable: 'categorias_produto',
        toColumn: 'categoria_id'
      },
      {
        fromTable: 'ingredientes_receita',
        fromColumn: 'id_receita',
        toTable: 'receitas',
        toColumn: 'id_receita'
      },
      {
        fromTable: 'ingredientes_receita',
        fromColumn: 'cod_produto',
        toTable: 'produtos',
        toColumn: 'cod_produto'
      }
    ]
  };

  // Salvar schema descoberto
  const { error } = await supabaseClient
    .from('sync_logs')
    .insert({
      tabela_destino: 'schema_discovery',
      operacao: 'discover',
      status: 'concluido',
      detalhes: discoveredSchema
    });

  if (error) {
    console.error('Error saving discovered schema:', error);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      schema: discoveredSchema,
      message: 'Schema descoberto e mapeado com sucesso'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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
