import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { withRetry } from '@/utils/connectionUtils';
import type { OptimizationSettings } from '@/types/optimization';

interface Ingredient {
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  unidade: string;
}

interface Recipe {
  id: string;
  nome: string;
  ingredientes: Ingredient[];
}

interface Menu {
  id: string;
  nome: string;
  receitas: Recipe[];
}

export interface OptimizationSettings {
  prioritizePromotions: boolean;
  allowFractionalUnits: boolean;
  wasteThreshold: number;
  budgetLimit: number | null;
}

interface ShoppingItem {
  id: string;
  produto_id: string;
  produto_nome: string;
  categoria: string;
  quantidade_necessaria: number;
  unidade: string;
  preco_unitario: number;
  valor_total: number;
  fornecedor?: string;
  observacoes?: string;
  receita_origem: string[];
}

interface ShoppingList {
  id: string;
  nome: string;
  cardapio_id?: string;
  itens: ShoppingItem[];
  valor_total: number;
  data_criacao: string;
  status: 'draft' | 'approved' | 'purchased';
  optimization_results?: {
    total_savings: number;
    optimized_items: number;
    promotion_savings: number;
    packaging_savings: number;
  };
}

export const useShoppingList = () => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [currentList, setCurrentList] = useState<ShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateShoppingList = async (
    cardapioId: string,
    optimizationSettings: OptimizationSettings = {
      prioritizePromotions: true,
      allowFractionalUnits: false,
      wasteThreshold: 0.1,
      budgetLimit: null
    }
  ): Promise<ShoppingList | null> => {
    setIsLoading(true);
    
    try {
      const result = await withRetry(async () => {
        const { data, error } = await supabase.functions.invoke('generate-shopping-list', {
          body: { 
            cardapioId,
            optimizationSettings
          }
        });

        if (error) throw error;
        return data;
      });

      if (!result.success) {
        throw new Error(result.error || 'Erro na geração da lista');
      }

      const newList: ShoppingList = {
        id: crypto.randomUUID(),
        nome: `Lista de Compras - ${new Date().toLocaleDateString()}`,
        cardapio_id: cardapioId,
        itens: result.items || [],
        valor_total: result.total_cost || 0,
        data_criacao: new Date().toISOString(),
        status: 'draft',
        optimization_results: result.optimization_results
      };

      setCurrentList(newList);
      setLists(prev => [newList, ...prev]);

      toast({
        title: "Lista de Compras Gerada!",
        description: `${result.items?.length || 0} itens gerados com otimização automática`,
      });

      return newList;

    } catch (error) {
      console.error('Erro ao gerar lista de compras:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro na geração da lista';
      
      toast({
        title: "Erro na Geração",
        description: errorMessage,
        variant: "destructive"
      });

      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const saveShoppingList = async (list: ShoppingList): Promise<boolean> => {
    try {
      // Simulate saving to database
      setLists(prev => 
        prev.map(l => l.id === list.id ? list : l)
      );
      
      if (currentList?.id === list.id) {
        setCurrentList(list);
      }

      toast({
        title: "Lista Salva",
        description: "Lista de compras salva com sucesso",
      });

      return true;
    } catch (error) {
      console.error('Erro ao salvar lista:', error);
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível salvar a lista",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteShoppingList = async (listId: string): Promise<boolean> => {
    try {
      setLists(prev => prev.filter(l => l.id !== listId));
      
      if (currentList?.id === listId) {
        setCurrentList(null);
      }

      toast({
        title: "Lista Excluída",
        description: "Lista de compras excluída com sucesso",
      });

      return true;
    } catch (error) {
      console.error('Erro ao excluir lista:', error);
      toast({
        title: "Erro ao Excluir",
        description: "Não foi possível excluir a lista",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    lists,
    currentList,
    isLoading,
    generateShoppingList,
    saveShoppingList,
    deleteShoppingList,
    setCurrentList
  };
};
