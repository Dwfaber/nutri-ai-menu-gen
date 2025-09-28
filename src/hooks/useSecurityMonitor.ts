import { useCallback, useEffect } from 'react';
import { useAuditLog } from './useAuditLog';

interface SecurityMonitorConfig {
  trackFailedLogins?: boolean;
  trackSuspiciousActivity?: boolean;
  trackDataAccess?: boolean;
  trackPermissionChanges?: boolean;
}

interface UseSecurityMonitorReturn {
  reportSuspiciousActivity: (activity: string, details?: Record<string, any>) => Promise<void>;
  reportUnauthorizedAccess: (resource: string, details?: Record<string, any>) => Promise<void>;
  reportDataBreach: (details: Record<string, any>) => Promise<void>;
  reportAnomalousPattern: (pattern: string, details?: Record<string, any>) => Promise<void>;
}

export function useSecurityMonitor(config: SecurityMonitorConfig = {}): UseSecurityMonitorReturn {
  const { logSecurityEvent } = useAuditLog();

  // Monitor for suspicious patterns
  useEffect(() => {
    if (!config.trackSuspiciousActivity) return;

    const monitorConsoleErrors = () => {
      const originalError = console.error;
      console.error = (...args) => {
        originalError(...args);
        
        // Check for security-related errors
        const message = args.join(' ').toLowerCase();
        if (message.includes('unauthorized') || 
            message.includes('forbidden') || 
            message.includes('access denied') ||
            message.includes('security')) {
          logSecurityEvent('console_security_error', 'medium', {
            error_message: args.join(' '),
            timestamp: new Date().toISOString()
          });
        }
      };

      return () => {
        console.error = originalError;
      };
    };

    const cleanup = monitorConsoleErrors();
    return cleanup;
  }, [config.trackSuspiciousActivity, logSecurityEvent]);

  // Monitor for failed authentication attempts
  useEffect(() => {
    if (!config.trackFailedLogins) return;

    let failedLoginCount = 0;
    const resetTime = 5 * 60 * 1000; // 5 minutes

    const monitorFailedLogins = () => {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'auth_error' && e.newValue) {
          failedLoginCount++;
          
          if (failedLoginCount >= 3) {
            logSecurityEvent('multiple_failed_logins', 'high', {
              attempts: failedLoginCount,
              timestamp: new Date().toISOString()
            });
          }
          
          setTimeout(() => {
            failedLoginCount = Math.max(0, failedLoginCount - 1);
          }, resetTime);
        }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    };

    const cleanup = monitorFailedLogins();
    return cleanup;
  }, [config.trackFailedLogins, logSecurityEvent]);

  const reportSuspiciousActivity = useCallback(async (activity: string, details?: Record<string, any>) => {
    await logSecurityEvent('suspicious_activity', 'medium', {
      activity,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...details
    });
  }, [logSecurityEvent]);

  const reportUnauthorizedAccess = useCallback(async (resource: string, details?: Record<string, any>) => {
    await logSecurityEvent('unauthorized_access', 'high', {
      resource,
      user_agent: navigator.userAgent,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      ...details
    });
  }, [logSecurityEvent]);

  const reportDataBreach = useCallback(async (details: Record<string, any>) => {
    await logSecurityEvent('data_breach', 'critical', {
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...details
    });
  }, [logSecurityEvent]);

  const reportAnomalousPattern = useCallback(async (pattern: string, details?: Record<string, any>) => {
    await logSecurityEvent('anomalous_pattern', 'medium', {
      pattern,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...details
    });
  }, [logSecurityEvent]);

  return {
    reportSuspiciousActivity,
    reportUnauthorizedAccess,
    reportDataBreach,
    reportAnomalousPattern
  };
}