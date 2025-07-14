
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

export interface ShoppingListItem {
  ingredient: string;
  quantity: number;
  unit: string;
  supplier: string;
  cost: number;
  alternatives?: string[];
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
