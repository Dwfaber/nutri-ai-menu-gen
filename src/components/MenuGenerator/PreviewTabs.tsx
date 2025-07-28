
import { useState } from 'react';
import { Menu, MenuItem } from '../../types/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PreviewTabsProps {
  menu: Menu;
}

const PreviewTabs = ({ menu }: PreviewTabsProps) => {
  const renderMenuItems = (items: MenuItem[], version: string) => {
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
          <Card key={`${version}-${item.id || index}`} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{item.name}</CardTitle>
                {version === 'nutritionist' && item.cost && (
                  <Badge variant="outline" className="text-green-600">
                    R$ {item.cost.toFixed(2)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Version-specific content */}
              {version === 'nutritionist' && (
                <>
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
                  {item.restrictions && item.restrictions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {item.restrictions.map((restriction, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {restriction}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}

              {version === 'kitchen' && (
                <>
                  <div className="space-y-3">
                    {item.prepTime && (
                      <div>
                        <span className="font-medium text-gray-600">Tempo de Preparo:</span>
                        <p className="text-gray-900">{item.prepTime} minutos</p>
                      </div>
                    )}
                    {item.instructions && (
                      <div>
                        <span className="font-medium text-gray-600">Instruções:</span>
                        <p className="text-gray-900 text-sm mt-1">{item.instructions}</p>
                      </div>
                    )}
                    {item.ingredients && item.ingredients.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">Ingredientes:</span>
                        <ul className="text-sm text-gray-700 mt-1 space-y-1">
                          {item.ingredients.slice(0, 5).map((ing, idx) => (
                            <li key={idx}>• {ing.name} - {ing.quantity}{ing.unit}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}

              {version === 'client' && (
                <>
                  <div className="space-y-2">
                    {item.description && (
                      <p className="text-gray-700">{item.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="inline-flex items-center">
                        <span className="font-medium text-gray-600">Categoria:</span>
                        <Badge variant="outline" className="ml-2">{item.category}</Badge>
                      </span>
                      {item.nutritionalInfo?.calories && (
                        <span className="text-gray-600">
                          {item.nutritionalInfo.calories} kcal
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
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
        {renderMenuItems(menu.versions.nutritionist, 'nutritionist')}
      </TabsContent>
      
      <TabsContent value="kitchen" className="mt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Versão Prática - Cozinha</h3>
          <p className="text-sm text-gray-600">Instruções de preparo e informações operacionais</p>
        </div>
        {renderMenuItems(menu.versions.kitchen, 'kitchen')}
      </TabsContent>
      
      <TabsContent value="client" className="mt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Versão Simplificada - Cliente</h3>
          <p className="text-sm text-gray-600">Apresentação atrativa para os funcionários</p>
        </div>
        {renderMenuItems(menu.versions.client, 'client')}
      </TabsContent>
    </Tabs>
  );
};

export default PreviewTabs;
