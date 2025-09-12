import { useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // ajuste o caminho conforme seu projeto

interface FormData {
  // defina aqui os campos do seu formulário
  // exemplo:
  // dataInicio: string;
  // dataFim: string;
  // incluirFinaisDeSemana: boolean;
  // ...
}

interface Receita {
  // defina os campos da receita conforme seu backend
  id: string;
  nome: string;
  custo_total: number;
  custo_por_refeicao: number;
  // ...
}

interface UseIntegratedMenuGenerationReturn {
  loading: boolean;
  error: string | null;
  generateMenu: (formData: FormData) => Promise<Receita[]>;
}

export function useIntegratedMenuGeneration(): UseIntegratedMenuGenerationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withRetry<T>(
    fn: () => Promise<T>,
    options: { maxRetries: number; initialDelay: number; maxDelay: number; backoffFactor: number }
  ): Promise<{ data?: T; error?: Error }> {
    let attempts = 0;
    let delay = options.initialDelay;

    while (attempts < options.maxRetries) {
      try {
        const data = await fn();
        return { data };
      } catch (err: any) {
        attempts++;
        if (attempts >= options.maxRetries) {
          return { error: err };
        }
        await new Promise((res) => setTimeout(res, delay));
        delay = Math.min(delay * options.backoffFactor, options.maxDelay);
      }
    }
    return { error: new Error('Max retries exceeded') };
  }

  async function generateMenu(formData: FormData): Promise<Receita[]> {
    setLoading(true);
    setError(null);

    try {
      const payload = JSON.stringify(formData);

      const { data, error: functionError } = await withRetry(
        () => supabase.functions.invoke('gpt-assistant', { body: payload }),
        { maxRetries: 3, initialDelay: 1500, maxDelay: 10000, backoffFactor: 2 }
      );

      if (functionError) throw new Error(functionError.message || 'Erro ao gerar receitas');
      if (!data || !data.success) throw new Error(data?.error || 'Erro na geração das receitas');

      // Extrai todas as receitas de todos os dias do cardápio
      const recipes = data.cardapio?.flatMap((dia: any) => dia.receitas) || [];
      if (!recipes.length) throw new Error('Nenhuma receita gerada');

      setLoading(false);
      return recipes;
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
      setLoading(false);
      return [];
    }
  }

  return { loading, error, generateMenu };
}