
-- Habilitar extensões necessárias para o sistema de agendamento
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar tabela para controle de automações
CREATE TABLE IF NOT EXISTS public.automation_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_name TEXT NOT NULL UNIQUE,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  next_scheduled_at TIMESTAMP WITH TIME ZONE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_source TEXT, -- 'manual' ou 'scheduled'
  status TEXT DEFAULT 'idle', -- 'idle', 'running', 'completed', 'error'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir configuração para automação n8n
INSERT INTO public.automation_control (automation_name, is_enabled, status) 
VALUES ('n8n_legacy_sync', true, 'idle')
ON CONFLICT (automation_name) DO NOTHING;

-- Criar job cron para executar Segunda a Sexta às 20:00 (horário de Brasília = 23:00 UTC)
SELECT cron.schedule(
  'n8n-legacy-sync-daily',
  '0 23 * * 1-5', -- Segunda a Sexta às 23:00 UTC (20:00 Brasília)
  $$
  SELECT
    net.http_post(
        url:='https://wzbhhioegxdpegirglbq.supabase.co/functions/v1/trigger-n8n-automation',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YmhoaW9lZ3hkcGVnaXJnbGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDA0MDUsImV4cCI6MjA2ODA3NjQwNX0.ufwv_XD8LZ2SGMPYUy7Z-CkK2GRNx8mailJb6ZRZHXQ"}'::jsonb,
        body:='{"trigger_source": "scheduled", "views": ["all"], "timestamp": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);
