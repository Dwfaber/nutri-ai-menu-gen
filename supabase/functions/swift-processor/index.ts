import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditEvent {
  event_type: string;
  entity_type: string;
  entity_id?: string;
  user_id?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  severity?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  module?: string;
  action: string;
  status?: 'success' | 'error' | 'pending';
  error_message?: string;
  execution_time_ms?: number;
}

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration_ms: number;
  status_code: number;
  memory_usage?: number;
}

interface SecurityAlert {
  type: 'suspicious_activity' | 'unauthorized_access' | 'data_breach' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  user_id?: string;
  ip_address?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const start_time = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    console.log(`📋 Swift-Processor: ${req.method} ${path}`);

    switch (path) {
      case 'health':
        return handleHealth();
      
      case 'audit':
        return await handleAuditLog(req);
      
      case 'performance':
        return await handlePerformanceLog(req);
      
      case 'security':
        return await handleSecurityAlert(req);
      
      case 'reports':
        return await handleReports(req);
      
      case 'analyze':
        return await handleAnalyze(req);
      
      default:
        return await handleAuditLog(req);
    }

  } catch (error) {
    console.error('❌ Swift-Processor Error:', error);
    
    // Log the error as audit event
    await logAuditEvent({
      event_type: 'system_error',
      entity_type: 'swift_processor',
      action: `error_${req.method.toLowerCase()}`,
      severity: 'error',
      status: 'error',
      error_message: error.message,
      execution_time_ms: Date.now() - start_time,
      metadata: {
        path,
        method: req.method,
        url: req.url
      }
    });

    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function handleHealth() {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'swift-processor',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Date.now()
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleAuditLog(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const auditData: AuditEvent = await req.json();
  const result = await logAuditEvent(auditData);
  
  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handlePerformanceLog(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const perfData: PerformanceMetrics = await req.json();
  
  const auditEvent: AuditEvent = {
    event_type: 'performance_metric',
    entity_type: 'endpoint',
    entity_id: perfData.endpoint,
    action: 'performance_log',
    severity: perfData.duration_ms > 5000 ? 'warn' : 'info',
    status: perfData.status_code < 400 ? 'success' : 'error',
    execution_time_ms: perfData.duration_ms,
    metadata: {
      method: perfData.method,
      status_code: perfData.status_code,
      memory_usage: perfData.memory_usage
    }
  };

  const result = await logAuditEvent(auditEvent);
  
  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleSecurityAlert(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const alertData: SecurityAlert = await req.json();
  
  const auditEvent: AuditEvent = {
    event_type: 'security_alert',
    entity_type: 'security',
    entity_id: `${alertData.type}_${Date.now()}`,
    user_id: alertData.user_id,
    ip_address: alertData.ip_address,
    action: alertData.type,
    severity: alertData.severity === 'critical' ? 'critical' : 'warn',
    status: 'success',
    metadata: {
      alert_type: alertData.type,
      alert_severity: alertData.severity,
      details: alertData.details
    }
  };

  const result = await logAuditEvent(auditEvent);
  
  // For critical alerts, also log to access_logs
  if (alertData.severity === 'critical') {
    await supabase.from('access_logs').insert({
      user_id: alertData.user_id,
      table_name: 'security_alert',
      operation: alertData.type,
      ip_address: alertData.ip_address,
      user_agent: alertData.details.user_agent || 'unknown'
    });
  }
  
  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleReports(req: Request) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const report_type = url.searchParams.get('type') || 'summary';
  const days = parseInt(url.searchParams.get('days') || '7');
  const limit = parseInt(url.searchParams.get('limit') || '100');

  try {
    let data;
    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

    switch (report_type) {
      case 'errors':
        const { data: errorData } = await supabase
          .from('audit_events')
          .select('*')
          .eq('severity', 'error')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(limit);
        data = errorData;
        break;

      case 'performance':
        const { data: perfData } = await supabase
          .from('audit_events')
          .select('*')
          .eq('event_type', 'performance_metric')
          .gte('created_at', since)
          .order('execution_time_ms', { ascending: false })
          .limit(limit);
        data = perfData;
        break;

      case 'security':
        const { data: secData } = await supabase
          .from('audit_events')
          .select('*')
          .eq('event_type', 'security_alert')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(limit);
        data = secData;
        break;

      default:
        const { data: summaryData } = await supabase
          .from('audit_events')
          .select('event_type, severity, count(*)')
          .gte('created_at', since)
          .order('count', { ascending: false });
        data = summaryData;
    }

    return new Response(
      JSON.stringify({
        report_type,
        period_days: days,
        data,
        generated_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Report generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleAnalyze(req: Request) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const analysis_type = url.searchParams.get('type') || 'patterns';
  const days = parseInt(url.searchParams.get('days') || '7');

  try {
    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
    
    // Análise de padrões básicos
    const { data: events } = await supabase
      .from('audit_events')
      .select('*')
      .gte('created_at', since);

    if (!events) {
      return new Response(
        JSON.stringify({ error: 'No data available for analysis' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysis = {
      total_events: events.length,
      error_rate: events.filter(e => e.status === 'error').length / events.length,
      avg_execution_time: events
        .filter(e => e.execution_time_ms)
        .reduce((sum, e) => sum + (e.execution_time_ms || 0), 0) / events.length,
      top_errors: getTopErrors(events),
      security_incidents: events.filter(e => e.event_type === 'security_alert').length,
      user_activity: getUserActivity(events),
      performance_insights: getPerformanceInsights(events)
    };

    return new Response(
      JSON.stringify({
        analysis_type,
        period_days: days,
        analysis,
        generated_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Analysis error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to perform analysis' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function logAuditEvent(event: AuditEvent) {
  try {
    const { data, error } = await supabase
      .from('audit_events')
      .insert({
        event_type: event.event_type,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        user_id: event.user_id,
        session_id: event.session_id,
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        metadata: event.metadata || {},
        severity: event.severity || 'info',
        module: event.module,
        action: event.action,
        status: event.status || 'success',
        error_message: event.error_message,
        execution_time_ms: event.execution_time_ms
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Audit logging error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Audit logged: ${event.event_type}/${event.action}`);
    return { success: true, data };

  } catch (error) {
    console.error('❌ Audit logging exception:', error);
    return { success: false, error: error.message };
  }
}

function getTopErrors(events: any[]) {
  const errorEvents = events.filter(e => e.status === 'error');
  const errorCounts: Record<string, number> = {};
  
  errorEvents.forEach(e => {
    const key = e.error_message || e.action;
    errorCounts[key] = (errorCounts[key] || 0) + 1;
  });

  return Object.entries(errorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([error, count]) => ({ error, count }));
}

function getUserActivity(events: any[]) {
  const userCounts: Record<string, number> = {};
  
  events.forEach(e => {
    if (e.user_id) {
      userCounts[e.user_id] = (userCounts[e.user_id] || 0) + 1;
    }
  });

  return {
    total_users: Object.keys(userCounts).length,
    top_users: Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([user_id, count]) => ({ user_id, count }))
  };
}

function getPerformanceInsights(events: any[]) {
  const perfEvents = events.filter(e => e.execution_time_ms);
  
  if (perfEvents.length === 0) return { message: 'No performance data available' };

  const executionTimes = perfEvents.map(e => e.execution_time_ms);
  const sorted = executionTimes.sort((a, b) => a - b);
  
  return {
    count: perfEvents.length,
    avg_time: executionTimes.reduce((sum, time) => sum + time, 0) / perfEvents.length,
    median_time: sorted[Math.floor(sorted.length / 2)],
    p95_time: sorted[Math.floor(sorted.length * 0.95)],
    slowest_operations: perfEvents
      .sort((a, b) => b.execution_time_ms - a.execution_time_ms)
      .slice(0, 5)
      .map(e => ({ action: e.action, time_ms: e.execution_time_ms }))
  };
}