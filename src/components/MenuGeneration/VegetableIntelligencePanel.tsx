import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Leaf, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Zap, 
  RotateCcw,
  Sparkles,
  ChefHat
} from 'lucide-react';
import { useVegetableIntelligence } from '@/hooks/useVegetableIntelligence';
import { type VegetableInfo } from '@/utils/vegetablesCategorization';

interface VegetableIntelligencePanelProps {
  onSelectVegetables: (vegetables: VegetableInfo[]) => void;
  selectedVegetables?: VegetableInfo[];
  budget?: 'low' | 'medium' | 'high';
  className?: string;
}

export const VegetableIntelligencePanel: React.FC<VegetableIntelligencePanelProps> = ({
  onSelectVegetables,
  selectedVegetables = [],
  budget = 'medium',
  className = ''
}) => {
  const {
    marketVegetables,
    analysis,
    isLoading,
    error,
    generateRecommendations,
    getVegetablesByCategory,
    checkSeasonality,
    suggestSubstitutions
  } = useVegetableIntelligence();

  const [activeRecommendations, setActiveRecommendations] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Gerar recomendações
  const handleGenerateRecommendations = () => {
    const usedNames = selectedVegetables.map(v => v.name);
    const recommendations = generateRecommendations(
      ['A', 'C', 'Ferro', 'Folato'], // nutrientes alvo
      budget,
      usedNames
    );
    setActiveRecommendations(recommendations);
  };

  // Aplicar recomendações
  const handleApplyRecommendations = (vegetables: VegetableInfo[]) => {
    onSelectVegetables([...selectedVegetables, ...vegetables]);
  };

  // Obter cor da sazonalidade
  const getSeasonalityColor = (vegetable: VegetableInfo) => {
    const status = checkSeasonality(vegetable.name);
    switch (status) {
      case 'peak': return 'bg-green-100 text-green-800 border-green-200';
      case 'available': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'out_of_season': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Obter ícone de categoria
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      folhosas: <Leaf className="h-4 w-4" />,
      raizes_tuberculos: <TrendingUp className="h-4 w-4" />,
      frutos: <Sparkles className="h-4 w-4" />,
      bulbos: <RotateCcw className="h-4 w-4" />,
      aromaticas: <ChefHat className="h-4 w-4" />,
      brassicas: <Leaf className="h-4 w-4" />
    };
    return icons[category] || <Leaf className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Analisando verduras e legumes disponíveis...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert>
            <AlertDescription>
              Erro ao carregar sistema de verduras: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const categories = ['all', 'folhosas', 'raizes_tuberculos', 'frutos', 'bulbos', 'aromaticas', 'brassicas'];
  const filteredVegetables = selectedCategory === 'all' 
    ? marketVegetables 
    : getVegetablesByCategory(selectedCategory);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-600" />
            Sistema Inteligente de Verduras
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {analysis?.totalVegetables || 0} disponíveis
            </Badge>
            <Button
              size="sm"
              onClick={handleGenerateRecommendations}
              className="bg-green-600 hover:bg-green-700"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Sugerir
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Análise Rápida */}
        {analysis && (
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-green-50 rounded-lg border">
              <Calendar className="h-4 w-4 mx-auto text-green-600 mb-1" />
              <div className="text-sm font-medium">{analysis.seasonal.length}</div>
              <div className="text-xs text-muted-foreground">Da época</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg border">
              <DollarSign className="h-4 w-4 mx-auto text-blue-600 mb-1" />
              <div className="text-sm font-medium">{analysis.byPriceRange.budget || 0}</div>
              <div className="text-xs text-muted-foreground">Econômicos</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg border">
              <Zap className="h-4 w-4 mx-auto text-purple-600 mb-1" />
              <div className="text-sm font-medium">{Object.keys(analysis.byCategory).length}</div>
              <div className="text-xs text-muted-foreground">Categorias</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg border">
              <TrendingUp className="h-4 w-4 mx-auto text-orange-600 mb-1" />
              <div className="text-sm font-medium">{analysis.nutritionalCoverage.length}</div>
              <div className="text-xs text-muted-foreground">Nutrientes</div>
            </div>
          </div>
        )}

        <Tabs defaultValue="browse" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="browse">Explorar</TabsTrigger>
            <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
            <TabsTrigger value="rotation">Rotatividade</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            {/* Filtros por Categoria */}
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <Button
                  key={category}
                  size="sm"
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  className="flex items-center gap-1"
                >
                  {category !== 'all' && getCategoryIcon(category)}
                  {category === 'all' ? 'Todos' : category.replace('_', ' ')}
                </Button>
              ))}
            </div>

            {/* Lista de Verduras */}
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
              {filteredVegetables.map(vegetable => (
                <div
                  key={vegetable.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getCategoryIcon(vegetable.category)}
                    <div>
                      <div className="font-medium text-sm">{vegetable.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {vegetable.category.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={getSeasonalityColor(vegetable)}
                    >
                      {checkSeasonality(vegetable.name) === 'peak' ? '🌟' : 
                       checkSeasonality(vegetable.name) === 'available' ? '✓' : '❄️'}
                    </Badge>
                    
                    <Badge variant="outline">
                      {vegetable.priceCategory}
                    </Badge>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyRecommendations([vegetable])}
                      disabled={selectedVegetables.some(s => s.id === vegetable.id)}
                    >
                      {selectedVegetables.some(s => s.id === vegetable.id) ? 'Selecionado' : 'Adicionar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            {activeRecommendations ? (
              <div className="space-y-4">
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription>
                    {activeRecommendations.reasoning}
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Recomendações Principais</h4>
                  {activeRecommendations.recommended.map((veg: VegetableInfo) => (
                    <div key={veg.id} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(veg.category)}
                        <span className="text-sm font-medium">{veg.name}</span>
                        <Badge variant="outline" className={getSeasonalityColor(veg)}>
                          {checkSeasonality(veg.name) === 'peak' ? 'Da época' : 'Disponível'}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApplyRecommendations([veg])}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Alternativas</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {activeRecommendations.alternatives.slice(0, 4).map((veg: VegetableInfo) => (
                      <div key={veg.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <span>{veg.name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplyRecommendations([veg])}
                        >
                          +
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => handleApplyRecommendations(activeRecommendations.recommended)}
                  className="w-full"
                >
                  Aplicar Todas as Recomendações
                </Button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div>Clique em "Sugerir" para obter recomendações inteligentes</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="rotation" className="space-y-4">
            {activeRecommendations?.weeklyRotation ? (
              <div className="space-y-3">
                {Object.entries(activeRecommendations.weeklyRotation as Record<string, VegetableInfo[]>).map(([day, vegetables]) => (
                  <div key={day} className="p-3 border rounded-lg">
                    <div className="font-medium text-sm mb-2 capitalize">{day}-feira</div>
                    <div className="flex flex-wrap gap-1">
                      {vegetables.map((veg: VegetableInfo) => (
                        <Badge key={veg.id} variant="outline" className="text-xs">
                          {veg.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div>Generate recomendações para ver a rotatividade semanal</div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};