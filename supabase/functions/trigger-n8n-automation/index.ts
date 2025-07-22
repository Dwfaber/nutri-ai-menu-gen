import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TriggerRequest {
  trigger_source?: 'manual' | 'scheduled'
  views?: string[]
  timestamp?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { trigger_source = 'manual', views = ['all'], timestamp }: TriggerRequest = 
      req.method === 'POST' ? await req.json() : {}

    console.log(`🚀 Iniciando trigger n8n: source=${trigger_source}, views=${JSON.stringify(views)}`)

    // Update automation control status
    const { error: updateError } = await supabase
      .from('automation_control')
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_source,
        status: 'running',
        updated_at: new Date().toISOString()
      })
      .eq('automation_name', 'n8n_legacy_sync')

    if (updateError) {
      console.error('Erro ao atualizar controle de automação:', updateError)
    }

    // Log início da operação
    const { error: logError } = await supabase
      .from('sync_logs')
      .insert({
        tabela_destino: 'trigger_n8n_automation',
        operacao: 'trigger',
        status: 'iniciado',
        detalhes: {
          trigger_source,
          views,
          n8n_webhook_url: 'http://localhost:5678/webhook/7d565ff8-db01-45bb-adba-793e60880e7a',
          timestamp: timestamp || new Date().toISOString()
        }
      })

    if (logError) {
      console.error('Erro ao registrar log:', logError)
    }

    // Preparar payload para n8n
    const n8nPayload = {
      trigger_source,
      views,
      timestamp: timestamp || new Date().toISOString(),
      supabase_webhook_url: `${supabaseUrl}/functions/v1/sync-legacy-views`
    }

    console.log('📤 Enviando payload para n8n:', JSON.stringify(n8nPayload, null, 2))

    // Chamar webhook do n8n
    const n8nResponse = await fetch('http://localhost:5678/webhook/7d565ff8-db01-45bb-adba-793e60880e7a', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nPayload)
    })

    if (!n8nResponse.ok) {
      throw new Error(`n8n webhook falhou: ${n8nResponse.status} ${n8nResponse.statusText}`)
    }

    const n8nResult = await n8nResponse.text()
    console.log('✅ Resposta do n8n:', n8nResult)

    // Atualizar status para completed
    await supabase
      .from('automation_control')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('automation_name', 'n8n_legacy_sync')

    // Log sucesso
    await supabase
      .from('sync_logs')
      .insert({
        tabela_destino: 'trigger_n8n_automation',
        operacao: 'trigger',
        status: 'sucesso',
        detalhes: {
          trigger_source,
          views,
          n8n_response: n8nResult,
          execution_time: Date.now()
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Automação n8n iniciada com sucesso',
        trigger_source,
        views,
        n8n_response: n8nResult
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )

  } catch (error) {
    console.error('❌ Erro no trigger n8n:', error)

    // Atualizar status para error
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    await supabase
      .from('automation_control')
      .update({
        status: 'error',
        updated_at: new Date().toISOString()
      })
      .eq('automation_name', 'n8n_legacy_sync')

    await supabase
      .from('sync_logs')
      .insert({
        tabela_destino: 'trigger_n8n_automation',
        operacao: 'trigger',
        status: 'erro',
        erro_msg: error.message,
        detalhes: {
          error: error.message,
          stack: error.stack
        }
      })

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )
  }
})