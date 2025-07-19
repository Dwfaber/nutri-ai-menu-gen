
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProductRequest } from '@/hooks/useProductRequests';
import { withRetry, createConnectionMonitor } from '@/utils/connectionUtils';

interface PaginationOptions {
  pageSize?: number;
  initialLoad?: boolean;
}

export const usePaginatedRequests = (options: PaginationOptions = {}) => {
  const { pageSize = 20, initialLoad = true } = options;
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const connectionMonitor = createConnectionMonitor();

  const fetchPage = useCallback(async (page: number, reset: boolean = false) => {
    const isFirstPage = page === 0;
    setIsLoading(isFirstPage && !reset);
    setIsLoadingMore(!isFirstPage);
    setError(null);

    try {
      const operation = async () => {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
          .from('co_solicitacao_produto_listagem')
          .select('*', { count: 'exact' })
          .range(from, to)
          .order('criado_em', { ascending: false });

        if (error) throw error;

        return { data: data || [], count: count || 0 };
      };

      const result = await withRetry(operation, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 8000
      });

      if (reset || page === 0) {
        setRequests(result.data);
      } else {
        setRequests(prev => [...prev, ...result.data]);
      }

      setTotalCount(result.count);
      setHasMore(result.data.length === pageSize);
      setCurrentPage(page);

    } catch (err) {
      console.error('Error fetching product requests:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar solicitações';
      setError(errorMessage);
      
      if (!connectionMonitor.isOnline()) {
        toast({
          title: "Sem conexão",
          description: "Verifique sua conexão com a internet",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro de conexão",
          description: "Tentando reconectar... Verifique sua conexão.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [pageSize, toast, connectionMonitor]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchPage(currentPage + 1);
    }
  }, [fetchPage, currentPage, hasMore, isLoadingMore]);

  const refresh = useCallback(() => {
    setCurrentPage(0);
    fetchPage(0, true);
  }, [fetchPage]);

  const createRequest = useCallback(async (requestData: Omit<ProductRequest, 'criado_em' | 'solicitacao_produto_listagem_id'>) => {
    setError(null);
    
    try {
      const operation = async () => {
        const { data, error } = await supabase
          .from('co_solicitacao_produto_listagem')
          .insert([requestData])
          .select()
          .single();

        if (error) throw error;
        return data;
      };

      const data = await withRetry(operation, { maxRetries: 2 });
      
      setRequests(prev => [data, ...prev]);
      setTotalCount(prev => prev + 1);
      
      toast({
        title: "Sucesso",
        description: "Solicitação criada com sucesso",
      });
      
      return data;
    } catch (err) {
      console.error('Error creating product request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar solicitação';
      setError(errorMessage);
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
      
      return null;
    }
  }, [toast]);

  const updateRequest = useCallback(async (id: number, updates: Partial<ProductRequest>) => {
    setError(null);
    
    try {
      const operation = async () => {
        const { data, error } = await supabase
          .from('co_solicitacao_produto_listagem')
          .update(updates)
          .eq('solicitacao_produto_listagem_id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      };

      const data = await withRetry(operation, { maxRetries: 2 });
      
      setRequests(prev => prev.map(req => 
        req.solicitacao_produto_listagem_id === id ? { ...req, ...data } : req
      ));
      
      toast({
        title: "Sucesso",
        description: "Solicitação atualizada com sucesso",
      });
      
      return data;
    } catch (err) {
      console.error('Error updating product request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar solicitação';
      setError(errorMessage);
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
      
      return null;
    }
  }, [toast]);

  const deleteRequest = useCallback(async (id: number) => {
    setError(null);
    
    try {
      const operation = async () => {
        const { error } = await supabase
          .from('co_solicitacao_produto_listagem')
          .delete()
          .eq('solicitacao_produto_listagem_id', id);

        if (error) throw error;
      };

      await withRetry(operation, { maxRetries: 2 });
      
      setRequests(prev => prev.filter(req => req.solicitacao_produto_listagem_id !== id));
      setTotalCount(prev => prev - 1);
      
      toast({
        title: "Sucesso",
        description: "Solicitação removida com sucesso",
      });
      
      return true;
    } catch (err) {
      console.error('Error deleting product request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover solicitação';
      setError(errorMessage);
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    }
  }, [toast]);

  useEffect(() => {
    if (initialLoad) {
      fetchPage(0);
    }
  }, [fetchPage, initialLoad]);

  // Monitor de conexão
  useEffect(() => {
    const unsubscribe = connectionMonitor.onStatusChange((online) => {
      if (online && error) {
        // Tentar recarregar quando a conexão voltar
        setTimeout(() => refresh(), 1000);
      }
    });

    return unsubscribe;
  }, [connectionMonitor, error, refresh]);

  return {
    requests,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    totalCount,
    currentPage,
    loadMore,
    refresh,
    createRequest,
    updateRequest,
    deleteRequest
  };
};
