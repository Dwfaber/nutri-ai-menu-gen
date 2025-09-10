-- Relaxar validação da trigger validate_financial_data para permitir filial_id NULL
-- TEMPORÁRIO: Para resolver problemas de sincronização com dados legados

CREATE OR REPLACE FUNCTION public.validate_financial_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validar valores financeiros não negativos
  IF NEW.custo_total < 0 THEN
    RAISE EXCEPTION 'Custo total não pode ser negativo: %', NEW.custo_total;
  END IF;
  
  -- TEMPORÁRIO: Validação de filial_id relaxada para permitir sincronização
  -- TODO: Reativar validação após correção dos dados de origem
  -- Comentado temporariamente para permitir dados incompletos do sistema legado
  -- IF NEW.filial_id IS NULL THEN
  --   RAISE EXCEPTION 'ID da filial é obrigatório';
  -- END IF;
  
  RETURN NEW;
END;
$function$;

-- Log da modificação para auditoria
INSERT INTO sync_logs (
  tabela_destino,
  operacao,
  status,
  detalhes
) VALUES (
  'validate_financial_data',
  'relaxar_validacao',
  'concluido',
  jsonb_build_object(
    'motivo', 'Permitir sincronização com dados legados incompletos',
    'validacao_removida', 'filial_id obrigatório',
    'temporario', true,
    'timestamp', now()
  )
);