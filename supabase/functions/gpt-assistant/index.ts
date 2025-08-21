/**
 * GPT Assistant - Version 3.0 Hybrid Intelligent
 * Sistema completo com acesso aos dados reais + infraestrutura robusta
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// === CONFIGURAÇÕES E TIPOS ===
const CONFIG = {
  CACHE_TTL: 5 * 60 * 1000,
  CACHE_MAX_SIZE: 100,
  RATE_LIMIT: 30,
  RATE_WINDOW: 60 * 1000,
  REQUEST_TIMEOUT: 30000,
  DEFAULT_MEAL_COST: 8.50,
  DEFAULT_MEAL_QUANTITY: 50,
  VERSION: '3.0-hybrid-intelligent'
};

interface ClientData {
  nome: string;
  custo_maximo_refeicao: number;
  restricoes_alimentares: string[];
  preferencias_alimentares: string[];
}

interface RequestData {
  action?: string;
  filialIdLegado?: number;
  numDays?: number;
  refeicoesPorDia?: number;
  client_data?: ClientData;
  meal_quantity?: number;
  simple_mode?: boolean;
  baseRecipes?: any;
  useDiaEspecial?: boolean;
}

interface Recipe {
  receita_id_legado: string;
  nome_receita: string;
  categoria_descricao: string;
  custo_total: number;
  porcoes: number;
  ingredientes?: any[];
}

interface Product {
  produto_id: number;
  descricao: string;
  preco: number;
  unidade: string;
  disponivel?: boolean;
}

interface MenuGenerationResult {
  success: boolean;
  recipes?: Recipe[];
  shopping_list?: any[];
  total_cost?: number;
  cost_per_meal?: number;
  error?: string;
}

// === CACHE LRU OTIMIZADO ===
class LRUCache<T> {
  private cache = new Map<string | number, { data: T; timestamp: number; hits: number }>();
  
  constructor(
    private maxSize = CONFIG.CACHE_MAX_SIZE, 
    private ttl = CONFIG.CACHE_TTL
  ) {
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }
  
  get(key: string | number): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    item.hits++;
    return item.data;
  }
  
  set(key: string | number, data: T): void {
    if (this.cache.size >= this.maxSize) {
      const lru = [...this.cache.entries()]
        .sort((a, b) => a[1].hits - b[1].hits)[0];
      if (lru) this.cache.delete(lru[0]);
    }
    
    this.cache.set(key, { data, timestamp: Date.now(), hits: 0 });
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  stats() {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// === CIRCUIT BREAKER ===
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly threshold = 5;
  private readonly timeout = 60000;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Database temporarily unavailable');
      }
    }
    
    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
        console.error(`Circuit breaker opened after ${this.failures} failures`);
      }
      
      throw error;
    }
  }
  
  getState() {
    return { state: this.state, failures: this.failures };
  }
}

// === INSTÂNCIAS GLOBAIS ===
const clientCache = new LRUCache<ClientData>();
const recipeCache = new LRUCache<Recipe[]>(50, 10 * 60 * 1000); // 10 min para receitas
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const supabaseCircuit = new CircuitBreaker();
let supabaseClient: any = null;

// === FUNÇÕES AUXILIARES ===
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
  }
  return supabaseClient;
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  
  if (!rateLimitMap.has(clientId)) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + CONFIG.RATE_WINDOW });
    return true;
  }
  
  const client = rateLimitMap.get(clientId)!;
  if (now > client.resetTime) {
    client.count = 1;
    client.resetTime = now + CONFIG.RATE_WINDOW;
    return true;
  }
  
  if (client.count >= CONFIG.RATE_LIMIT) {
    return false;
  }
  
  client.count++;
  return true;
}

function validateRequestData(data: any): RequestData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid request format');
  }
  
  if (data.filialIdLegado !== undefined) {
    data.filialIdLegado = Number(data.filialIdLegado);
    if (isNaN(data.filialIdLegado)) {
      throw new Error('Invalid filialIdLegado');
    }
  }
  
  if (data.meal_quantity !== undefined) {
    data.meal_quantity = Math.min(Math.max(1, Number(data.meal_quantity)), 10000);
  }
  
  return data as RequestData;
}

// === ACESSO AOS DADOS REAIS ===
async function fetchAvailableRecipes(maxCost?: number, categoria?: string): Promise<Recipe[]> {
  return supabaseCircuit.execute(async () => {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('receitas_legado')
      .select('receita_id_legado, nome_receita, categoria_descricao, custo_total, porcoes')
      .eq('inativa', false);
    
    if (maxCost) {
      query = query.lte('custo_total', maxCost);
    }
    
    if (categoria) {
      query = query.eq('categoria_descricao', categoria);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) throw error;
    return data || [];
  });
}

async function fetchRecipeIngredients(recipeId: string): Promise<any[]> {
  return supabaseCircuit.execute(async () => {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('receita_ingredientes')
      .select('*')
      .eq('receita_id_legado', recipeId);
    
    if (error) throw error;
    return data || [];
  });
}

async function fetchMarketProducts(): Promise<Product[]> {
  return supabaseCircuit.execute(async () => {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('co_solicitacao_produto_listagem')
      .select('produto_id, descricao, preco, unidade')
      .order('descricao');
    
    if (error) throw error;
    return data || [];
  });
}

async function calculateRecipeCost(recipe: Recipe, mealQuantity: number): Promise<number> {
  try {
    const ingredients = await fetchRecipeIngredients(recipe.receita_id_legado);
    const products = await fetchMarketProducts();
    
    if (!ingredients.length || !products.length) {
      return recipe.custo_total * (mealQuantity / recipe.porcoes);
    }
    
    let totalCost = 0;
    
    for (const ingredient of ingredients) {
      const matchingProduct = products.find(p => 
        p.descricao.toLowerCase().includes(ingredient.nome?.toLowerCase() || '') ||
        ingredient.produto_base_descricao?.toLowerCase().includes(p.descricao.toLowerCase())
      );
      
      if (matchingProduct && ingredient.quantidade) {
        const cost = (ingredient.quantidade * matchingProduct.preco) / recipe.porcoes * mealQuantity;
        totalCost += cost;
      }
    }
    
    return totalCost || recipe.custo_total * (mealQuantity / recipe.porcoes);
    
  } catch (error) {
    console.error('Erro ao calcular custo da receita:', error);
    return recipe.custo_total * (mealQuantity / recipe.porcoes);
  }
}

async function generateShoppingList(selectedRecipes: Recipe[], mealQuantity: number): Promise<any[]> {
  const shoppingList: any[] = [];
  const products = await fetchMarketProducts();
  
  for (const recipe of selectedRecipes) {
    try {
      const ingredients = await fetchRecipeIngredients(recipe.receita_id_legado);
      
      for (const ingredient of ingredients) {
        const matchingProduct = products.find(p => 
          p.descricao.toLowerCase().includes(ingredient.nome?.toLowerCase() || '') ||
          ingredient.produto_base_descricao?.toLowerCase().includes(p.descricao.toLowerCase())
        );
        
        if (matchingProduct && ingredient.quantidade) {
          const existingItem = shoppingList.find(item => item.produto_id === matchingProduct.produto_id);
          const adjustedQuantity = ingredient.quantidade * (mealQuantity / recipe.porcoes);
          
          if (existingItem) {
            existingItem.quantidade += adjustedQuantity;
            existingItem.total_cost = existingItem.quantidade * existingItem.unit_price;
          } else {
            shoppingList.push({
              produto_id: matchingProduct.produto_id,
              product_name: matchingProduct.descricao,
              quantidade: adjustedQuantity,
              unit_price: matchingProduct.preco,
              total_cost: adjustedQuantity * matchingProduct.preco,
              unit: matchingProduct.unidade || 'kg',
              recipe_source: recipe.nome_receita
            });
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao processar ingredientes da receita ${recipe.nome_receita}:`, error);
    }
  }
  
  return shoppingList;
}

async function generateIntelligentMenu(processedData: any): Promise<MenuGenerationResult> {
  const startTime = Date.now();
  
  try {
    const { client_data, meal_quantity } = processedData;
    const maxCostPerRecipe = client_data.custo_maximo_refeicao * meal_quantity;
    
    console.log(`🍽️ Gerando cardápio inteligente para ${client_data.nome}:`, {
      meal_quantity,
      max_cost_per_recipe: maxCostPerRecipe
    });
    
    // Buscar receitas adequadas ao orçamento
    const cacheKey = `recipes_${maxCostPerRecipe}_${meal_quantity}`;
    let availableRecipes = recipeCache.get(cacheKey);
    
    if (!availableRecipes) {
      availableRecipes = await fetchAvailableRecipes(maxCostPerRecipe);
      recipeCache.set(cacheKey, availableRecipes);
      console.log(`📊 ${availableRecipes.length} receitas encontradas no banco`);
    } else {
      console.log(`💾 ${availableRecipes.length} receitas do cache`);
    }
    
    if (!availableRecipes.length) {
      throw new Error('Nenhuma receita encontrada dentro do orçamento');
    }
    
    // Selecionar receitas variadas (pratos principais, acompanhamentos, sobremesas)
    const mainDishes = availableRecipes.filter(r => 
      r.categoria_descricao?.toLowerCase().includes('principal') ||
      r.categoria_descricao?.toLowerCase().includes('prato')
    ).slice(0, 3);
    
    const sides = availableRecipes.filter(r => 
      r.categoria_descricao?.toLowerCase().includes('acompanhamento') ||
      r.categoria_descricao?.toLowerCase().includes('salada')
    ).slice(0, 2);
    
    const desserts = availableRecipes.filter(r => 
      r.categoria_descricao?.toLowerCase().includes('sobremesa')
    ).slice(0, 1);
    
    const selectedRecipes = [...mainDishes, ...sides, ...desserts];
    
    if (!selectedRecipes.length) {
      // Fallback: selecionar as 5 primeiras receitas
      selectedRecipes.push(...availableRecipes.slice(0, 5));
    }
    
    console.log(`🍴 ${selectedRecipes.length} receitas selecionadas para o cardápio`);
    
    // Calcular custos reais
    const recipesWithCosts = await Promise.all(
      selectedRecipes.map(async (recipe) => {
        const realCost = await calculateRecipeCost(recipe, meal_quantity);
        return { ...recipe, custo_ajustado: realCost };
      })
    );
    
    const totalCost = recipesWithCosts.reduce((sum, recipe) => sum + recipe.custo_ajustado, 0);
    const costPerMeal = totalCost / meal_quantity;
    
    // Gerar lista de compras
    const shoppingList = await generateShoppingList(selectedRecipes, meal_quantity);
    
    console.log(`✅ Cardápio gerado em ${Date.now() - startTime}ms:`, {
      recipes: selectedRecipes.length,
      total_cost: totalCost.toFixed(2),
      cost_per_meal: costPerMeal.toFixed(2),
      shopping_items: shoppingList.length
    });
    
    // Formatar cardápio para compatibilidade com frontend
    const weekDays = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
    const cardapioFormatted = weekDays.map((dia, index) => ({
      dia,
      receitas: recipesWithCosts.slice(index, index + 1).map(recipe => ({
        nome: recipe.nome_receita || recipe.nome,
        categoria: recipe.categoria_descricao || recipe.categoria_receita || 'Prato Principal',
        custo_total: recipe.custo_ajustado || 0,
        receita_id: recipe.receita_id_legado || recipe.id,
        tempo_preparo: recipe.tempo_preparo || 30,
        porcoes: recipe.porcoes || recipe.quantidade_refeicoes || 1
      }))
    })).filter(day => day.receitas.length > 0);

    return {
      success: true,
      recipes: recipesWithCosts,
      menu: {
        cardapio: cardapioFormatted
      },
      shopping_list: shoppingList,
      total_cost: totalCost,
      cost_per_meal: costPerMeal
    };
    
  } catch (error) {
    console.error('❌ Erro na geração do cardápio:', error);
    return {
      success: false,
      error: error.message || 'Erro interno na geração do cardápio'
    };
  }
}

async function convertLegacyPayload(requestData: RequestData): Promise<any> {
  const startTime = Date.now();
  
  console.log('🔄 Processando request...', {
    hasFilialId: !!requestData.filialIdLegado,
    hasClientData: !!requestData.client_data?.nome
  });
  
  // Já tem client_data estruturado
  if (requestData.client_data?.nome) {
    console.log(`⚡ Client data presente (${Date.now() - startTime}ms)`);
    return {
      client_data: requestData.client_data,
      meal_quantity: requestData.meal_quantity || requestData.refeicoesPorDia || CONFIG.DEFAULT_MEAL_QUANTITY,
      simple_mode: true,
      _from_cache: false
    };
  }
  
  // Buscar cliente por filialIdLegado
  if (requestData.filialIdLegado) {
    const cacheKey = requestData.filialIdLegado;
    
    const cached = clientCache.get(cacheKey);
    if (cached) {
      console.log(`💾 Cache hit para filial ${cacheKey} (${Date.now() - startTime}ms)`);
      return {
        client_data: cached,
        meal_quantity: requestData.refeicoesPorDia || CONFIG.DEFAULT_MEAL_QUANTITY,
        simple_mode: true,
        _from_cache: true
      };
    }
    
    try {
      const clientData = await supabaseCircuit.execute(async () => {
        const supabase = getSupabaseClient();
        
        const { data, error } = await supabase
          .from('custos_filiais')
          .select('*')
          .eq('filial_id', requestData.filialIdLegado)
          .limit(1)
          .maybeSingle();
        
        if (error) throw error;
        if (!data) return null;
        
        return {
          nome: data.nome_fantasia || data.razao_social || `Cliente ${requestData.filialIdLegado}`,
          custo_maximo_refeicao: data.custo_medio_semanal ? 
            Number((data.custo_medio_semanal / 7).toFixed(2)) : 
            data.RefCustoSegunda || CONFIG.DEFAULT_MEAL_COST,
          restricoes_alimentares: data.restricoes_alimentares || [],
          preferencias_alimentares: data.preferencias_alimentares || []
        };
      });
      
      if (clientData) {
        clientCache.set(cacheKey, clientData);
        console.log(`✅ Cliente ${cacheKey} encontrado e cacheado (${Date.now() - startTime}ms)`);
        
        return {
          client_data: clientData,
          meal_quantity: requestData.refeicoesPorDia || CONFIG.DEFAULT_MEAL_QUANTITY,
          simple_mode: true,
          _from_cache: false
        };
      }
    } catch (error) {
      console.error(`⚠️ Erro ao buscar cliente ${cacheKey}:`, error.message);
    }
    
    // Fallback
    console.log(`📋 Usando fallback para filial ${cacheKey} (${Date.now() - startTime}ms)`);
    const fallbackData = {
      nome: `Cliente Filial ${requestData.filialIdLegado}`,
      custo_maximo_refeicao: CONFIG.DEFAULT_MEAL_COST,
      restricoes_alimentares: [],
      preferencias_alimentares: []
    };
    
    return {
      client_data: fallbackData,
      meal_quantity: requestData.refeicoesPorDia || CONFIG.DEFAULT_MEAL_QUANTITY,
      simple_mode: true,
      _from_cache: false
    };
  }
  
  // Fallback geral
  return {
    client_data: {
      nome: 'Cliente Padrão',
      custo_maximo_refeicao: CONFIG.DEFAULT_MEAL_COST,
      restricoes_alimentares: [],
      preferencias_alimentares: []
    },
    meal_quantity: requestData.meal_quantity || CONFIG.DEFAULT_MEAL_QUANTITY,
    simple_mode: true,
    _from_cache: false
  };
}

// === CORS ===
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// === MAIN HANDLER ===
Deno.serve(async (req) => {
  const requestStartTime = Date.now();
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Health check com estatísticas avançadas
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        version: CONFIG.VERSION,
        model: 'hybrid-intelligent',
        timestamp: new Date().toISOString(),
        cache_stats: {
          clients: clientCache.stats(),
          recipes: recipeCache.stats()
        },
        rate_limit_entries: rateLimitMap.size,
        circuit_breaker: supabaseCircuit.getState(),
        features: [
          'real_recipe_access',
          'cost_calculation',
          'shopping_list_generation',
          'intelligent_selection',
          'circuit_breaker',
          'lru_cache'
        ]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
  
  // Rate limiting
  const clientId = req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  
  if (!checkRateLimit(clientId)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Rate limit exceeded',
        retry_after: 60
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        },
        status: 429
      }
    );
  }
  
  // Timeout control
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, CONFIG.REQUEST_TIMEOUT);
  
  try {
    // Parse e validar request
    const rawData = await req.json();
    const requestData = validateRequestData(rawData);
    
    console.log(`📝 Request v3.0 de ${clientId}:`, {
      action: requestData.action,
      filial: requestData.filialIdLegado,
      timestamp: new Date().toISOString()
    });
    
    // Processar dados do cliente
    const processedData = await convertLegacyPayload(requestData);
    
    // Gerar cardápio inteligente com dados reais
    const result = await generateIntelligentMenu(processedData);
    
    clearTimeout(timeoutId);
    
    // Resposta com métricas completas
    return new Response(
      JSON.stringify({
        ...result,
        client_info: {
          name: processedData.client_data.nome,
          max_cost_per_meal: processedData.client_data.custo_maximo_refeicao,
          meal_quantity: processedData.meal_quantity
        },
        performance: {
          total_time_ms: Date.now() - requestStartTime,
          cached_client: processedData._from_cache || false,
          version: CONFIG.VERSION,
          data_source: 'real_database'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Categorização avançada de erros
    let status = 500;
    let category = 'internal_error';
    
    if (error.name === 'AbortError') {
      status = 408;
      category = 'timeout';
    } else if (error.message?.includes('Invalid')) {
      status = 400;
      category = 'validation_error';
    } else if (error.message?.includes('Rate limit')) {
      status = 429;
      category = 'rate_limit';
    } else if (error.message?.includes('unavailable')) {
      status = 503;
      category = 'service_unavailable';
    }
    
    console.error(`❌ Erro [${category}] para ${clientId}:`, error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        error_category: category,
        timestamp: new Date().toISOString(),
        version: CONFIG.VERSION
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status
      }
    );
  }
});