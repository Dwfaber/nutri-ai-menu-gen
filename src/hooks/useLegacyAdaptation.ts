
import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface SchemaInfo {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      length?: number;
      precision?: number;
      scale?: number;
    }>;
  }>;
  relationships: Array<{
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
  }>;
}

interface TableMapping {
  [key: string]: {
    legacyTable: string;
    supabaseTable: string;
    columnMapping: { [key: string]: string };
  };
}

interface CodeAdaptation {
  productCodeFormat: {
    pattern: RegExp;
    examples: string[];
    description: string;
  };
  categoryMapping: { [key: string]: { name: string; group: string } };
  unitMapping: { [key: string]: string };
  priceCalculation: {
    defaultMargin: number;
    bulkDiscounts: {
      minQuantity: number;
      discountPercent: number;
    };
  };
}

export const useLegacyAdaptation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [schemaInfo, setSchemaInfo] = useState<SchemaInfo | null>(null);
  const [tableMapping, setTableMapping] = useState<TableMapping | null>(null);
  const [codeAdaptation, setCodeAdaptation] = useState<CodeAdaptation | null>(null);
  const { toast } = useToast();

  const discoverSchema = async (): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      console.log('Descobrindo estrutura do banco legado...');
      
      const { data, error: functionError } = await supabase.functions.invoke('discover-legacy-schema', {
        body: { action: 'discoverSchema' }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro na descoberta do schema');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro na descoberta do schema');
      }

      setSchemaInfo(data.schema);
      
      toast({
        title: "Schema Descoberto!",
        description: `${data.schema.tables.length} tabelas encontradas e mapeadas`,
      });

      return true;

    } catch (err) {
      console.error('Error discovering schema:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao descobrir estrutura do banco.';
      
      toast({
        title: "Erro na Descoberta",
        description: errorMessage,
        variant: "destructive"
      });

      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const mapTables = async (): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      console.log('Mapeando tabelas legadas...');
      
      const { data, error: functionError } = await supabase.functions.invoke('discover-legacy-schema', {
        body: { action: 'mapTables' }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro no mapeamento de tabelas');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro no mapeamento');
      }

      setTableMapping(data.mapping);
      
      toast({
        title: "Tabelas Mapeadas!",
        description: "Mapeamento entre sistema legado e Supabase criado",
      });

      return true;

    } catch (err) {
      console.error('Error mapping tables:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao mapear tabelas.';
      
      toast({
        title: "Erro no Mapeamento",
        description: errorMessage,
        variant: "destructive"
      });

      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const adaptCodes = async (): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      console.log('Adaptando códigos do sistema legado...');
      
      const { data, error: functionError } = await supabase.functions.invoke('discover-legacy-schema', {
        body: { action: 'adaptCodes' }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro na adaptação de códigos');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro na adaptação');
      }

      setCodeAdaptation(data.adaptation);
      
      toast({
        title: "Códigos Adaptados!",
        description: "Sistema configurado para seus códigos específicos",
      });

      return true;

    } catch (err) {
      console.error('Error adapting codes:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao adaptar códigos.';
      
      toast({
        title: "Erro na Adaptação",
        description: errorMessage,
        variant: "destructive"
      });

      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const runFullAdaptation = async (): Promise<boolean> => {
    const steps = [
      { name: 'Descobrir Schema', fn: discoverSchema },
      { name: 'Mapear Tabelas', fn: mapTables },
      { name: 'Adaptar Códigos', fn: adaptCodes }
    ];

    for (const step of steps) {
      console.log(`Executando: ${step.name}`);
      const success = await step.fn();
      if (!success) {
        toast({
          title: "Adaptação Interrompida",
          description: `Erro na etapa: ${step.name}`,
          variant: "destructive"
        });
        return false;
      }
    }

    toast({
      title: "Adaptação Completa!",
      description: "Sistema totalmente adaptado ao seu banco legado",
    });

    return true;
  };

  return {
    discoverSchema,
    mapTables,
    adaptCodes,
    runFullAdaptation,
    isProcessing,
    schemaInfo,
    tableMapping,
    codeAdaptation
  };
};
