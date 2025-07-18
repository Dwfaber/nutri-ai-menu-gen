
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface ProductRequest {
  solicitacao_id: number;
  categoria_id?: number;
  categoria_descricao?: string;
  grupo?: string;
  produto_id?: number;
  preco?: number;
  per_capita?: number;
  inteiro?: boolean;
  arredondar_tipo?: number;
  promocao?: boolean;
  descricao?: string;
  unidade?: string;
  preco_compra?: number;
  produto_base_id?: number;
  quantidade_embalagem?: number;
  criado_em?: string;
}

export const useProductRequests = () => {
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRequests = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;
      
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching product requests:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar solicitações';
      setError(errorMessage);
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createRequest = async (requestData: Omit<ProductRequest, 'criado_em'>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('co_solicitacao_produto_listagem')
        .insert([requestData])
        .select()
        .single();

      if (error) throw error;
      
      setRequests([data, ...requests]);
      
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
    } finally {
      setIsLoading(false);
    }
  };

  const updateRequest = async (id: number, updates: Partial<ProductRequest>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('co_solicitacao_produto_listagem')
        .update(updates)
        .eq('solicitacao_id', id)
        .select()
        .single();

      if (error) throw error;
      
      setRequests(requests.map(req => 
        req.solicitacao_id === id ? { ...req, ...data } : req
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
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRequest = async (id: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('co_solicitacao_produto_listagem')
        .delete()
        .eq('solicitacao_id', id);

      if (error) throw error;
      
      setRequests(requests.filter(req => req.solicitacao_id !== id));
      
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
    } finally {
      setIsLoading(false);
    }
  };

  const getRequestsByGroup = (group: string) => {
    return requests.filter(req => req.grupo === group);
  };

  const getRequestsByCategory = (categoryId: number) => {
    return requests.filter(req => req.categoria_id === categoryId);
  };

  const calculateTotalCost = (filteredRequests?: ProductRequest[]) => {
    const requestsToSum = filteredRequests || requests;
    return requestsToSum.reduce((total, req) => total + (req.preco || 0), 0);
  };

  const calculateTotalPurchaseCost = (filteredRequests?: ProductRequest[]) => {
    const requestsToSum = filteredRequests || requests;
    return requestsToSum.reduce((total, req) => total + (req.preco_compra || 0), 0);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return {
    requests,
    isLoading,
    error,
    fetchRequests,
    createRequest,
    updateRequest,
    deleteRequest,
    getRequestsByGroup,
    getRequestsByCategory,
    calculateTotalCost,
    calculateTotalPurchaseCost
  };
};
