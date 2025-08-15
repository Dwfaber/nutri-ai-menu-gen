
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
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
  const { toast } = useToast();

  // Load shopping lists from database on component mount
  const loadShoppingLists = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      const { data: shoppingLists, error: listsError } = await supabase
        .from('shopping_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (listsError) throw listsError;

      if (shoppingLists && shoppingLists.length > 0) {
        const mappedLists: ShoppingList[] = [];
        
        for (const list of shoppingLists) {
          const { data: items, error: itemsError } = await supabase
            .from('shopping_list_items')
            .select('*')
            .eq('shopping_list_id', list.id);

          if (itemsError) {
            console.error('Error loading items for list:', list.id, itemsError);
            continue;
          }

          const mappedItems: ShoppingItem[] = (items || []).map(item => ({
            id: item.id,
            produto_id: item.product_id_legado,
            produto_nome: item.product_name,
            categoria: item.category,
            quantidade_necessaria: item.quantity,
            unidade: item.unit,
            preco_unitario: item.unit_price,
            valor_total: item.total_price,
            fornecedor: '',
            observacoes: '',
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
        
        setLists(mappedLists);
      }
    } catch (error) {
      console.error('Error loading shopping lists:', error);
      toast({
        title: "Erro ao Carregar",
        description: "Não foi possível carregar as listas de compras",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateShoppingList = async (
    menuId: string,
    clientName: string = 'Cliente',
    budgetPredicted: number = 1000
  ): Promise<ShoppingList | null> => {
    setIsLoading(true);
    
    try {
      const result = await withRetry(async () => {
        const { data, error } = await supabase.functions.invoke('generate-shopping-list', {
          body: { 
            menuId,
            clientName,
            budgetPredicted,
            servingsPerDay: 100
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
        cardapio_id: menuId,
        itens: result.items || [],
        valor_total: result.total_cost || 0,
        data_criacao: new Date().toISOString(),
        status: 'draft',
        optimization_results: result.optimization_results,
        client_name: result.client_name || clientName,
        budget_predicted: result.budget_predicted || budgetPredicted,
        cost_actual: result.total_cost || 0,
        created_at: new Date().toISOString()
      };

      // Reload lists from database to get the actual saved data
      await loadShoppingLists();

      toast({
        title: "Lista de Compras Gerada!",
        description: `Lista gerada com sucesso! Recarregando dados...`,
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

  const updateItemQuantity = async (itemId: string, quantity: number) => {
    if (!currentList) return;

    const updatedItems = currentList.itens.map(item => 
      item.id === itemId 
        ? { ...item, quantidade_necessaria: quantity, valor_total: quantity * item.preco_unitario }
        : item
    );

    const updatedList = {
      ...currentList,
      itens: updatedItems,
      valor_total: updatedItems.reduce((sum, item) => sum + item.valor_total, 0)
    };

    setCurrentList(updatedList);
    setLists(prev => prev.map(l => l.id === updatedList.id ? updatedList : l));
  };

  const createFromMenu = async (menuId: string, clientName: string, totalCost: number): Promise<void> => {
    await generateShoppingList(menuId, clientName, totalCost);
  };

  return {
    lists,
    currentList,
    isLoading,
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
