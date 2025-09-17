import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { withRetry } from '@/utils/connectionUtils';

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

export interface ShoppingItem {
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

export interface ShoppingList {
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
  client_name: string;
  budget_predicted: number;
  cost_actual?: number;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  product_id_legado: string;
  product_name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  available: boolean;
  supplier?: string;
  notes?: string;
}

export const useShoppingList = () => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [currentList, setCurrentList] = useState<ShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Refs for debouncing and preventing concurrent calls
  const isLoadingRef = useRef(false);
  const lastToastRef = useRef(0);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced toast function to prevent spam
  const showToast = useCallback((title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    const now = Date.now();
    
    // Clear existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    // Only show toast if last one was more than 2 seconds ago
    if (now - lastToastRef.current > 2000) {
      toast({ title, description, variant });
      lastToastRef.current = now;
    } else {
      // Queue the toast
      toastTimeoutRef.current = setTimeout(() => {
        toast({ title, description, variant });
        lastToastRef.current = Date.now();
      }, 2000 - (now - lastToastRef.current));
    }
  }, [toast]);

  // Memoized load function to prevent infinite loops
  const loadShoppingLists = useCallback(async (): Promise<void> => {
    // Prevent concurrent calls
    if (isLoadingRef.current) {
      return;
    }
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      
      const result = await withRetry(async () => {
        const { data: shoppingLists, error: listsError } = await supabase
          .from('shopping_lists')
          .select('*')
          .order('created_at', { ascending: false });

        if (listsError) throw listsError;
        return shoppingLists;
      }, {
        maxRetries: 2,
        initialDelay: 500,
        maxDelay: 2000
      });

      if (result && result.length > 0) {
        const mappedLists: ShoppingList[] = [];
        
        // Process lists with batch requests
        const itemsPromises = result.map(list => 
          withRetry(async () => {
            const { data: items, error: itemsError } = await supabase
              .from('shopping_list_items')
              .select('*')
              .eq('shopping_list_id', list.id);

            if (itemsError) throw itemsError;
            return { list, items: items || [] };
          }, { maxRetries: 1 })
        );

        const listsWithItems = await Promise.allSettled(itemsPromises);
        
        listsWithItems.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { list, items } = result.value;
            
            const mappedItems: ShoppingItem[] = items.map(item => ({
              id: item.id,
              produto_id: item.product_id_legado,
              produto_nome: item.product_name,
              categoria: item.category,
              quantidade_necessaria: item.quantity,
              unidade: item.unit,
              preco_unitario: item.unit_price,
              valor_total: item.total_price,
              fornecedor: (item as any).supplier || '',
              observacoes: (item as any).notes || '',
              receita_origem: []
            }));

            mappedLists.push({
              id: list.id,
              nome: `Lista de Compras - ${new Date(list.created_at).toLocaleDateString()}`,
              cardapio_id: list.menu_id,
              itens: mappedItems,
              valor_total: list.cost_actual || 0,
              data_criacao: list.created_at,
              status: list.status === 'pending' ? 'draft' : list.status === 'budget_ok' ? 'approved' : 'draft',
              client_name: list.client_name,
              budget_predicted: list.budget_predicted,
              cost_actual: list.cost_actual || 0,
              created_at: list.created_at
            });
          }
        });
        
        setLists(mappedLists);
      } else {
        setLists([]);
      }
    } catch (error) {
      console.error('Error loading shopping lists:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      
      showToast(
        "Problema de Conectividade",
        "Tentando reconectar...",
        "destructive"
      );
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [showToast]);

  const generateShoppingList = async (
    menuId: string,
    clientName: string = 'Cliente',
    budgetPredicted: number = 1000,
    servingsPerDay: number = 50
  ): Promise<ShoppingList | null> => {
    setIsLoading(true);
    
    try {
      const result = await withRetry(async () => {
        const { data, error } = await supabase.functions.invoke('generate-shopping-list', {
          body: { 
            menuId,
            clientName,
            budgetPredicted,
            servingsPerDay
          }
        });

        if (error) throw error;
        return data;
      });

      if (!result.success) {
        throw new Error(result.error || 'Erro na geração da lista');
      }

      // Reload lists from database to get the actual saved data
      await loadShoppingLists();

      showToast(
        "Lista de Compras Gerada!",
        `Lista gerada com sucesso!`
      );

      // Return the most recent list (should be the one just created)
      const mostRecentList = lists.length > 0 ? lists[0] : null;
      return mostRecentList;

    } catch (error) {
      console.error('Erro ao gerar lista de compras:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro na geração da lista';
      
      showToast(
        "Erro na Geração",
        errorMessage,
        "destructive"
      );

      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const saveShoppingList = async (list: ShoppingList): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Save to Supabase first
      const { error: listError } = await supabase
        .from('shopping_lists')
        .upsert({
          menu_id: list.cardapio_id || '',
          client_name: list.client_name || '',
          budget_predicted: list.budget_predicted,
          cost_actual: list.valor_total,
          status: list.status === 'draft' ? 'pending' : list.status === 'approved' ? 'budget_ok' : list.status,
          created_at: list.created_at,
        });

      if (listError) throw listError;

      // Delete existing items and insert new ones
      await supabase.from('shopping_list_items').delete().eq('shopping_list_id', list.id);

      if (list.itens.length > 0) {
        const itemsPayload = list.itens.map(item => ({
          shopping_list_id: list.id,
          product_id_legado: item.produto_id,
          product_name: item.produto_nome,
          category: item.categoria,
          quantity: item.quantidade_necessaria,
          unit: item.unidade,
          unit_price: item.preco_unitario,
          total_price: item.valor_total,
          supplier: item.fornecedor || null,
          notes: item.observacoes || null,
        }));

        const { error: itemsError } = await supabase
          .from('shopping_list_items')
          .insert(itemsPayload);

        if (itemsError) throw itemsError;
      }

      // Update local state
      setLists(prev => 
        prev.map(l => l.id === list.id ? list : l)
      );
      
      if (currentList?.id === list.id) {
        setCurrentList(list);
      }

      showToast(
        "Lista Salva",
        "Lista de compras salva com sucesso"
      );

      return true;
    } catch (error) {
      console.error('Erro ao salvar lista:', error);
      showToast(
        "Erro ao Salvar",
        "Não foi possível salvar a lista",
        "destructive"
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteShoppingList = async (listId: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Delete from database - first delete items, then the list
      const { error: itemsError } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('shopping_list_id', listId);

      if (itemsError) throw itemsError;

      const { error: listError } = await supabase
        .from('shopping_lists')
        .delete()
        .eq('id', listId);

      if (listError) throw listError;

      // Remove from local state
      setLists(prev => prev.filter(l => l.id !== listId));
      
      if (currentList?.id === listId) {
        setCurrentList(null);
      }

      showToast(
        "Lista Excluída",
        "Lista de compras excluída com sucesso"
      );

      return true;
    } catch (error) {
      console.error('Erro ao excluir lista:', error);
      showToast(
        "Erro ao Excluir",
        "Não foi possível excluir a lista",
        "destructive"
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateItemQuantity = async (itemId: string, quantity: number) => {
    if (!currentList) return;

    try {
      // Update in database first
      const item = currentList.itens.find(i => i.id === itemId);
      if (!item) return;

      const newTotalPrice = quantity * item.preco_unitario;

      const { error } = await supabase
        .from('shopping_list_items')
        .update({ 
          quantity: quantity,
          total_price: newTotalPrice
        })
        .eq('id', itemId);

      if (error) throw error;

      // Update local state
      const updatedItems = currentList.itens.map(item => 
        item.id === itemId 
          ? { ...item, quantidade_necessaria: quantity, valor_total: newTotalPrice }
          : item
      );

      const updatedList = {
        ...currentList,
        itens: updatedItems,
        valor_total: updatedItems.reduce((sum, item) => sum + item.valor_total, 0)
      };

      // Update the list's total cost in database
      await supabase
        .from('shopping_lists')
        .update({ cost_actual: updatedList.valor_total })
        .eq('id', currentList.id);

      setCurrentList(updatedList);
      setLists(prev => prev.map(l => l.id === updatedList.id ? updatedList : l));

    } catch (error) {
      console.error('Erro ao atualizar quantidade:', error);
      showToast(
        "Erro ao Atualizar",
        "Não foi possível atualizar a quantidade",
        "destructive"
      );
    }
  };

  // Métodos adicionais que estavam sendo usados
  const getShoppingLists = async (): Promise<ShoppingList[]> => {
    return lists;
  };

  const getShoppingListItems = async (listId: string): Promise<ShoppingListItem[]> => {
    const list = lists.find(l => l.id === listId);
    if (!list) return [];

    // Convert ShoppingItem to ShoppingListItem format
    return list.itens.map(item => ({
      id: item.id,
      product_id_legado: item.produto_id,
      product_name: item.produto_nome,
      category: item.categoria,
      quantity: item.quantidade_necessaria,
      unit: item.unidade,
      unit_price: item.preco_unitario,
      total_price: item.valor_total,
      available: true,
      supplier: item.fornecedor,
      notes: item.observacoes
    }));
  };

  const exportToCSV = (items: ShoppingListItem[], clientName: string) => {
    const headers = ['Produto', 'Categoria', 'Quantidade', 'Unidade', 'Preço Unit.', 'Total'];
    const csvContent = [
      headers.join(','),
      ...items.map(item => [
        item.product_name,
        item.category,
        item.quantity,
        item.unit,
        item.unit_price.toFixed(2),
        item.total_price.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lista-compras-${clientName}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const createFromMenu = async (menuId: string, clientName: string, totalCost: number, servingsPerDay: number = 50): Promise<void> => {
    await generateShoppingList(menuId, clientName, totalCost, servingsPerDay);
  };

  return {
    lists,
    currentList,
    isLoading,
    error,
    generateShoppingList,
    saveShoppingList,
    deleteShoppingList,
    setCurrentList,
    getShoppingLists,
    getShoppingListItems,
    exportToCSV,
    updateItemQuantity,
    createFromMenu,
    loadShoppingLists
  };
};