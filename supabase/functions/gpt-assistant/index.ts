/**
 * GPT Assistant - Versão Simplificada e Otimizada
 * Migração completa para GPT-4o com foco em geração de receitas
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { generateRecipesOnly } from './simplified.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestData {
  action?: string;
  filialIdLegado?: number;
  client_data?: any;
  meal_quantity?: number;
  simple_mode?: boolean;
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
    console.log('📝 Request recebido:', { action: requestData.action, simple_mode: requestData.simple_mode });

    // Todas as requisições agora usam o modo simplificado com GPT-4o
    const result = await generateRecipesOnly(requestData);

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