
import { useState } from 'react';
import { ShoppingListItem } from '@/hooks/useShoppingList';
import { ChevronDown, ChevronUp, Package, Edit3, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ShoppingListCardProps {
  category: string;
  items: ShoppingListItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
}

const ShoppingListCard = ({ category, items, onUpdateQuantity }: ShoppingListCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);

  const totalCost = items.reduce((sum, item) => sum + item.total_price, 0);

  const handleStartEdit = (item: ShoppingListItem) => {
    setEditingItem(item.id);
    setEditQuantity(item.quantity);
  };

  const handleSaveEdit = (itemId: string) => {
    onUpdateQuantity(itemId, editQuantity);
    setEditingItem(null);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditQuantity(0);
  };

  const getCategoryIcon = (category: string) => {
    return <Package className="w-5 h-5 text-blue-600" />;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              {getCategoryIcon(category)}
            </div>
            <div>
              <CardTitle className="text-lg">{category}</CardTitle>
              <p className="text-sm text-gray-600">{items.length} itens</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="text-blue-600">
              R$ {totalCost.toFixed(2)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  item.available ? 'bg-gray-50 hover:bg-gray-100' : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">{item.product_name}</h4>
                    {!item.available && (
                      <Badge variant="destructive" className="text-xs">
                        Indisponível
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Código: {item.product_id_legado}
                  </p>
                  <div className="flex items-center space-x-4 mt-1">
                    {editingItem === item.id ? (
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(Number(e.target.value))}
                          className="w-20 h-8"
                          step="0.1"
                          min="0"
                        />
                        <span className="text-sm text-gray-600">{item.unit}</span>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(item.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="h-8 w-8 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          {item.quantity} {item.unit}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(item)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">R$ {item.total_price.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">
                    R$ {item.unit_price.toFixed(2)}/{item.unit}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ShoppingListCard;
