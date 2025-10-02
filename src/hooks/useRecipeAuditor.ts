import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AuditConfig {
  categorias?: string[] | null;
  limite_receitas?: number;
  incluir_calculos_detalhados?: boolean;
  apenas_problematicas?: boolean;
}

export interface ReceitaAuditada {
  receita_id: string;
  nome: string;
  custo_por_porcao: number;
  validacao: {
    valida: boolean;
    score_qualidade: number;
    severidade: 'critica' | 'alta' | 'media' | 'baixa';
  };
  problemas_detectados: Array<{
    tipo: string;
    descricao: string;
    severidade: 'critica' | 'alta' | 'media' | 'baixa';
  }>;
  ingredientes: {
    total: number;
    com_preco: number;
    sem_preco: number;
    principais: string[];
  };
}

export interface CategoryAuditReport {
  categoria: string;
  total_receitas_disponiveis: number;
  receitas_testadas: number;
  receitas_validas: ReceitaAuditada[];
  receitas_problematicas: ReceitaAuditada[];
  termos_extraidos: {
    ingredientes_principais: string[];
    palavras_chave: string[];
  };
  estatisticas: {
    custo_minimo: number;
    custo_maximo: number;
    custo_medio: number;
    problemas_por_severidade: {
      critica: number;
      alta: number;
      media: number;
      baixa: number;
    };
  };
}

export interface AuditResult {
  data_auditoria: string;
  categorias_auditadas: CategoryAuditReport[];
  resumo_geral: {
    total_receitas_testadas: number;
    receitas_validas: number;
    receitas_problematicas: number;
    problemas_por_tipo: Record<string, number>;
  };
}

export const useRecipeAuditor = () => {
  const [auditing, setAuditing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<string>('');

  const runAudit = async (config: AuditConfig) => {
    setAuditing(true);
    setProgress(0);
    setError(null);
    setCurrentCategory('');

    try {
      console.log('🔍 Iniciando auditoria com configuração:', config);

      const { data, error: fnError } = await supabase.functions.invoke('quick-worker', {
        body: {
          action: 'auditar_categorias',
          categorias: config.categorias,
          limite_receitas: config.limite_receitas || 50,
          incluir_calculos_detalhados: config.incluir_calculos_detalhados || false,
          apenas_problematicas: config.apenas_problematicas || false
        }
      });

      if (fnError) throw fnError;

      if (!data || data.error) {
        throw new Error(data?.error || 'Erro desconhecido ao executar auditoria');
      }

      console.log('✅ Auditoria concluída:', data);

      const safeResult: AuditResult = {
        data_auditoria: data?.data_auditoria || new Date().toISOString(),
        categorias_auditadas: Array.isArray(data?.categorias_auditadas) ? data.categorias_auditadas : [],
        resumo_geral: {
          total_receitas_testadas: data?.resumo_geral?.total_receitas_testadas ?? 0,
          receitas_validas: data?.resumo_geral?.receitas_validas ?? 0,
          receitas_problematicas: data?.resumo_geral?.receitas_problematicas ?? 0,
          problemas_por_tipo: data?.resumo_geral?.problemas_por_tipo ?? {}
        }
      };

      setResult(safeResult);
      setProgress(100);

      toast({
        title: "✅ Auditoria Concluída",
        description: `${safeResult.resumo_geral.total_receitas_testadas} receitas analisadas em ${safeResult.categorias_auditadas.length} categorias`,
      });

    } catch (err: any) {
      console.error('❌ Erro na auditoria:', err);
      setError(err.message || 'Erro ao executar auditoria');
      
      toast({
        title: "❌ Erro na Auditoria",
        description: err.message || 'Não foi possível completar a auditoria',
        variant: "destructive",
      });
    } finally {
      setAuditing(false);
      setProgress(0);
      setCurrentCategory('');
    }
  };

  const exportToJSON = () => {
    if (!result) return;

    const dataStr = JSON.stringify(result, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `auditoria-receitas-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast({
      title: "📥 Exportado",
      description: "Auditoria exportada como JSON",
    });
  };

  const exportToCSV = () => {
    if (!result) return;

    const rows: string[][] = [
      ['Categoria', 'Receita', 'Custo', 'Status', 'Problemas', 'Severidade']
    ];

    result.categorias_auditadas.forEach(cat => {
      [...cat.receitas_validas, ...cat.receitas_problematicas].forEach(rec => {
        rows.push([
          cat.categoria,
          rec.nome,
          rec.custo_por_porcao.toFixed(2),
          rec.validacao.valida ? 'Válida' : 'Problemática',
          rec.problemas_detectados.length.toString(),
          rec.validacao.severidade
        ]);
      });
    });

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const exportFileDefaultName = `auditoria-receitas-${new Date().toISOString().split('T')[0]}.csv`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast({
      title: "📥 Exportado",
      description: "Auditoria exportada como CSV",
    });
  };

  return {
    auditing,
    progress,
    result,
    error,
    currentCategory,
    runAudit,
    exportToJSON,
    exportToCSV
  };
};
