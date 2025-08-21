/**
 * GPT Assistant - Versão Simplificada e Otimizada
 * Migração completa para GPT-4o com foco em geração de receitas
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { generateRecipesOnly } from './simplified.ts';

// Função para converter payload antigo para o novo formato
async function convertLegacyPayload(requestData: RequestData): Promise<any> {
  // Se já tem client_data, usar diretamente
  if (requestData.client_data && requestData.client_data.nome) {
    return {
      client_data: requestData.client_data,
      meal_quantity: requestData.meal_quantity || requestData.refeicoesPorDia || 50,
      simple_mode: true
    };
  }

  // Se tem filialIdLegado, buscar dados do cliente
  if (requestData.filialIdLegado) {
    console.log('🔄 Convertendo payload antigo para novo formato...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados do cliente pela filial
    const { data: clientData, error } = await supabase
      .from('custos_filiais')
      .select('*')
      .eq('filial_id', requestData.filialIdLegado)
      .single();

    if (error || !clientData) {
      console.error('❌ Erro ao buscar dados do cliente:', error);
      // Usar dados padrão se não encontrar
      return {
        client_data: {
          nome: `Cliente Filial ${requestData.filialIdLegado}`,
          custo_maximo_refeicao: 8.50,
          restricoes_alimentares: [],
          preferencias_alimentares: []
        },
        meal_quantity: requestData.refeicoesPorDia || 50,
        simple_mode: true
      };
    }

    // Mapear dados do cliente para o formato novo
    const mappedClientData = {
      nome: clientData.nome_fantasia || clientData.razao_social || `Cliente ${requestData.filialIdLegado}`,
      custo_maximo_refeicao: clientData.custo_medio_semanal ? 
        (clientData.custo_medio_semanal / 7).toFixed(2) : 
        clientData.RefCustoSegunda || 8.50,
      restricoes_alimentares: [],
      preferencias_alimentares: []
    };

    console.log('✅ Cliente mapeado:', mappedClientData);

    return {
      client_data: mappedClientData,
      meal_quantity: requestData.refeicoesPorDia || 50,
      simple_mode: true
    };
  }

  // Fallback para dados mínimos
  console.log('⚠️ Usando dados padrão - payload não reconhecido');
  return {
    client_data: {
      nome: 'Cliente Padrão',
      custo_maximo_refeicao: 8.50,
      restricoes_alimentares: [],
      preferencias_alimentares: []
    },
    meal_quantity: requestData.meal_quantity || 50,
    simple_mode: true
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestData {
  action?: string;
  filialIdLegado?: number;
  numDays?: number;
  refeicoesPorDia?: number;
  client_data?: any;
  meal_quantity?: number;
  simple_mode?: boolean;
  baseRecipes?: any;
  useDiaEspecial?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'healthy', 
        version: '2.0-simplified',
        model: 'gpt-4o',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }

  try {
    const requestData: RequestData = await req.json();
    console.log('📝 Request recebido:', { action: requestData.action, payload: requestData });

    // Converter payload antigo para o formato novo se necessário
    const processedData = await convertLegacyPayload(requestData);
    
    // Todas as requisições agora usam o modo simplificado com GPT-4o
    const result = await generateRecipesOnly(processedData);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro na função GPT Assistant:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor',
        timestamp: new Date().toISOString(),
        version: '2.0-simplified'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});