
import { useState } from 'react';
import { Download, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SupplierGroup from '../components/ShoppingList/SupplierGroup';
import { ShoppingListItem } from '../types/client';

const Compras = () => {
  const [groupBy, setGroupBy] = useState<'supplier' | 'category'>('supplier');

  // Mock shopping list data
  const mockShoppingList: ShoppingListItem[] = [
    {
      ingredient: 'Frango (Peito)',
      quantity: 25,
      unit: 'kg',
      supplier: 'Fornecedor A - Carnes',
      cost: 187.50,
      alternatives: ['Frango Orgânico', 'Frango Caipira']
    },
    {
      ingredient: 'Quinoa',
      quantity: 5,
      unit: 'kg',
      supplier: 'Fornecedor B - Grãos',
      cost: 75.00
    },
    {
      ingredient: 'Salmão',
      quantity: 15,
      unit: 'kg',
      supplier: 'Fornecedor C - Peixes',
      cost: 450.00,
      alternatives: ['Tilápia', 'Bacalhau']
    },
    {
      ingredient: 'Batata Doce',
      quantity: 20,
      unit: 'kg',
      supplier: 'Fornecedor D - Vegetais',
      cost: 60.00
    },
    {
      ingredient: 'Azeite Extra Virgem',
      quantity: 3,
      unit: 'L',
      supplier: 'Fornecedor B - Grãos',
      cost: 45.00
    }
  ];

  const groupedItems = mockShoppingList.reduce((groups, item) => {
    const key = groupBy === 'supplier' ? item.supplier : item.ingredient.split(' ')[0];
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, ShoppingListItem[]>);

  const totalCost = mockShoppingList.reduce((sum, item) => sum + item.cost, 0);

  const handleItemUpdate = (item: ShoppingListItem) => {
    // Handle item updates
    console.log('Updating item:', item);
  };

  const handleOptimize = () => {
    // Handle list optimization
    console.log('Optimizing shopping list...');
  };

  const handleExport = () => {
    // Handle CSV export
    console.log('Exporting to CSV...');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lista de Compras</h1>
          <p className="text-gray-600">Listas otimizadas por fornecedor e categoria</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleOptimize}>
            <Shuffle className="w-4 h-4 mr-2" />
            Otimizar
          </Button>
          <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-sm text-gray-600">Total de Itens</p>
            <p className="text-xl font-bold text-gray-900">{mockShoppingList.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Custo Total</p>
            <p className="text-xl font-bold text-green-600">R$ {totalCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fornecedores</p>
            <p className="text-xl font-bold text-gray-900">{Object.keys(groupedItems).length}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Agrupar por:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'supplier' | 'category')}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="supplier">Fornecedor</option>
            <option value="category">Categoria</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedItems).map(([group, items]) => (
          <SupplierGroup
            key={group}
            supplier={group}
            items={items}
            onItemUpdate={handleItemUpdate}
          />
        ))}
      </div>
    </div>
  );
};

export default Compras;
