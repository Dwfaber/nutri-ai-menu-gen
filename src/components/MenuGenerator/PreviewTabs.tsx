
import { useState } from 'react';
import { Menu, MenuItem } from '../../types/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PreviewTabsProps {
  menu: Menu;
}

const PreviewTabs = ({ menu }: PreviewTabsProps) => {
  const renderMenuItems = (items: MenuItem[], version: string) => (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={`${version}-${item.id}`} className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg">{item.name}</CardTitle>
              <Badge variant="outline" className="text-green-600">
                R$ {item.cost.toFixed(2)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Calorias</span>
                <p className="text-gray-900">{item.nutritionalInfo.calories} kcal</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Proteína</span>
                <p className="text-gray-900">{item.nutritionalInfo.protein}g</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Carboidratos</span>
                <p className="text-gray-900">{item.nutritionalInfo.carbs}g</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Gordura</span>
                <p className="text-gray-900">{item.nutritionalInfo.fat}g</p>
              </div>
            </div>
            {item.restrictions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {item.restrictions.map((restriction) => (
                  <Badge key={restriction} variant="secondary" className="text-xs">
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
