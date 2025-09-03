
export interface Client {
  id: string;
  name: string;
  budget: number;
  employees: number;
  restrictions: string[];
  active: boolean;
  contractStart: string;
  contractEnd: string;
}

// Database contract client interface
export interface ContractClient {
  id: string;
  cliente_id_legado: string;
  nome_empresa: string;
  total_funcionarios: number;
  custo_maximo_refeicao: number;
  total_refeicoes_mes: number;
  restricoes_alimentares: string[];
  periodicidade: string;
  ativo: boolean;
  created_at: string;
  sync_at: string;
  // Configurações de sucos
  use_pro_mix?: boolean;
  use_pro_vita?: boolean;
  use_suco_diet?: boolean;
  use_suco_natural?: boolean;
}

// Base interface for ingredients with market connection
export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  produto_base_id?: number; // Connection to produtos_base table
  cost?: number; // Cost from produtos_base
  category?: string;
}

// Enhanced MenuItem for different audiences
export interface MenuItem {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'vegetable' | 'fruit' | 'dairy' | 'other';
  description?: string;
  nutritionalInfo: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  cost: number; // Total cost for nutritionist view
  costPerServing?: number; // Cost per serving
  restrictions: string[];
  prepTime?: number;
  instructions?: string; // Detailed for kitchen
  ingredients?: Ingredient[];
  difficulty?: string;
  servings?: number;
  allergens?: string[];
  substitutions?: string[];
}

// Specific interfaces for each menu type
export interface NutritionistMenuItem extends MenuItem {
  detailedCost: {
    totalCost: number;
    costBreakdown: Array<{
      ingredient: string;
      cost: number;
      percentage: number;
    }>;
    profitMargin?: number;
  };
  nutritionalAnalysis: {
    isBalanced: boolean;
    recommendations: string[];
    dietaryCompliance: string[];
  };
}

export interface KitchenMenuItem extends MenuItem {
  preparationSteps: Array<{
    step: number;
    instruction: string;
    timeMinutes: number;
    equipment?: string[];
  }>;
  ingredientsInGrams: Array<{
    name: string;
    weightInGrams: number;
    produto_base_id: number;
    preparation?: string; // e.g., "chopped", "diced"
  }>;
  cookingTips: string[];
  yieldInformation: {
    expectedYield: number;
    servingSize: string;
    wastePercentage?: number;
  };
}

export interface ClientMenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  nutritionalHighlights: {
    calories: number;
    healthBenefits: string[];
  };
  allergenInfo: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
}

export interface Menu {
  id: string;
  clientId: string;
  name: string;
  week: string;
  items: MenuItem[];
  totalCost: number;
  createdAt: string;
  versions: {
    nutritionist: NutritionistMenuItem[];
    kitchen: KitchenMenuItem[];
    client: ClientMenuItem[];
  };
  marketConnection: {
    totalProductsBase: number;
    connectedIngredients: number;
    missingConnections: string[];
  };
}

// New interface for product requests
export interface ProductRequest {
  solicitacao_id?: number; // Agora é opcional
  solicitacao_produto_listagem_id?: number;
  solicitacao_produto_categoria_id?: number;
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
  apenas_valor_inteiro_sim_nao?: boolean;
  em_promocao_sim_nao?: boolean;
  produto_base_quantidade_embalagem?: number;
}

// Legacy product interface
export interface LegacyProduct {
  id: string;
  produto_id_legado: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  peso_unitario: number;
  preco_unitario: number;
  disponivel: boolean;
  sync_at: string;
  created_at: string;
}

export interface ShoppingListItem {
  ingredient: string;
  quantity: number;
  unit: string;
  supplier: string;
  cost: number;
  alternatives?: string[];
}

export interface DatabaseShoppingList {
  id: string;
  menu_id: string;
  client_name: string;
  status: 'pending' | 'budget_ok' | 'budget_exceeded' | 'finalized';
  budget_predicted: number;
  cost_actual: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseShoppingListItem {
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
  created_at: string;
}

export interface Report {
  id: string;
  clientId: string;
  period: string;
  budgetUsed: number;
  wasteReduction: number;
  menuAcceptance: number;
  totalSavings: number;
}
