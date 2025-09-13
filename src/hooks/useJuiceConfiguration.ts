import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface JuiceOption {
  produto_base_id: number;
  nome: string;
  tipo: string;
  ativo?: boolean;
}

export interface JuiceConfiguration {
  use_pro_mix: boolean;
  use_pro_vita: boolean;
  use_suco_diet: boolean;
  use_suco_natural: boolean;
}

export interface ProteinConfiguration {
  use_carne_vermelha: boolean;
  use_carne_suina: boolean;
  use_frango: boolean;
  use_peixe: boolean;
  use_ovo: boolean;
  use_vegetariano: boolean;
}

export interface ProteinOption {
  produto_base_id: number;
  receita_id_legado: string;
  nome: string;
  tipo: string;
  subcategoria: string;
  ativo?: boolean;
}

export const useJuiceConfiguration = () => {
  const [availableJuices, setAvailableJuices] = useState<JuiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Carregar sucos disponíveis
  const loadAvailableJuices = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sucos_disponiveis')
        .select('produto_base_id, nome, tipo, ativo')
        .eq('ativo', true)
        .order('produto_base_id');

      if (error) throw error;
      setAvailableJuices((data || []).map(item => ({
        ...item,
        ativo: item.ativo ?? false
      })));
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
      const { error } = await supabase
        .from('contratos_corporativos')
        .update(config as any)
        .eq('filial_id_legado', parseInt(clientId));

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

  // Gerar configuração de sucos usando a RPC melhorada
  const generateJuiceConfig = async (
    startDate: string,
    endDate: string,
    config: JuiceConfiguration
  ) => {
    try {
      const { data, error } = await supabase.rpc('gerar_cardapio', {
        p_data_inicio: startDate,
        p_data_fim: endDate,
        p_use_pro_mix: config.use_pro_mix,
        p_use_pro_vita: config.use_pro_vita,
        p_use_suco_diet: config.use_suco_diet,
        p_use_suco_natural: config.use_suco_natural
      });

      if (error) throw error;
      
      // A nova função retorna uma estrutura mais rica
      if (data && typeof data === 'object' && 'cardapio_semanal' in data) {
        const cardapioData = data as { cardapio_semanal: any[] };
        toast({
          title: "Configuração gerada",
          description: `Cardápio de sucos criado para ${cardapioData.cardapio_semanal?.length || 0} dias úteis.`,
        });
      }
      
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

export const useProteinConfiguration = () => {
  const [availableProteins, setAvailableProteins] = useState<ProteinOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Carregar proteínas disponíveis
  const loadAvailableProteins = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('proteinas_disponiveis')
        .select('produto_base_id, receita_id_legado, nome, tipo, subcategoria, ativo')
        .eq('ativo', true)
        .order('tipo, subcategoria, nome');

      if (error) throw error;
      setAvailableProteins((data || []).map(item => ({
        ...item,
        ativo: item.ativo ?? false
      })));
    } catch (error) {
      console.error('Erro ao carregar proteínas disponíveis:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de proteínas disponíveis.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar configuração de proteínas para um cliente
  const updateClientProteinConfig = async (clientId: string, config: Partial<ProteinConfiguration>) => {
    try {
      // Map protein config to database columns
      const dbConfig: Record<string, boolean> = {};
      Object.entries(config).forEach(([key, value]) => {
        dbConfig[key] = value;
      });
      
      const { error } = await supabase
        .from('contratos_corporativos')
        .update(dbConfig as any)
        .eq('filial_id_legado', parseInt(clientId));

      if (error) throw error;

      toast({
        title: "Configuração atualizada",
        description: "As configurações de proteína foram salvas com sucesso.",
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar configuração de proteínas:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar as configurações de proteína.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Buscar receitas por tipo de proteína
  const getProteinsByType = (tipo: string, subcategoria?: string) => {
    return availableProteins.filter(protein => 
      protein.tipo === tipo && 
      (subcategoria ? protein.subcategoria === subcategoria : true)
    );
  };

  // Gerar seleção de proteínas baseada na configuração
  const generateProteinSelection = (config: ProteinConfiguration) => {
    const selectedTypes = Object.entries(config)
      .filter(([_, enabled]) => enabled)
      .map(([key, _]) => key.replace('use_', ''));

    const selection = {
      principal_1: [] as ProteinOption[],
      principal_2: [] as ProteinOption[]
    };

    selectedTypes.forEach(tipo => {
      const proteins1 = getProteinsByType(tipo, 'principal_1');
      const proteins2 = getProteinsByType(tipo, 'principal_2');
      
      selection.principal_1.push(...proteins1);
      selection.principal_2.push(...proteins2);
    });

    return selection;
  };

  useEffect(() => {
    loadAvailableProteins();
  }, []);

  return {
    availableProteins,
    isLoading,
    loadAvailableProteins,
    updateClientProteinConfig,
    getProteinsByType,
    generateProteinSelection
  };
};