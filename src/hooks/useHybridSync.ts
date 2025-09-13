import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncConfig {
  strategy?: 'truncate_insert' | 'upsert_cleanup' | 'upsert';
  backup?: boolean;
  batchSize?: number;
  cleanupOrphans?: boolean;
  orphanDays?: number;
}

interface SyncResult {
  success: boolean;
  tableName: string;
  strategy: string;
  processedRecords: number;
  totalRecords: number;
  executionTime: string;
  backupId?: string;
}

export const useHybridSync = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<string>('');
  const { toast } = useToast();

  const syncTable = async (
    tableName: string, 
    data: any[], 
    config?: SyncConfig
  ): Promise<SyncResult> => {
    setIsProcessing(true);
    setCurrentOperation(`Sincronizando ${tableName}...`);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('hybrid-sync-manager', {
        body: {
          action: 'sync_table',
          targetTable: tableName,
          data,
          syncConfig: config
        }
      });

      if (error) throw error;

      toast({
        title: "Sincronização Concluída",
        description: `${tableName}: ${result.processedRecords} registros processados em ${result.executionTime}`,
      });

      return result;
    } catch (error) {
      console.error(`Sync error for ${tableName}:`, error);
      toast({
        title: "Erro na Sincronização",
        description: (error as Error)?.message || `Falha ao sincronizar ${tableName}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
      setCurrentOperation('');
    }
  };

  const getTableStrategy = async (tableName: string) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('hybrid-sync-manager', {
        body: {
          action: 'get_strategy',
          targetTable: tableName
        }
      });

      if (error) throw error;
      return result.strategy;
    } catch (error) {
      console.error(`Error getting strategy for ${tableName}:`, error);
      return null;
    }
  };

  const createBackup = async (tableName: string) => {
    setIsProcessing(true);
    setCurrentOperation(`Criando backup de ${tableName}...`);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('hybrid-sync-manager', {
        body: {
          action: 'create_backup',
          targetTable: tableName
        }
      });

      if (error) throw error;

      toast({
        title: "Backup Criado",
        description: `Backup de ${tableName} criado com sucesso`,
      });

      return result;
    } catch (error) {
      console.error(`Backup error for ${tableName}:`, error);
      toast({
        title: "Erro no Backup",
        description: (error as Error)?.message || `Falha ao criar backup de ${tableName}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
      setCurrentOperation('');
    }
  };

  const restoreBackup = async (tableName: string, backupId: string) => {
    setIsProcessing(true);
    setCurrentOperation(`Restaurando backup de ${tableName}...`);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('hybrid-sync-manager', {
        body: {
          action: 'restore_backup',
          targetTable: tableName,
          syncConfig: { backupId }
        }
      });

      if (error) throw error;

      toast({
        title: "Backup Restaurado",
        description: `Backup de ${tableName} restaurado com sucesso`,
      });

      return result;
    } catch (error) {
      console.error(`Restore error for ${tableName}:`, error);
      toast({
        title: "Erro na Restauração",
        description: (error as Error)?.message || `Falha ao restaurar backup de ${tableName}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
      setCurrentOperation('');
    }
  };

  const cleanupOrphans = async (tableName: string, orphanDays?: number) => {
    setIsProcessing(true);
    setCurrentOperation(`Limpando registros órfãos de ${tableName}...`);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('hybrid-sync-manager', {
        body: {
          action: 'cleanup_orphans',
          targetTable: tableName,
          syncConfig: { orphanDays }
        }
      });

      if (error) throw error;

      toast({
        title: "Limpeza Concluída",
        description: `${result.deletedCount || 0} registros órfãos removidos de ${tableName}`,
      });

      return result;
    } catch (error) {
      console.error(`Cleanup error for ${tableName}:`, error);
      toast({
        title: "Erro na Limpeza",
        description: (error as Error)?.message || `Falha ao limpar registros órfãos de ${tableName}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
      setCurrentOperation('');
    }
  };

  const syncWithStrategy = async (tableName: string, data: any[]) => {
    // Obter estratégia recomendada para a tabela
    const strategy = await getTableStrategy(tableName);
    
    if (strategy) {
      console.log(`Using strategy for ${tableName}:`, strategy);
      return await syncTable(tableName, data, strategy);
    } else {
      // Fallback otimizado: usar upsert_cleanup para co_solicitacao_produto_listagem
      if (tableName === 'co_solicitacao_produto_listagem') {
        return await syncTable(tableName, data, { 
          strategy: 'upsert_cleanup',
          backup: true,
          batchSize: 1000,
          cleanupOrphans: true,
          orphanDays: 30
        });
      }
      // Fallback padrão para outras tabelas
      return await syncTable(tableName, data, { strategy: 'upsert' });
    }
  };

  return {
    isProcessing,
    currentOperation,
    syncTable,
    syncWithStrategy,
    getTableStrategy,
    createBackup,
    restoreBackup,
    cleanupOrphans
  };
};