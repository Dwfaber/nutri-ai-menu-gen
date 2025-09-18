
import { useState } from 'react';
import { MenuItem, Menu } from '@/types/client';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useMenuAI = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateMenu = async (
    clientId: string,
    budget: number,
    restrictions: string[],
    preferences?: string
  ): Promise<Menu | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      console.log('Generating menu with GPT Assistant...');
      
      const { data, error: functionError } = await supabase.functions.invoke('gpt-assistant', {
        body: {
          action: 'generateMenu',
          clientId,
          budget,
          restrictions,
          preferences
        }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Erro ao gerar cardápio');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro na geração do cardápio');
      }

      console.log('Menu generated successfully:', data.menu);
      
      toast({
        title: "Cardápio Gerado!",
        description: "Cardápio criado com sucesso usando IA",
      });

      return data.menu;

    } catch (err) {
      console.error('Error generating menu:', err);
      
      // Enhanced error handling with more specific messages
      let errorMessage = 'Erro ao gerar cardápio. Tente novamente.';
      
      if (err instanceof Error) {
        if (err.message.includes('timeout')) {
          errorMessage = 'Timeout: O servidor demorou muito para responder. Tente novamente em alguns minutos.';
        } else if (err.message.includes('Failed to send a request')) {
          errorMessage = 'Falha na conexão com o servidor. Verifique sua conexão e tente novamente.';
        } else if (err.message.includes('Edge Function')) {
          errorMessage = 'Erro interno do servidor. Nossa equipe foi notificada.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      
      toast({
        title: "Erro na Geração",
        description: errorMessage,
        variant: "destructive"
      });

      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const editMenuWithNLP = async (menuId: string, command: string): Promise<boolean> => {
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log(`Processing NLP command: ${command}`);
      
      const { data, error: functionError } = await supabase.functions.invoke('gpt-assistant', {
        body: {
          action: 'editMenu',
          menuId,
          command
        }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro ao processar comando');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro no processamento');
      }

      console.log('Command processed successfully:', data.response);
      
      toast({
        title: "Comando Processado!",
        description: "Modificação aplicada com sucesso",
      });

      return true;

    } catch (err) {
      console.error('Error processing NLP command:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar comando. Tente novamente.';
      setError(errorMessage);
      
      toast({
        title: "Erro no Processamento",
        description: errorMessage,
        variant: "destructive"
      });

      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const syncLegacyData = async (operation: 'all' | 'produtos' | 'receitas' | 'clientes' = 'all'): Promise<boolean> => {
    setIsGenerating(true);
    setError(null);

    try {
      console.log(`Starting sync operation: ${operation}`);
      
      const { data, error: functionError } = await supabase.functions.invoke('sync-legacy-db', {
        body: { operation }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro na sincronização');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro na sincronização');
      }

      console.log('Sync completed:', data);
      
      toast({
        title: "Sincronização Concluída!",
        description: `${data.processedRecords} registros processados em ${data.executionTime}`,
      });

      return true;

    } catch (err) {
      console.error('Error syncing legacy data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro na sincronização. Tente novamente.';
      setError(errorMessage);
      
      toast({
        title: "Erro na Sincronização",
        description: errorMessage,
        variant: "destructive"
      });

      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateMenu,
    editMenuWithNLP,
    syncLegacyData,
    isGenerating,
    error
  };
};
