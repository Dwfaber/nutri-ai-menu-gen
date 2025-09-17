
import { useState } from 'react';
import { ShoppingListItem } from '@/types/client';
import { ChevronDown, ChevronUp, Package, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SupplierGroupProps {
  supplier: string;
  items: ShoppingListItem[];
  onItemUpdate: (item: ShoppingListItem) => void;
}

const SupplierGroup = ({ supplier, items, onItemUpdate }: SupplierGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{supplier}</CardTitle>
              <p className="text-sm text-gray-600">{items.length} itens</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="text-green-600">
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
            {items.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{item.ingredient}</h4>
                  <p className="text-sm text-gray-600">
                    {item.quantity} {item.unit}
                  </p>
                  {item.alternatives && item.alternatives.length > 0 && (
                    <div className="mt-1 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-amber-600">
                        Alternativas disponíveis
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">R$ {item.cost.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">
                    R$ {(item.cost / item.quantity).toFixed(2)}/{item.unit}
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

export default SupplierGroup;
