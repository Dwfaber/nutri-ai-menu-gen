import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MarketProduct {
  id: string; // Primary identifier - using produto_base_id (legacy ID) as string  
  solicitacao_produto_listagem_id: number; // Market listing ID (e.g., 4450 for abacate)
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
  produto_base_id?: number; // Reference to produtos_base.produto_base_id (e.g., 1 for abacate)
  produto_base_uuid?: string; // produtos_base.id UUID reference
  quantidade_embalagem?: number;
  apenas_valor_inteiro_sim_nao?: boolean;
  em_promocao_sim_nao?: boolean;
  produto_base_quantidade_embalagem?: number;
  criado_em?: string;
  produtos_base?: {
    id: string; // UUID from produtos_base
    descricao: string;
    unidade: string;
  };
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

      // First get data from co_solicitacao_produto_listagem
      const { data, error: fetchError } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('*')
        .order('criado_em', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Get produtos_base data for mapping
      const { data: produtosBaseData } = await supabase
        .from('produtos_base')
        .select('id, produto_base_id, descricao, unidade');

      // Create a map for easier lookup
      const produtosBaseMap = new Map(
        (produtosBaseData || []).map(pb => [pb.produto_base_id, pb])
      );

      // Transform data to use produto_base_id (legacy ID) as primary ID
      const productsData = (data || []).map(product => {
        const produtoBase = produtosBaseMap.get(product.produto_base_id);
        return {
          ...product,
          id: product.produto_base_id?.toString() || `temp-${product.solicitacao_produto_listagem_id}`, // Use legacy ID as primary ID
          produto_base_uuid: produtoBase?.id,
          descricao: product.descricao || produtoBase?.descricao || '',
          unidade: product.unidade || produtoBase?.unidade || '',
          produtos_base: produtoBase ? {
            id: produtoBase.id,
            descricao: produtoBase.descricao || '',
            unidade: produtoBase.unidade || ''
          } : undefined
        };
      });
      
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

  const getProductById = (id: string | number) => {
    const searchId = id.toString();
    return products.find(p => 
      p.id === searchId || 
      p.produto_base_id?.toString() === searchId ||
      p.solicitacao_produto_listagem_id.toString() === searchId ||
      p.produto_base_uuid === searchId
    );
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