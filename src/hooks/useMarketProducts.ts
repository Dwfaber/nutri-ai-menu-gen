import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MarketProduct {
  solicitacao_produto_listagem_id: number;
  solicitacao_id?: number;
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
  apenas_valor_inteiro_sim_nao?: boolean;
  em_promocao_sim_nao?: boolean;
  produto_base_quantidade_embalagem?: number;
  criado_em?: string;
}

export interface MarketFilters {
  categoria?: string;
  promocao?: boolean;
  preco_max?: number;
  search?: string;
}

export const useMarketProducts = () => {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<MarketProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState<MarketFilters>({});
  const { toast } = useToast();

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('*')
        .order('criado_em', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const productsData = data || [];
      setProducts(productsData);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(
        productsData
          .map(p => p.categoria_descricao)
          .filter(Boolean)
      )].sort();
      setCategories(uniqueCategories);

      console.log(`Loaded ${productsData.length} market products`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar produtos do mercado';
      setError(errorMessage);
      toast({
        title: "Erro ao Carregar Produtos",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    if (filters.categoria) {
      filtered = filtered.filter(p => p.categoria_descricao === filters.categoria);
    }

    if (filters.promocao !== undefined) {
      filtered = filtered.filter(p => p.em_promocao_sim_nao === filters.promocao);
    }

    if (filters.preco_max !== undefined) {
      filtered = filtered.filter(p => (p.preco || 0) <= filters.preco_max!);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.descricao?.toLowerCase().includes(searchLower) ||
        p.categoria_descricao?.toLowerCase().includes(searchLower) ||
        p.grupo?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredProducts(filtered);
  };

  const updateFilters = (newFilters: Partial<MarketFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const getProductsByCategory = (categoria: string) => {
    return products.filter(p => p.categoria_descricao === categoria);
  };

  const getPromotionalProducts = () => {
    return products.filter(p => p.em_promocao_sim_nao === true);
  };

  const getProductById = (id: number) => {
    return products.find(p => p.solicitacao_produto_listagem_id === id);
  };

  const getProductStats = () => {
    const total = products.length;
    const promotional = products.filter(p => p.em_promocao_sim_nao).length;
    const withPrices = products.filter(p => p.preco && p.preco > 0).length;
    const averagePrice = products
      .filter(p => p.preco && p.preco > 0)
      .reduce((sum, p) => sum + (p.preco || 0), 0) / withPrices || 0;

    return {
      total,
      promotional,
      withPrices,
      averagePrice,
      categories: categories.length
    };
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, products]);

  return {
    products: filteredProducts,
    allProducts: products,
    isLoading,
    error,
    categories,
    filters,
    updateFilters,
    clearFilters,
    refetch: fetchProducts,
    getProductsByCategory,
    getPromotionalProducts,
    getProductById,
    getProductStats
  };
};