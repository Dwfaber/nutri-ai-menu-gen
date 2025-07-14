
import { useState } from 'react';
import { Plus, Search, Filter, ShoppingCart, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SupplierGroup from '../components/ShoppingList/SupplierGroup';
import AdaptationPanel from '../components/LegacyAdaptation/AdaptationPanel';
import { ShoppingListItem } from '../types/client';

const Compras = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Mock data - será substituído por dados reais
  const mockShoppingItems: ShoppingListItem[] = [
    {
      ingredient: 'Frango Peito s/ Osso',
      quantity: 25,
      unit: 'kg',
      cost: 312.50,
      supplier: 'Distribuidora São Paulo',
      alternatives: ['Frango Inteiro', 'Frango Coxa']
    },
    {
      ingredient: 'Arroz Integral',
      quantity: 15,
      unit: 'kg',
      cost: 72.00,
      supplier: 'Distribuidora São Paulo',
      alternatives: ['Arroz Branco', 'Arroz Parboilizado']
    },
    {
      ingredient: 'Brócolis Congelado',
      quantity: 8,
      unit: 'kg',
      cost: 71.20,
      supplier: 'Verde Campo Ltda',
      alternatives: ['Brócolis Fresh', 'Couve-flor']
    },
    {
      ingredient: 'Óleo de Girassol',
      quantity: 2,
      unit: 'l',
      cost: 18.90,
      supplier: 'Verde Campo Ltda',
      alternatives: ['Óleo de Soja', 'Óleo de Canola']
    }
  ];

  // Agrupar por fornecedor
  const groupedBySupplier = mockShoppingItems.reduce((acc, item) => {
    if (!acc[item.supplier]) {
      acc[item.supplier] = [];
    }
    acc[item.supplier].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  const totalCost = mockShoppingItems.reduce((sum, item) => sum + item.cost, 0);

  const handleItemUpdate = (item: ShoppingListItem) => {
    console.log('Item updated:', item);
    // Implementar lógica de atualização
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sistema de Compras</h1>
          <p className="text-gray-600">Gerencie listas de compras e adaptação do sistema legado</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Lista
        </Button>
      </div>

      <Tabs defaultValue="shopping" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="shopping">Listas de Compras</TabsTrigger>
          <TabsTrigger value="adaptation">Adaptação do Sistema</TabsTrigger>
        </TabsList>
        
        <TabsContent value="shopping" className="space-y-6">
          {/* Header com estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total de Itens</p>
                    <p className="text-2xl font-bold">{mockShoppingItems.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Custo Total</p>
                  <p className="text-2xl font-bold text-green-600">R$ {totalCost.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fornecedores</p>
                  <p className="text-2xl font-bold">{Object.keys(groupedBySupplier).length}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <Badge variant="outline" className="mt-1 text-amber-600">
                    Pendente
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="flex space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar ingredientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>

          {/* Lista agrupada por fornecedor */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Lista de Compras por Fornecedor</h3>
            {Object.entries(groupedBySupplier).map(([supplier, items]) => (
              <SupplierGroup
                key={supplier}
                supplier={supplier}
                items={items}
                onItemUpdate={handleItemUpdate}
              />
            ))}
          </div>

          {/* Ações */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">Finalizar Compras</h4>
                  <p className="text-sm text-gray-600">
                    Total: R$ {totalCost.toFixed(2)} | {mockShoppingItems.length} itens
                  </p>
                </div>
                <div className="space-x-2">
                  <Button variant="outline">
                    Exportar PDF
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700">
                    Enviar para Fornecedores
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="adaptation">
          <AdaptationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Compras;
