import { useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';

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

interface UseAuditLogReturn {
  logEvent: (event: Omit<AuditEvent, 'user_id' | 'session_id' | 'ip_address' | 'user_agent'>) => Promise<void>;
  logError: (error: Error, context?: Record<string, any>) => Promise<void>;
  logUserAction: (action: string, entity_type: string, entity_id?: string, metadata?: Record<string, any>) => Promise<void>;
  logPerformance: (action: string, duration_ms: number, metadata?: Record<string, any>) => Promise<void>;
  logSecurityEvent: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>) => Promise<void>;
}

export function useAuditLog(): UseAuditLogReturn {
  const enrichEvent = useCallback(async (event: Omit<AuditEvent, 'user_id' | 'session_id' | 'ip_address' | 'user_agent'>): Promise<AuditEvent> => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get browser info
    const userAgent = navigator.userAgent;
    
    // Try to get IP (this won't work in browser context, but keeping for completeness)
    let ip_address;
    try {
      // Note: This won't work due to CORS, but the edge function can extract it from headers
      ip_address = undefined;
    } catch {
      ip_address = undefined;
    }

    return {
      ...event,
      user_id: user?.id,
      session_id: user?.id ? `session_${user.id}_${Date.now()}` : undefined,
      ip_address,
      user_agent: userAgent,
    };
  }, []);

  const logEvent = useCallback(async (event: Omit<AuditEvent, 'user_id' | 'session_id' | 'ip_address' | 'user_agent'>) => {
    try {
      const enrichedEvent = await enrichEvent(event);
      
      const { error } = await supabase.functions.invoke('swift-processor', {
        body: enrichedEvent
      });

      if (error) {
        console.error('❌ Audit logging failed:', error);
      }
    } catch (error) {
      console.error('❌ Audit logging exception:', error);
    }
  }, [enrichEvent]);

  const logError = useCallback(async (error: Error, context?: Record<string, any>) => {
    await logEvent({
      event_type: 'application_error',
      entity_type: 'error',
      action: 'error_occurred',
      severity: 'error',
      status: 'error',
      error_message: error.message,
      metadata: {
        stack: error.stack,
        name: error.name,
        ...context
      }
    });
  }, [logEvent]);

  const logUserAction = useCallback(async (action: string, entity_type: string, entity_id?: string, metadata?: Record<string, any>) => {
    await logEvent({
      event_type: 'user_action',
      entity_type,
      entity_id,
      action,
      severity: 'info',
      status: 'success',
      metadata
    });
  }, [logEvent]);

  const logPerformance = useCallback(async (action: string, duration_ms: number, metadata?: Record<string, any>) => {
    await logEvent({
      event_type: 'performance_metric',
      entity_type: 'operation',
      action,
      severity: duration_ms > 5000 ? 'warn' : 'info',
      status: 'success',
      execution_time_ms: duration_ms,
      metadata
    });
  }, [logEvent]);

  const logSecurityEvent = useCallback(async (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>) => {
    const auditSeverity: AuditEvent['severity'] = severity === 'critical' ? 'critical' : 
                                                   severity === 'high' ? 'error' : 
                                                   severity === 'medium' ? 'warn' : 'info';

    await logEvent({
      event_type: 'security_alert',
      entity_type: 'security',
      action: event,
      severity: auditSeverity,
      status: 'success',
      metadata: {
        security_level: severity,
        ...details
      }
    });
  }, [logEvent]);

  return {
    logEvent,
    logError,
    logUserAction,
    logPerformance,
    logSecurityEvent
  };
}
