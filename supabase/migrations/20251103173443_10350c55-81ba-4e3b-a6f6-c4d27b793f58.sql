-- Habilitar extensões necessárias para automação
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Agendar sincronização automática diária (segunda a sexta, 7h)
SELECT cron.schedule(
  'daily-n8n-sync',
  '0 7 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://wzbhhioegxdpegirglbq.supabase.co/functions/v1/trigger-n8n-automation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YmhoaW9lZ3hkcGVnaXJnbGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDA0MDUsImV4cCI6MjA2ODA3NjQwNX0.ufwv_XD8LZ2SGMPYUy7Z-CkK2GRNx8mailJb6ZRZHXQ"}'::jsonb,
    body := '{"trigger_source": "cron_daily", "views": ["all"]}'::jsonb
  ) AS request_id;
  $$
);

-- Registrar configuração do cron
INSERT INTO sync_logs (
  tabela_destino,
  operacao,
  status,
  detalhes
) VALUES (
  'automation_control',
  'cron_setup',
  'concluido',
  jsonb_build_object(
    'schedule', 'Segunda a Sexta às 7h',
    'cron_expression', '0 7 * * 1-5',
    'job_name', 'daily-n8n-sync',
    'trigger_source', 'cron_daily'
  )
);