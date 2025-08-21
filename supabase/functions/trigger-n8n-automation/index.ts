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
  skip_retry?: boolean
}

interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffFactor: number
  timeout: number
}

// Circuit breaker state
let circuitBreakerOpen = false
let circuitBreakerOpenUntil = 0
const CIRCUIT_BREAKER_THRESHOLD = 5 // failures
const CIRCUIT_BREAKER_TIMEOUT = 300000 // 5 minutes

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  let supabase: any

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    supabase = createClient(supabaseUrl, supabaseKey)

    const { trigger_source = 'manual', views = ['all'], timestamp, skip_retry = false }: TriggerRequest = 
      req.method === 'POST' ? await req.json() : {}

    console.log(`🚀 Iniciando trigger n8n: source=${trigger_source}, views=${JSON.stringify(views)}`)

    // Validate input
    if (!Array.isArray(views) || views.length === 0) {
      throw new Error('Views array cannot be empty')
    }

    // Check circuit breaker
    if (circuitBreakerOpen && Date.now() < circuitBreakerOpenUntil) {
      throw new Error('Circuit breaker is open - n8n temporarily unavailable')
    }

    // Get configuration from environment
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL')
    if (!n8nWebhookUrl) {
      throw new Error('N8N_WEBHOOK_URL not configured')
    }

    const retryConfig: RetryConfig = {
      maxRetries: skip_retry ? 0 : 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      timeout: parseInt(Deno.env.get('N8N_TIMEOUT') || '30000')
    }

    // Update automation control status to running
    await updateAutomationStatus(supabase, 'running', {
      trigger_source,
      views,
      timestamp: timestamp || new Date().toISOString()
    })

    // Log início da operação
    await logOperation(supabase, 'iniciado', {
      trigger_source,
      views,
      n8n_webhook_url: n8nWebhookUrl,
      timestamp: timestamp || new Date().toISOString(),
      retry_config: retryConfig
    })

    // Preparar payload para n8n
    const n8nPayload = {
      trigger_source,
      views,
      timestamp: timestamp || new Date().toISOString(),
      supabase_webhook_url: `${supabaseUrl}/functions/v1/sync-legacy-views`,
      request_id: crypto.randomUUID()
    }

    console.log('📤 Enviando payload para n8n:', JSON.stringify(n8nPayload, null, 2))

    // Execute n8n webhook with retry logic
    const result = await executeWithRetry(
      () => callN8nWebhook(n8nWebhookUrl, n8nPayload, retryConfig.timeout),
      retryConfig
    )

    // Reset circuit breaker on success
    if (circuitBreakerOpen) {
      circuitBreakerOpen = false
      circuitBreakerOpenUntil = 0
      console.log('🔄 Circuit breaker reset - n8n is healthy again')
    }

    const executionTime = Date.now() - startTime

    // Atualizar status para completed
    await updateAutomationStatus(supabase, 'completed', {
      execution_time_ms: executionTime,
      n8n_response: result
    })

    // Log sucesso
    await logOperation(supabase, 'sucesso', {
      trigger_source,
      views,
      n8n_response: result,
      execution_time_ms: executionTime,
      retry_attempts: result.retryAttempts || 0
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Automação n8n iniciada com sucesso',
        trigger_source,
        views,
        execution_time_ms: executionTime,
        n8n_response: result.data,
        retry_attempts: result.retryAttempts || 0
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

    const executionTime = Date.now() - startTime
    const errorType = classifyError(error)

    // Handle circuit breaker
    if (errorType === 'network' || errorType === 'timeout') {
      // Implement simple circuit breaker logic
      circuitBreakerOpen = true
      circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT
      console.log('🚨 Circuit breaker opened due to repeated failures')
    }

    // Update status based on error type
    const status = errorType === 'network' || errorType === 'timeout' ? 'failed_temporarily' : 'failed_permanently'
    
    if (supabase) {
      await updateAutomationStatus(supabase, status, {
        error_type: errorType,
        execution_time_ms: executionTime
      })

      await logOperation(supabase, 'erro', {
        error_message: error.message,
        error_type: errorType,
        error_stack: error.stack,
        execution_time_ms: executionTime,
        circuit_breaker_status: circuitBreakerOpen ? 'open' : 'closed'
      }, error.message)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        error_type: errorType,
        execution_time_ms: executionTime,
        circuit_breaker_open: circuitBreakerOpen
      }),
      {
        status: errorType === 'validation' ? 400 : 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )
  }
})

// Helper functions
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<{ data: T; retryAttempts: number }> {
  let lastError: Error
  let delay = config.initialDelay

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const data = await operation()
      return { data, retryAttempts: attempt }
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on validation errors or if it's the last attempt
      const errorType = classifyError(error)
      if (attempt === config.maxRetries || errorType === 'validation') {
        break
      }

      // Only retry on network/timeout errors
      if (errorType !== 'network' && errorType !== 'timeout') {
        break
      }

      console.log(`🔄 Tentativa ${attempt + 1} falhou (${errorType}), tentando novamente em ${delay}ms...`)
      await sleep(delay)
      delay = Math.min(delay * config.backoffFactor, config.maxDelay)
    }
  }

  throw lastError!
}

async function callN8nWebhook(url: string, payload: any, timeout: number): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.text()
    
    // Validate n8n response
    if (!result || result.trim() === '') {
      throw new Error('n8n returned empty response')
    }

    console.log('✅ Resposta do n8n:', result)
    return result

  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      throw new Error(`n8n webhook timeout after ${timeout}ms`)
    }
    
    throw error
  }
}

function classifyError(error: any): 'network' | 'timeout' | 'validation' | 'n8n_error' | 'unknown' {
  const message = error.message?.toLowerCase() || ''
  
  if (message.includes('timeout') || error.name === 'AbortError') {
    return 'timeout'
  }
  
  if (message.includes('failed to fetch') || message.includes('network') || message.includes('connect')) {
    return 'network'
  }
  
  if (message.includes('empty') || message.includes('cannot be empty')) {
    return 'validation'
  }
  
  if (message.includes('n8n webhook failed')) {
    return 'n8n_error'
  }
  
  return 'unknown'
}

async function updateAutomationStatus(supabase: any, status: string, details: any) {
  const { error } = await supabase
    .from('automation_control')
    .update({
      last_triggered_at: new Date().toISOString(),
      status,
      updated_at: new Date().toISOString(),
      ...details
    })
    .eq('automation_name', 'n8n_legacy_sync')

  if (error) {
    console.error('Erro ao atualizar controle de automação:', error)
  }
}

async function logOperation(supabase: any, status: string, details: any, errorMsg?: string) {
  const logEntry = {
    tabela_destino: 'trigger_n8n_automation',
    operacao: 'trigger',
    status,
    detalhes: details
  }

  if (errorMsg) {
    logEntry.erro_msg = errorMsg
  }

  const { error } = await supabase
    .from('sync_logs')
    .insert(logEntry)

  if (error) {
    console.error('Erro ao registrar log:', error)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}