import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { OptimizationConfig } from '@/types/optimization';

export interface ShoppingList {
  id: string;
  menu_id: string;
  client_name: string;
  status: string;
  budget_predicted: number;
  cost_actual: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: string;
  shopping_list_id: string;
  product_id_legado: string;
  product_name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  available: boolean;
}

export const useShoppingList = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const createFromMenu = async (
    menuId: string, 
    clientName: string, 
    budgetPredicted: number,
    optimizationConfig?: OptimizationConfig
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Creating shopping list from menu:', { 
        menuId, 
        clientName, 
        budgetPredicted,
        optimizationEnabled: !!optimizationConfig
      });

      const { data, error: functionError } = await supabase.functions.invoke('generate-shopping-list', {
        body: {
          menuId,
          clientName,
          budgetPredicted,
          optimizationConfig
        }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro ao gerar lista de compras');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro na geração da lista');
      }

      const budgetStatus = data.budgetStatus.withinBudget ? 'Dentro do orçamento' : 'Orçamento excedido';
      
      toast({
        title: "Lista de Compras Gerada!",
        description: `${budgetStatus} - R$ ${data.budgetStatus.actual.toFixed(2)}`,
        variant: data.budgetStatus.withinBudget ? "default" : "destructive"
      });

      return data.shoppingList;

    } catch (err) {
      console.error('Error creating shopping list:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar lista de compras';
      setError(errorMessage);
      
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

  const getShoppingLists = async (): Promise<ShoppingList[]> => {
    try {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (err) {
      console.error('Error fetching shopping lists:', err);
      setError('Erro ao buscar listas de compras');
      return [];
    }
  };

  const getShoppingListItems = async (listId: string): Promise<ShoppingListItem[]> => {
    try {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('shopping_list_id', listId)
        .order('category', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (err) {
      console.error('Error fetching shopping list items:', err);
      setError('Erro ao buscar itens da lista');
      return [];
    }
  };

  const updateItemQuantity = async (itemId: string, quantity: number) => {
    try {
      // First get the current item to calculate the new total
      const { data: currentItem, error: fetchError } = await supabase
        .from('shopping_list_items')
        .select('unit_price')
        .eq('id', itemId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const totalPrice = quantity * currentItem.unit_price;

      const { error } = await supabase
        .from('shopping_list_items')
        .update({ 
          quantity,
          total_price: totalPrice
        })
        .eq('id', itemId);

      if (error) {
        throw error;
      }

      toast({
        title: "Quantidade Atualizada",
        description: "Item atualizado com sucesso"
      });

    } catch (err) {
      console.error('Error updating item quantity:', err);
      toast({
        title: "Erro",
        description: "Erro ao atualizar quantidade",
        variant: "destructive"
      });
    }
  };

  const exportToCSV = (items: ShoppingListItem[], listName: string) => {
    const headers = ['Código', 'Produto', 'Categoria', 'Quantidade', 'Unidade', 'Preço Unit.', 'Total'];
    const csvContent = [
      headers.join(','),
      ...items.map(item => [
        item.product_id_legado,
        `"${item.product_name}"`,
        item.category,
        item.quantity,
        item.unit,
        item.unit_price.toFixed(2),
        item.total_price.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `lista_compras_${listName.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Lista Exportada",
      description: "Arquivo CSV baixado com sucesso"
    });
  };

  const exportOptimizationReport = (items: ShoppingListItem[], optimizationResults: any[], listName: string) => {
    const headers = [
      'Produto Base', 'Quantidade Solicitada', 'Quantidade Comprada', 
      'Sobra', 'Custo Total', 'Economia', 'Embalagens Usadas', 'Promoções'
    ];
    
    const csvContent = [
      headers.join(','),
      ...optimizationResults.map(result => [
        `"${result.produto_base_nome}"`,
        result.quantidade_solicitada.toFixed(2),
        result.quantidade_total_comprada.toFixed(2),
        result.sobra.toFixed(2),
        result.custo_total.toFixed(2),
        result.economia_obtida.toFixed(2),
        result.pacotes_selecionados.length,
        result.pacotes_selecionados.filter((p: any) => p.em_promocao).length
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `otimizacao_${listName.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Relatório de Otimização Exportado",
      description: "Arquivo CSV com análise detalhada baixado com sucesso"
    });
  };

  return {
    createFromMenu,
    getShoppingLists,
    getShoppingListItems,
    updateItemQuantity,
    exportToCSV,
    exportOptimizationReport,
    isLoading,
    error
  };
};
