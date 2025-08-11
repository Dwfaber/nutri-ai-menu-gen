import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Download, Copy } from 'lucide-react';

interface Ingredient {
  name: string;
  quantity?: number;
  unit?: string;
}

interface MenuRecipe {
  id: string;
  name: string;
  category: string;
  day: string;
  cost: number;
  servings: number;
  ingredients?: Ingredient[];
}

interface MenuTableProps {
  title: string;
  weekPeriod: string;
  totalCost: number;
  recipes: MenuRecipe[];
  gramWeight?: string;
  onEdit?: (recipeId: string) => void;
  onExport?: () => void;
  onCopy?: () => void;
}

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const NEW_MENU_CATEGORIES = [
  'PP1',
  'PP2', 
  'Arroz Branco',
  'Feijão',
  'Salada 1',
  'Salada 2',
  'Suco 1',
  'Suco 2'
];

const CATEGORY_DISPLAY_NAMES = {
  'PP1': 'PRATO PRINCIPAL 1',
  'PP2': 'PRATO PRINCIPAL 2',
  'Arroz Branco': 'ARROZ BRANCO',
  'Feijão': 'FEIJÃO',
  'Salada 1': 'SALADA 1 (VERDURAS)',
  'Salada 2': 'SALADA 2 (LEGUMES)',
  'Suco 1': 'SUCO 1',
  'Suco 2': 'SUCO 2',
  // Legacy support
  'Salada': 'SALADA 1',
  'Prato Principal 1': 'PP1',
  'Guarnição': 'GUARNIÇÃO', 
  'Sobremesa': 'SOBREMESA'
};

const MenuTable: React.FC<MenuTableProps> = ({
  title,
  weekPeriod,
  totalCost,
  recipes,
  gramWeight = "PADRÃO (90 GRAMAS/PORÇÃO)",
  onEdit,
  onExport,
  onCopy
}) => {
  const getRecipeForDayAndCategory = (day: string, category: string) => {
    return recipes.find(recipe => 
      recipe.day && recipe.day.toLowerCase().includes(day.toLowerCase()) && 
      recipe.category === category
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold">CARDÁPIO</CardTitle>
            <p className="text-sm text-gray-600 mt-1">GRAMAGEM: {gramWeight}</p>
            <p className="text-sm font-medium mt-2">{weekPeriod}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 font-medium">
              Total: R$ {totalCost.toFixed(2)}
            </Badge>
            <div className="flex gap-1">
              {onEdit && (
                <Button size="sm" variant="outline" onClick={() => onEdit('')}>
                  <Edit className="w-3 h-3" />
                </Button>
              )}
              {onExport && (
                <Button size="sm" variant="outline" onClick={onExport}>
                  <Download className="w-3 h-3" />
                </Button>
              )}
              {onCopy && (
                <Button size="sm" variant="outline" onClick={onCopy}>
                  <Copy className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-3 text-left font-semibold min-w-[120px]">
                  CATEGORIA
                </th>
                {DAYS.map(day => (
                  <th key={day} className="border border-gray-300 p-3 text-center font-semibold min-w-[150px]">
                    {day.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NEW_MENU_CATEGORIES.map((category, categoryIndex) => (
                <tr key={category} className={categoryIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}>
                  <td className="border border-gray-300 p-3 font-medium bg-gray-50">
                    {CATEGORY_DISPLAY_NAMES[category] || category}
                  </td>
                  {DAYS.map(day => {
                    const recipe = getRecipeForDayAndCategory(day, category);
                    return (
                      <td key={`${category}-${day}`} className="border border-gray-300 p-3 text-sm">
                        {recipe ? (
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900 leading-tight">
                              {recipe.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              R$ {recipe.cost.toFixed(2)} • {recipe.servings}p
                            </div>
                            {recipe.ingredients && recipe.ingredients.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {recipe.ingredients.slice(0, 3).map((ing, i) => (
                                  <li key={i} className="text-[11px] text-gray-500 truncate">
                                    {ing.name}
                                    {ing.quantity ? ` - ${Number(ing.quantity).toLocaleString('pt-BR')}` : ''}
                                    {ing.unit ? ` ${ing.unit}` : ''}
                                  </li>
                                ))}
                                {recipe.ingredients.length > 3 && (
                                  <li className="text-[11px] text-gray-400">+{recipe.ingredients.length - 3} ingredientes</li>
                                )}
                              </ul>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-center text-xs">
                            -
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-700">Total de Receitas:</span>
              <span className="ml-2 font-bold">{recipes.length}</span>
            </div>
            <div>
              <span className="font-medium text-blue-700">Custo por Porção:</span>
              <span className="ml-2 font-bold">R$ {(totalCost / (recipes.reduce((acc, r) => acc + r.servings, 0) || 1)).toFixed(2)}</span>
            </div>
            <div>
              <span className="font-medium text-blue-700">Porções Totais:</span>
              <span className="ml-2 font-bold">{recipes.reduce((acc, r) => acc + r.servings, 0)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MenuTable;