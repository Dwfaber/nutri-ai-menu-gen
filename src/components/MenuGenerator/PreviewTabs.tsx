
import { useState } from 'react';
import { Menu, MenuItem, NutritionistMenuItem, KitchenMenuItem, ClientMenuItem } from '../../types/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PreviewTabsProps {
  menu: Menu;
}

const PreviewTabs = ({ menu }: PreviewTabsProps) => {
  const renderNutritionistItems = (items: NutritionistMenuItem[]) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum item encontrado para esta versão do cardápio.</p>
          <p className="text-sm mt-2">Tente gerar um novo cardápio.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((item, index) => (
          <Card key={`nutritionist-${item.id || index}`} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{item.name}</CardTitle>
                {item.cost && (
                  <Badge variant="outline" className="text-green-600">
                    R$ {item.cost.toFixed(2)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <span className="font-medium text-gray-600">Calorias</span>
                  <p className="text-gray-900">{item.nutritionalInfo?.calories || 0} kcal</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Proteína</span>
                  <p className="text-gray-900">{item.nutritionalInfo?.protein || 0}g</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Carboidratos</span>
                  <p className="text-gray-900">{item.nutritionalInfo?.carbs || 0}g</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Gordura</span>
                  <p className="text-gray-900">{item.nutritionalInfo?.fat || 0}g</p>
                </div>
              </div>
              
              {/* Detailed Cost Analysis */}
              {item.detailedCost && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">Análise de Custos</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-green-600">Custo Total:</span>
                      <p className="font-medium">R$ {item.detailedCost.totalCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-green-600">Margem:</span>
                      <p className="font-medium">R$ {(item.detailedCost.profitMargin || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  {item.detailedCost.costBreakdown?.slice(0, 3).map((breakdown, idx) => (
                    <div key={idx} className="text-xs mt-1 text-green-700">
                      {breakdown.ingredient}: R$ {breakdown.cost.toFixed(2)} ({breakdown.percentage}%)
                    </div>
                  ))}
                </div>
              )}

              {/* Nutritional Analysis */}
              {item.nutritionalAnalysis && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">Análise Nutricional</h4>
                  <div className="text-sm">
                    <p className={`font-medium ${item.nutritionalAnalysis.isBalanced ? 'text-green-600' : 'text-orange-600'}`}>
                      {item.nutritionalAnalysis.isBalanced ? '✓ Balanceado' : '⚠ Requer ajustes'}
                    </p>
                    {item.nutritionalAnalysis.recommendations?.map((rec, idx) => (
                      <p key={idx} className="text-blue-700 text-xs mt-1">• {rec}</p>
                    ))}
                  </div>
                </div>
              )}

              {item.restrictions && item.restrictions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.restrictions.map((restriction, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {restriction}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderKitchenItems = (items: KitchenMenuItem[]) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum item encontrado para esta versão do cardápio.</p>
          <p className="text-sm mt-2">Tente gerar um novo cardápio.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((item, index) => (
          <Card key={`kitchen-${item.id || index}`} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{item.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Tempo de Preparo:</span>
                    <p className="text-gray-900">{item.prepTime || 30} minutos</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Rendimento:</span>
                    <p className="text-gray-900">{item.yieldInformation?.expectedYield || item.servings || 50} porções</p>
                  </div>
                </div>

                {/* Ingredients in Grams */}
                {item.ingredientsInGrams && item.ingredientsInGrams.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-600">Ingredientes (peso exato):</span>
                    <ul className="text-sm text-gray-700 mt-2 space-y-1 bg-gray-50 p-3 rounded">
                      {item.ingredientsInGrams.slice(0, 8).map((ing, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>• {ing.name} ({ing.preparation})</span>
                          <span className="font-medium">{ing.weightInGrams}g</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preparation Steps */}
                {item.preparationSteps && (
                  <div>
                    <span className="font-medium text-gray-600">Passos de Preparo:</span>
                    <ol className="text-sm text-gray-700 mt-2 space-y-2">
                      {item.preparationSteps.map((step, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="font-medium text-blue-600 min-w-[20px]">{step.step}.</span>
                          <div>
                            <p>{step.instruction}</p>
                            <p className="text-xs text-gray-500">⏱ {step.timeMinutes} min</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Cooking Tips */}
                {item.cookingTips && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                    <span className="font-medium text-yellow-800">Dicas da Cozinha:</span>
                    <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                      {item.cookingTips.slice(0, 3).map((tip, idx) => (
                        <li key={idx}>💡 {tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderClientItems = (items: ClientMenuItem[]) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum item encontrado para esta versão do cardápio.</p>
          <p className="text-sm mt-2">Tente gerar um novo cardápio.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((item, index) => (
          <Card key={`client-${item.id || index}`} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{item.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {item.description && (
                  <p className="text-gray-700 leading-relaxed">{item.description}</p>
                )}
                
                {/* Nutritional Highlights */}
                {item.nutritionalHighlights && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium text-gray-600">
                      {item.nutritionalHighlights.calories} kcal
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {item.nutritionalHighlights.healthBenefits?.slice(0, 2).map((benefit, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs bg-green-100 text-green-800">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category and Diet Info */}
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <Badge variant="outline" className="ml-0">{item.category}</Badge>
                  {item.isVegetarian && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      🌱 Vegetariano
                    </Badge>
                  )}
                  {item.isVegan && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      🌿 Vegano
                    </Badge>
                  )}
                  {item.isGlutenFree && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      ⚡ Sem Glúten
                    </Badge>
                  )}
                </div>

                {/* Allergen Info */}
                {item.allergenInfo && item.allergenInfo.length > 0 && (
                  <div className="text-xs text-gray-600 bg-orange-50 p-2 rounded border border-orange-200">
                    <span className="font-medium">⚠ Contém:</span> {item.allergenInfo.join(', ')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Tabs defaultValue="nutritionist" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="nutritionist">Nutricionista</TabsTrigger>
        <TabsTrigger value="kitchen">Cozinha</TabsTrigger>
        <TabsTrigger value="client">Cliente</TabsTrigger>
      </TabsList>
      
      <TabsContent value="nutritionist" className="mt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Versão Detalhada - Nutricionista</h3>
          <p className="text-sm text-gray-600">Informações nutricionais completas e recomendações técnicas</p>
        </div>
        {renderNutritionistItems(menu.versions.nutritionist)}
      </TabsContent>
      
      <TabsContent value="kitchen" className="mt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Versão Prática - Cozinha</h3>
          <p className="text-sm text-gray-600">Instruções de preparo e informações operacionais</p>
        </div>
        {renderKitchenItems(menu.versions.kitchen)}
      </TabsContent>
      
      <TabsContent value="client" className="mt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Versão Simplificada - Cliente</h3>
          <p className="text-sm text-gray-600">Apresentação atrativa para os funcionários</p>
        </div>
        {renderClientItems(menu.versions.client)}
      </TabsContent>
    </Tabs>
  );
};

export default PreviewTabs;
