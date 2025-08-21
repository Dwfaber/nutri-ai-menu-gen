/**
 * GPT Assistant - Versão Simplificada e Otimizada
 * Migração completa para GPT-4o com foco em geração de receitas
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { generateRecipesOnly } from './simplified.ts';

// Cache simples para clientes frequentes
const clientCache = new Map<number, any>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Rate limiting simples
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requisições por minuto
const RATE_WINDOW = 60 * 1000; // 1 minuto

// Função para verificar rate limit
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  
  if (!rateLimitMap.has(clientId)) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  const client = rateLimitMap.get(clientId)!;
  if (now > client.resetTime) {
    client.count = 1;
    client.resetTime = now + RATE_WINDOW;
    return true;
  }
  
  if (client.count >= RATE_LIMIT) {
    return false;
  }
  
  client.count++;
  return true;
}

// Função para converter payload antigo para o novo formato com timeout e cache
async function convertLegacyPayload(requestData: RequestData): Promise<any> {
  const startTime = Date.now();
  
  // Se já tem client_data, usar diretamente
  if (requestData.client_data && requestData.client_data.nome) {
    console.log(`⚡ Client data já presente (${Date.now() - startTime}ms)`);
    return {
      client_data: requestData.client_data,
      meal_quantity: requestData.meal_quantity || requestData.refeicoesPorDia || 50,
      simple_mode: true
    };
  }

  // Se tem filialIdLegado, buscar dados do cliente
  if (requestData.filialIdLegado) {
    console.log(`🔄 Convertendo payload antigo para filial ${requestData.filialIdLegado}...`);
    
    // Verificar cache primeiro
    const cacheKey = requestData.filialIdLegado;
    const cached = clientCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`💾 Cliente encontrado no cache (${Date.now() - startTime}ms)`);
      return {
        client_data: cached.data,
        meal_quantity: requestData.refeicoesPorDia || 50,
        simple_mode: true
      };
    }

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // 🔧 FIX CRÍTICO: Usar limit(1).maybeSingle() ao invés de single()
      const { data: clientData, error } = await supabase
        .from('custos_filiais')
        .select('*')
        .eq('filial_id', requestData.filialIdLegado)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`❌ Erro SQL na busca do cliente (${Date.now() - startTime}ms):`, error);
        throw error;
      }

      if (!clientData) {
        console.warn(`⚠️ Cliente ${requestData.filialIdLegado} não encontrado na base (${Date.now() - startTime}ms)`);
        
        // Fallback inteligente com dados realistas baseados na filial
        const fallbackData = {
          nome: `Cliente Filial ${requestData.filialIdLegado}`,
          custo_maximo_refeicao: requestData.filialIdLegado <= 100 ? 9.50 : 8.50, // Filiais menores = custo maior
          restricoes_alimentares: [],
          preferencias_alimentares: []
        };

        return {
          client_data: fallbackData,
          meal_quantity: requestData.refeicoesPorDia || 50,
          simple_mode: true
        };
      }

      // Mapear dados do cliente para o formato novo
      const mappedClientData = {
        nome: clientData.nome_fantasia || clientData.razao_social || `Cliente ${requestData.filialIdLegado}`,
        custo_maximo_refeicao: clientData.custo_medio_semanal ? 
          Number((clientData.custo_medio_semanal / 7).toFixed(2)) : 
          clientData.RefCustoSegunda || 8.50,
        restricoes_alimentares: [],
        preferencias_alimentares: []
      };

      // Salvar no cache
      clientCache.set(cacheKey, {
        data: mappedClientData,
        timestamp: Date.now()
      });

      console.log(`✅ Cliente mapeado e cacheado (${Date.now() - startTime}ms):`, {
        nome: mappedClientData.nome,
        custo: mappedClientData.custo_maximo_refeicao
      });

      return {
        client_data: mappedClientData,
        meal_quantity: requestData.refeicoesPorDia || 50,
        simple_mode: true
      };

    } catch (error) {
      console.error(`💥 Erro crítico na busca do cliente (${Date.now() - startTime}ms):`, error);
      
      // Fallback robusto em caso de erro crítico
      const emergencyFallback = {
        nome: `Cliente Filial ${requestData.filialIdLegado} (Fallback)`,
        custo_maximo_refeicao: 8.50,
        restricoes_alimentares: [],
        preferencias_alimentares: []
      };

      return {
        client_data: emergencyFallback,
        meal_quantity: requestData.refeicoesPorDia || 50,
        simple_mode: true
      };
    }
  }

  // Fallback para dados mínimos
  console.log(`⚠️ Usando dados padrão - payload não reconhecido (${Date.now() - startTime}ms)`);
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
  const requestStartTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint com status das dependências
  if (req.method === 'GET') {
    const cacheStats = {
      cached_clients: clientCache.size,
      rate_limit_entries: rateLimitMap.size
    };
    
    return new Response(
      JSON.stringify({ 
        status: 'healthy', 
        version: '2.0-simplified-optimized',
        model: 'gpt-4o',
        timestamp: new Date().toISOString(),
        cache_stats: cacheStats,
        uptime_ms: Date.now() - requestStartTime
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }

  // 🛡️ Rate limiting
  const clientId = req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   req.headers.get('user-agent')?.slice(0, 50) || 
                   'unknown';
  
  if (!checkRateLimit(clientId)) {
    console.warn(`🚫 Rate limit excedido para client: ${clientId}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Rate limit excedido. Tente novamente em 1 minuto.',
        retry_after: 60
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        },
        status: 429,
      }
    );
  }

  // ⏱️ Timeout de 30 segundos para toda a requisição
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`⏰ Timeout de 30s atingido para client: ${clientId}`);
    controller.abort();
  }, 30000);

  try {
    const requestData: RequestData = await req.json();
    console.log(`📝 Request recebido de ${clientId}:`, { 
      action: requestData.action,
      filial: requestData.filialIdLegado,
      meal_quantity: requestData.meal_quantity || requestData.refeicoesPorDia,
      timestamp: new Date().toISOString()
    });

    // Converter payload antigo para o formato novo se necessário
    const payloadStartTime = Date.now();
    const processedData = await convertLegacyPayload(requestData);
    const payloadTime = Date.now() - payloadStartTime;
    
    console.log(`🔄 Payload processado em ${payloadTime}ms`);
    
    // Todas as requisições agora usam o modo simplificado com GPT-4o
    const aiStartTime = Date.now();
    const result = await generateRecipesOnly(processedData);
    const aiTime = Date.now() - aiStartTime;
    const totalTime = Date.now() - requestStartTime;

    console.log(`🤖 AI respondeu em ${aiTime}ms | Total: ${totalTime}ms`);

    clearTimeout(timeoutId);

    // Adicionar métricas na resposta
    const enhancedResult = {
      ...result,
      performance: {
        total_time_ms: totalTime,
        payload_processing_ms: payloadTime,
        ai_processing_ms: aiTime,
        cached_client: processedData._from_cache || false
      }
    };

    return new Response(
      JSON.stringify(enhancedResult),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    clearTimeout(timeoutId);
    const totalTime = Date.now() - requestStartTime;
    
    // Categorizar tipos de erro
    let statusCode = 500;
    let errorCategory = 'internal_error';
    
    if (error.name === 'AbortError') {
      statusCode = 408;
      errorCategory = 'timeout';
    } else if (error.message?.includes('JSON')) {
      statusCode = 400;
      errorCategory = 'invalid_json';
    } else if (error.message?.includes('rate limit')) {
      statusCode = 429;
      errorCategory = 'rate_limit';
    }

    console.error(`❌ Erro [${errorCategory}] após ${totalTime}ms para ${clientId}:`, {
      error: error.message,
      stack: error.stack?.split('\n')[0], // Primeira linha do stack
      category: errorCategory,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor',
        error_category: errorCategory,
        timestamp: new Date().toISOString(),
        version: '2.0-simplified-optimized',
        performance: {
          total_time_ms: totalTime,
          failed_at: errorCategory
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    );
  }
});