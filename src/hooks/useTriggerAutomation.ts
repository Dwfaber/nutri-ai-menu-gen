import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TriggerAutomationOptions {
  views?: string[];
  trigger_source?: 'manual' | 'scheduled';
}

interface AutomationStatus {
  automation_name: string;
  last_triggered_at: string | null;
  status: string;
  is_enabled: boolean;
  trigger_source: string | null;
}

export const useTriggerAutomation = () => {
  const [isTriggering, setIsTriggering] = useState(false);
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const { toast } = useToast();

  const triggerAutomation = async (options: TriggerAutomationOptions = {}) => {
    setIsTriggering(true);
    
    try {
      toast({
        title: "Iniciando Automação",
        description: "Disparando processo de sincronização n8n...",
      });

      const { data, error } = await supabase.functions.invoke('trigger-n8n-automation', {
        body: {
          trigger_source: options.trigger_source || 'manual',
          views: options.views || ['all'],
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Automação Iniciada",
        description: "Processo de sincronização n8n foi iniciado com sucesso!",
      });

      // Buscar status atualizado
      await fetchAutomationStatus();

      return data;
    } catch (error) {
      console.error('Erro ao disparar automação:', error);
      toast({
        title: "Erro na Automação",
        description: (error as Error)?.message || "Falha ao iniciar o processo de sincronização",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsTriggering(false);
    }
  };

  const fetchAutomationStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_control')
        .select('*')
        .eq('automation_name', 'n8n_legacy_sync')
        .single();

      if (error) {
        console.error('Erro ao buscar status da automação:', error);
        return;
      }

      setStatus({
        ...data,
        status: data.status || ''
      });
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    }
  };

  const triggerCompleteSync = () => {
    return triggerAutomation({
      views: ['all'],
      trigger_source: 'manual'
    });
  };

  const triggerSpecificViews = (views: string[]) => {
    return triggerAutomation({
      views,
      trigger_source: 'manual'
    });
  };

  return {
    isTriggering,
    status,
    triggerAutomation,
    triggerCompleteSync,
    triggerSpecificViews,
    fetchAutomationStatus
  };
};