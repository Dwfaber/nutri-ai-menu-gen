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
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'vegetable' | 'fruit' | 'dairy' | 'other';
  nutritionalInfo: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  cost: number;
  restrictions: string[];
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
    nutritionist: MenuItem[];
    kitchen: MenuItem[];
    client: MenuItem[];
  };
}

// New interface for product requests
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
  apenas_valor_inteiro?: boolean;
  em_promocao?: boolean;
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
