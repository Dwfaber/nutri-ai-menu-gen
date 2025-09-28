-- Create audit_events table for comprehensive audit logging
CREATE TABLE public.audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  user_id UUID,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'info',
  module TEXT,
  action TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Create policies for audit_events
CREATE POLICY "Admins can view all audit events" 
ON public.audit_events 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir eventos de auditoria" 
ON public.audit_events 
FOR INSERT 
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_audit_events_created_at ON public.audit_events(created_at DESC);
CREATE INDEX idx_audit_events_user_id ON public.audit_events(user_id);
CREATE INDEX idx_audit_events_event_type ON public.audit_events(event_type);
CREATE INDEX idx_audit_events_entity ON public.audit_events(entity_type, entity_id);