import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Função para normalizar texto para busca inteligente
const normalizeSearchTerm = (text: string): string => {
  if (!text) return '';
  
  return text
    .normalize('NFD') // Remove acentos
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s*-\s*/g, ' ') // Remove hífens
    .replace(/\b\d+\s*(GR?S?|KGS?|G|GRAMAS?|QUILOS?)\b/gi, '') // Remove especificações de peso
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
};

// Função para calcular score de similaridade
const calculateSimilarityScore = (searchTerm: string, productName: string): number => {
  const normalizedSearch = normalizeSearchTerm(searchTerm);
  const normalizedProduct = normalizeSearchTerm(productName);
  
  // Match exato = 100
  if (normalizedProduct === normalizedSearch) return 100;
  
  // Contém termo completo = 80
  if (normalizedProduct.includes(normalizedSearch)) return 80;
  
  // Palavras-chave em comum
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
  const productWords = normalizedProduct.split(' ').filter(w => w.length > 2);
  
  const commonWords = searchWords.filter(word => 
    productWords.some(pWord => pWord.includes(word) || word.includes(pWord))
  );
  
  if (commonWords.length === 0) return 0;
  
  // Score baseado na proporção de palavras em comum
  return Math.floor((commonWords.length / searchWords.length) * 60);
};
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
        const produtoBase = produtosBaseMap.get(product.produto_base_id || 0);
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
      
      setProducts(productsData.map(p => ({
        ...p,
        solicitacao_id: p.solicitacao_id ?? undefined,
        categoria_descricao: p.categoria_descricao ?? undefined,
        grupo: p.grupo ?? undefined,
        produto_id: p.produto_id ?? undefined,
        preco: p.preco ?? undefined,
        per_capita: p.per_capita ?? undefined,
        produto_base_quantidade_embalagem: p.produto_base_quantidade_embalagem ?? undefined,
        arredondar_tipo: p.arredondar_tipo ?? undefined,
        apenas_valor_inteiro_sim_nao: p.apenas_valor_inteiro_sim_nao ?? undefined,
        em_promocao_sim_nao: p.em_promocao_sim_nao ?? undefined,
        produto_base_id: p.produto_base_id ?? undefined,
        criado_em: p.criado_em ?? undefined
      })));
      
      // Extract unique categories
      const uniqueCategories = [...new Set(
        productsData
          .map(p => p.categoria_descricao)
          .filter(Boolean)
      )].sort();
      setCategories(uniqueCategories.filter((cat): cat is string => cat !== null));

      // Sistema carregado com sucesso
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar produtos do mercado';
      console.error('[ERRO] Falha no carregamento de produtos:', errorMessage);
      setError(errorMessage);
      toast({
        title: "Erro Crítico",
        description: "Falha ao carregar dados do mercado",
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
      // Busca inteligente com normalização
      const normalizedSearch = normalizeSearchTerm(filters.search);
      
      filtered = filtered
        .map(p => ({
          ...p,
          _score: Math.max(
            calculateSimilarityScore(filters.search!, p.descricao || ''),
            calculateSimilarityScore(filters.search!, p.categoria_descricao || ''),
            calculateSimilarityScore(filters.search!, p.grupo || '')
          )
        }))
        .filter(p => p._score > 0) // Só mostra produtos com alguma similaridade
        .sort((a, b) => b._score - a._score) // Ordena por relevância
        .map(p => {
          // Remove o score temporário
          const { _score, ...product } = p;
          return product;
        });
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