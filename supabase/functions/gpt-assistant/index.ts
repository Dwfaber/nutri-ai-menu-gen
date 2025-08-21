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
      .select(`
        receita_id_legado,
        nome_receita,
        categoria_descricao,
        categoria_receita,
        porcoes,
        quantidade_refeicoes,
        tempo_preparo,
        inativa
      `)
      .eq('inativa', false);

    if (categoria) {
      query = query.or(`categoria_descricao.ilike.%${categoria}%,categoria_receita.ilike.%${categoria}%`);
    }

    // Não filtrar por custo_total pois está sempre 0 - calcular dinamicamente
    const { data, error } = await query
      .order('nome_receita', { ascending: true })
      .limit(100);

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

/**
 * Calcula custo real da receita com transparência sobre ingredientes faltantes
 */
async function calculateRecipeCostWithWarnings(recipeId: string, mealQuantity: number = 1) {
  const startTime = Date.now();
  
  try {
    // 1. Buscar ingredientes da receita
    const { data: ingredients, error } = await getSupabaseClient()
      .from('receita_ingredientes')
      .select(`
        nome,
        produto_base_id,
        quantidade,
        unidade
      `)
      .eq('receita_id_legado', recipeId);
    
    if (error) throw error;
    
    if (!ingredients || ingredients.length === 0) {
      return {
        total_cost: 0,
        cost_calculated: 0,
        has_missing_prices: true,
        warnings: ['Receita sem ingredientes cadastrados'],
        details: []
      };
    }
    
    // 2. Buscar produtos do mercado
    const { data: marketProducts, error: marketError } = await getSupabaseClient()
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .not('preco', 'is', null)
      .gt('preco', 0);
    
    if (marketError) throw marketError;
    
    // 3. Calcular custos e identificar problemas
    let calculatedCost = 0;
    const missingIngredients = [];
    const pricedIngredients = [];
    const details = [];
    
    for (const ing of ingredients) {
      const qty = convertToStandardUnit(ing.quantidade, ing.unidade);
      
      // Buscar preço do ingrediente
      let priceInfo = null;
      
      // Primeiro tentar por produto_base_id
      if (ing.produto_base_id) {
        const matchingProducts = marketProducts.filter(p => 
          p.produto_base_id === ing.produto_base_id
        );
        
        if (matchingProducts.length > 0) {
          priceInfo = matchingProducts.reduce((prev, current) => 
            (prev.preco < current.preco) ? prev : current
          );
        }
      }
      
      // Se não encontrou, tentar por nome
      if (!priceInfo) {
        const normalizedName = normalizeIngredientName(ing.nome);
        const matchingProducts = marketProducts.filter(p => {
          const productName = normalizeIngredientName(p.descricao || '');
          return productName.includes(normalizedName) || normalizedName.includes(productName);
        });
        
        if (matchingProducts.length > 0) {
          priceInfo = matchingProducts.reduce((prev, current) => 
            (prev.preco < current.preco) ? prev : current
          );
        }
      }
      
      // Processar resultado
      if (priceInfo) {
        const unitPrice = convertPriceToKg(priceInfo.preco, priceInfo.unidade);
        const totalPrice = unitPrice * qty;
        calculatedCost += totalPrice;
        
        pricedIngredients.push({
          nome: ing.nome,
          quantidade: qty,
          unidade: ing.unidade,
          preco_unitario: unitPrice,
          preco_total: totalPrice,
          fornecedor: priceInfo.descricao,
          tem_preco: true
        });
        
        details.push({
          ingrediente: ing.nome,
          status: '✅',
          preco: totalPrice.toFixed(2),
          fornecedor: priceInfo.descricao
        });
      } else {
        // Ingrediente sem preço - adicionar aviso
        missingIngredients.push({
          nome: ing.nome,
          produto_base_id: ing.produto_base_id,
          quantidade: qty,
          unidade: ing.unidade,
          warning: `⚠️ Ingrediente "${ing.nome}" (ID: ${ing.produto_base_id}) não tem preço no mercado`
        });
        
        details.push({
          ingrediente: ing.nome,
          status: '⚠️',
          preco: 'N/A',
          aviso: `Sem preço cadastrado (ID: ${ing.produto_base_id})`
        });
      }
    }
    
    // 4. Escalar para quantidade de refeições
    const scaledCost = calculatedCost * mealQuantity;
    
    // 5. Montar resposta com transparência
    const result = {
      total_cost: scaledCost,
      cost_per_meal: calculatedCost,
      has_missing_prices: missingIngredients.length > 0,
      total_ingredients: ingredients.length,
      priced_ingredients: pricedIngredients.length,
      missing_ingredients: missingIngredients.length,
      accuracy_percentage: Math.round((pricedIngredients.length / ingredients.length) * 100),
      warnings: missingIngredients.map(i => i.warning),
      missing_items: missingIngredients,
      priced_items: pricedIngredients,
      details: details,
      calculation_time_ms: Date.now() - startTime
    };
    
    // Log para debug
    if (missingIngredients.length > 0) {
      console.warn(`⚠️ Receita ${recipeId} tem ${missingIngredients.length} ingredientes sem preço:`, 
        missingIngredients.map(i => i.nome).join(', ')
      );
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Erro ao calcular custo da receita ${recipeId}:`, error);
    throw error;
  }
}

// Funções auxiliares
function convertToStandardUnit(quantidade: number, unidade: string): number {
  const qty = parseFloat(String(quantidade)) || 0;
  const unit = (unidade || '').toUpperCase();
  
  const conversions: { [key: string]: number } = {
    'GR': 0.001, 'G': 0.001, 'GRAMA': 0.001, 'GRAMAS': 0.001,
    'ML': 0.001, 'L': 1, 'LITRO': 1,
    'KG': 1, 'KILO': 1, 'QUILO': 1,
    'UN': 0.1, 'UND': 0.1, 'UNIDADE': 0.1
  };
  
  return qty * (conversions[unit] || 1);
}

function convertPriceToKg(preco: number, unidade: string): number {
  const unit = (unidade || '').toUpperCase();
  
  if (unit.includes('500G')) return preco * 2;
  if (unit.includes('250G')) return preco * 4;
  if (unit.includes('100G')) return preco * 10;
  
  return preco;
}

function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  const { client_data, meal_quantity = 50 } = processedData;
  const startTime = Date.now();
  
  try {
    console.log(`🍽️ Gerando cardápio para ${client_data.nome} (${meal_quantity} refeições)`);
    
    // 1. Buscar receitas disponíveis (sem filtrar por custo_total)
    const recipes = await fetchAvailableRecipes();
    
    console.log(`📚 ${recipes.length} receitas encontradas no banco`);
    
    if (recipes.length === 0) {
      throw new Error('Nenhuma receita encontrada no banco de dados');
    }

    // 2. Calcular custos reais e filtrar por orçamento
    const recipesWithRealCosts = [];
    const recipesWithWarnings = [];
    
    for (const recipe of recipes.slice(0, 50)) { // Processar até 50 receitas
      try {
        const costData = await calculateRecipeCostWithWarnings(recipe.receita_id_legado, 1);
        
        // Adicionar receita com dados de custo
        const recipeWithCost = {
          ...recipe,
          custo_calculado: costData.cost_per_meal,
          custo_total_quantidade: costData.total_cost * meal_quantity,
          tem_ingredientes_sem_preco: costData.has_missing_prices,
          precisao_custo: costData.accuracy_percentage,
          avisos: costData.warnings,
          ingredientes_sem_preco: costData.missing_items,
          detalhes_custo: costData.details
        };
        
        // Classificar receita
        if (costData.cost_per_meal <= client_data.custo_maximo_refeicao) {
          if (costData.has_missing_prices) {
            // Receita dentro do orçamento MAS com avisos
            recipesWithWarnings.push(recipeWithCost);
          } else {
            // Receita perfeita - dentro do orçamento e com todos os preços
            recipesWithRealCosts.push(recipeWithCost);
          }
        }
      } catch (error) {
        console.warn(`Erro ao calcular custo da receita ${recipe.nome_receita}:`, error);
        continue;
      }
    }
    
    console.log(`✅ ${recipesWithRealCosts.length} receitas com custos completos`);
    console.log(`⚠️ ${recipesWithWarnings.length} receitas com ingredientes sem preço`);
    
    // 3. Selecionar receitas para o cardápio (priorizar completas, mas incluir com avisos se necessário)
    const selectedRecipes = [];
    const targetCount = 6;
    
    // Primeiro, adicionar receitas com custos completos
    const completeRecipesByCategory = groupByCategory(recipesWithRealCosts);
    for (const category in completeRecipesByCategory) {
      if (selectedRecipes.length >= targetCount) break;
      if (completeRecipesByCategory[category].length > 0) {
        selectedRecipes.push(completeRecipesByCategory[category][0]);
      }
    }
    
    // Se precisar, completar com receitas que têm avisos
    if (selectedRecipes.length < targetCount) {
      const warningRecipesByCategory = groupByCategory(recipesWithWarnings);
      for (const category in warningRecipesByCategory) {
        if (selectedRecipes.length >= targetCount) break;
        const recipe = warningRecipesByCategory[category][0];
        if (!selectedRecipes.find(r => r.receita_id_legado === recipe.receita_id_legado)) {
          selectedRecipes.push(recipe);
        }
      }
    }
    
    console.log(`🍴 ${selectedRecipes.length} receitas selecionadas para o cardápio`);
    
    // 4. Calcular totais e gerar lista de compras
    let totalCost = 0;
    const shoppingList = new Map();
    const allWarnings = [];
    
    for (const recipe of selectedRecipes) {
      const costData = await calculateRecipeCostWithWarnings(recipe.receita_id_legado, meal_quantity);
      totalCost += costData.total_cost;
      
      // Adicionar avisos ao resumo geral
      if (costData.warnings.length > 0) {
        allWarnings.push({
          receita: recipe.nome_receita,
          avisos: costData.warnings
        });
      }
      
      // Processar lista de compras (apenas ingredientes com preço)
      for (const item of costData.priced_items || []) {
        const key = item.nome;
        if (shoppingList.has(key)) {
          const existing = shoppingList.get(key);
          existing.quantidade += item.quantidade * meal_quantity;
          existing.preco_total += item.preco_total * meal_quantity;
        } else {
          shoppingList.set(key, {
            nome: item.nome,
            quantidade: item.quantidade * meal_quantity,
            unidade: item.unidade,
            preco_total: item.preco_total * meal_quantity,
            fornecedor: item.fornecedor
          });
        }
      }
    }
    
    // 5. Formatar para compatibilidade com frontend
    const weekDays = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
    const cardapioFormatted = weekDays.map((dia, index) => ({
      dia,
      receitas: selectedRecipes.slice(index, index + 1).map(recipe => ({
        nome: recipe.nome_receita || recipe.nome,
        categoria: recipe.categoria_descricao || recipe.categoria_receita || 'Prato Principal',
        custo_total: recipe.custo_calculado * meal_quantity,
        receita_id: recipe.receita_id_legado || recipe.id,
        tempo_preparo: recipe.tempo_preparo || 30,
        porcoes: recipe.porcoes || recipe.quantidade_refeicoes || 1,
        precisao_custo: `${recipe.precisao_custo}%`,
        tem_avisos: recipe.tem_ingredientes_sem_preco
      }))
    })).filter(day => day.receitas.length > 0);

    const costPerMeal = totalCost / (meal_quantity * selectedRecipes.length);
    
    console.log(`✅ Cardápio gerado em ${Date.now() - startTime}ms: {
  recipes: ${selectedRecipes.length},
  total_cost: "${totalCost.toFixed(2)}",
  cost_per_meal: "${costPerMeal.toFixed(2)}",
  shopping_items: ${shoppingList.size},
  warnings: ${allWarnings.length}
}`);

    return {
      success: true,
      recipes: selectedRecipes,
      menu: {
        cardapio: cardapioFormatted
      },
      shopping_list: Array.from(shoppingList.values()),
      total_cost: totalCost,
      cost_per_meal: costPerMeal,
      client_name: client_data.nome,
      meal_quantity,
      generation_time_ms: Date.now() - startTime,
      avisos_importantes: allWarnings.length > 0 ? allWarnings : null,
      resumo_financeiro: {
        custo_total_calculado: totalCost.toFixed(2),
        custo_medio_por_refeicao: costPerMeal.toFixed(2),
        observacao: allWarnings.length > 0 ? 
          '⚠️ ATENÇÃO: Alguns ingredientes não possuem preço cadastrado. O custo real pode ser maior.' : 
          '✅ Todos os ingredientes possuem preços cadastrados.'
      }
    };

  } catch (error) {
    console.error('❌ Erro ao gerar cardápio com custos dinâmicos:', error);
    return {
      success: false,
      error: error.message || 'Erro interno na geração do cardápio'
    };
  }
}

// Função auxiliar para agrupar receitas por categoria
function groupByCategory(recipes: any[]): { [key: string]: any[] } {
  const groups: { [key: string]: any[] } = {};
  for (const recipe of recipes) {
    const cat = recipe.categoria_descricao || recipe.categoria_receita || 'Outros';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(recipe);
  }
  return groups;
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