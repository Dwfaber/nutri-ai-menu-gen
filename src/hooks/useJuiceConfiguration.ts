import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

export interface JuiceOption {
  id: number;
  nome: string;
  ativo?: boolean;
}

export interface JuiceConfiguration {
  use_pro_mix: boolean;
  use_pro_vita: boolean;
  use_suco_diet: boolean;
  use_suco_natural: boolean;
}

export const useJuiceConfiguration = () => {
  const [availableJuices, setAvailableJuices] = useState<JuiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Carregar sucos disponíveis
  const loadAvailableJuices = async () => {
    try {
      setIsLoading(true);
      const supabase = createClient(
        'https://wzbhhioegxdpegirglbq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YmhoaW9lZ3hkcGVnaXJnbGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDA0MDUsImV4cCI6MjA2ODA3NjQwNX0.ufwv_XD8LZ2SGMPYUy7Z-CkK2GRNx8mailJb6ZRZHXQ'
      );
      const { data, error } = await supabase
        .from('sucos_disponiveis')
        .select('*')
        .eq('ativo', true)
        .order('id');

      if (error) throw error;
      setAvailableJuices(data || []);
    } catch (error) {
      console.error('Erro ao carregar sucos disponíveis:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de sucos disponíveis.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar configuração de sucos para um cliente
  const updateClientJuiceConfig = async (clientId: string, config: Partial<JuiceConfiguration>) => {
    try {
      const supabase = createClient(
        'https://wzbhhioegxdpegirglbq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YmhoaW9lZ3hkcGVnaXJnbGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDA0MDUsImV4cCI6MjA2ODA3NjQwNX0.ufwv_XD8LZ2SGMPYUy7Z-CkK2GRNx8mailJb6ZRZHXQ'
      );
      const { error } = await supabase
        .from('contratos_corporativos')
        .update(config)
        .eq('id', clientId);

      if (error) throw error;

      toast({
        title: "Configuração atualizada",
        description: "As configurações de suco foram salvas com sucesso.",
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar configuração de sucos:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar as configurações de suco.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Gerar configuração de sucos usando a RPC
  const generateJuiceConfig = async (
    startDate: string,
    endDate: string,
    config: JuiceConfiguration
  ) => {
    try {
      const supabase = createClient(
        'https://wzbhhioegxdpegirglbq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YmhoaW9lZ3hkcGVnaXJnbGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDA0MDUsImV4cCI6MjA2ODA3NjQwNX0.ufwv_XD8LZ2SGMPYUy7Z-CkK2GRNx8mailJb6ZRZHXQ'
      );
      const { data, error } = await supabase.rpc('gerar_cardapio', {
        p_data_inicio: startDate,
        p_data_fim: endDate,
        p_use_pro_mix: config.use_pro_mix,
        p_use_pro_vita: config.use_pro_vita,
        p_use_suco_diet: config.use_suco_diet,
        p_use_suco_natural: config.use_suco_natural
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao gerar configuração de sucos:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar configuração de sucos.",
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    loadAvailableJuices();
  }, []);

  return {
    availableJuices,
    isLoading,
    loadAvailableJuices,
    updateClientJuiceConfig,
    generateJuiceConfig
  };
};