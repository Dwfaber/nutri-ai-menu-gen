import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ChefHat, 
  Leaf, 
  Calculator, 
  Clock, 
  TrendingUp,
  Sparkles,
  CheckCircle,
  Grape
} from 'lucide-react';
import { VegetableIntelligencePanel } from './VegetableIntelligencePanel';
import { IngredientSuggestionsPanel } from './IngredientSuggestionsPanel';
import { SimpleMenuForm } from './SimpleMenuForm';
import { JuiceMenuDisplay } from './JuiceMenuDisplay';
import { useSimplifiedMenuGeneration } from '@/hooks/useSimplifiedMenuGeneration';
import { useVegetableIntelligence } from '@/hooks/useVegetableIntelligence';
import { useJuiceConfiguration } from '@/hooks/useJuiceConfiguration';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { type VegetableInfo } from '@/utils/vegetablesCategorization';

interface EnhancedMenuGeneratorProps {
  clientData?: any;
  onMenuGenerated?: (menu: any) => void;
  className?: string;
}

export const EnhancedMenuGenerator: React.FC<EnhancedMenuGeneratorProps> = ({
  clientData,
  onMenuGenerated,
  className = ''
}) => {
  const [selectedVegetables, setSelectedVegetables] = useState<VegetableInfo[]>([]);
  const [generationSettings, setGenerationSettings] = useState({
    budget: 'medium' as 'low' | 'medium' | 'high',
    nutritionalFocus: ['A', 'C', 'Ferro', 'Folato'],
    includeVegetableRotation: true,
    optimizeForSeason: true
  });
  const [juiceSettings, setJuiceSettings] = useState({
    use_pro_mix: false,
    use_pro_vita: false,
    use_suco_diet: false,
    use_suco_natural: true
  });

  const { selectedClient } = useSelectedClient();
  const { updateClientJuiceConfig } = useJuiceConfiguration();

  const {
    isGenerating,
    generatedMenu,
    error: menuError,
    progress,
    generateMenu,
    clearGeneratedMenu,
    clearError
  } = useSimplifiedMenuGeneration();

  const {
    analysis: vegetableAnalysis,
    generateRecommendations
  } = useVegetableIntelligence();

  // Gerar cardápio com inteligência de verduras e sucos
  const handleEnhancedGeneration = async (formData: any) => {
    try {
      // Aplicar recomendações de verduras se habilitado
      if (generationSettings.includeVegetableRotation && selectedVegetables.length > 0) {
        const vegetableNames = selectedVegetables.map(v => v.name);
        formData.preferredIngredients = [
          ...(formData.preferredIngredients || []),
          ...vegetableNames
        ];
      }

      // Adicionar preferências nutricionais
      if (generationSettings.nutritionalFocus.length > 0) {
        formData.nutritionalRequirements = generationSettings.nutritionalFocus;
      }

      // Adicionar configurações de sucos
      formData.juiceConfig = juiceSettings;

      // Atualizar configuração de sucos no cliente se necessário
      if (selectedClient?.id) {
        await updateClientJuiceConfig(selectedClient.id, juiceSettings);
      }

      // Gerar cardápio
      const menu = await generateMenu(
        formData.clientData,
        formData.period,
        formData.mealQuantity,
        formData.restrictions || [],
        formData.preferences || [],
        juiceSettings
      );

      if (menu && onMenuGenerated) {
        onMenuGenerated(menu);
      }
    } catch (error) {
      console.error('Erro na geração do cardápio:', error);
    }
  };

  // Aplicar recomendações automáticas
  const handleApplyAutoRecommendations = () => {
    if (vegetableAnalysis) {
      const recommendations = generateRecommendations(
        generationSettings.nutritionalFocus,
        generationSettings.budget
      );
      setSelectedVegetables(recommendations.recommended);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header com Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              Gerador de Cardápios Inteligente
            </div>
            <div className="flex items-center gap-2">
              {vegetableAnalysis && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Leaf className="h-3 w-3" />
                  {vegetableAnalysis.totalVegetables} verduras disponíveis
                </Badge>
              )}
              {selectedVegetables.length > 0 && (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {selectedVegetables.length} selecionadas
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="setup">Configuração</TabsTrigger>
              <TabsTrigger value="vegetables">Verduras IA</TabsTrigger>
              <TabsTrigger value="generate">Gerar</TabsTrigger>
              <TabsTrigger value="results">Resultados</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Configurações de Geração</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Orçamento</label>
                      <div className="flex gap-2 mt-1">
                        {['low', 'medium', 'high'].map(budget => (
                          <Button
                            key={budget}
                            size="sm"
                            variant={generationSettings.budget === budget ? "default" : "outline"}
                            onClick={() => setGenerationSettings(prev => ({ ...prev, budget: budget as any }))}
                          >
                            {budget === 'low' ? 'Baixo' : budget === 'medium' ? 'Médio' : 'Alto'}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Foco Nutricional</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {['A', 'C', 'Ferro', 'Folato', 'Cálcio', 'Potássio'].map(nutrient => (
                          <Badge
                            key={nutrient}
                            variant={generationSettings.nutritionalFocus.includes(nutrient) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setGenerationSettings(prev => ({
                              ...prev,
                              nutritionalFocus: prev.nutritionalFocus.includes(nutrient)
                                ? prev.nutritionalFocus.filter(n => n !== nutrient)
                                : [...prev.nutritionalFocus, nutrient]
                            }))}
                          >
                            {nutrient}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Configuração de Sucos</label>
                      <div className="space-y-2 mt-1">
                        {[
                          { key: 'use_pro_mix', label: 'Pró Mix', priority: 1 },
                          { key: 'use_pro_vita', label: 'Vita Suco', priority: 2 },
                          { key: 'use_suco_diet', label: 'Suco Diet', priority: 3 },
                          { key: 'use_suco_natural', label: 'Suco Natural', priority: 4 }
                        ].map(juice => (
                          <label key={juice.key} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={juiceSettings[juice.key as keyof typeof juiceSettings]}
                              onChange={(e) => setJuiceSettings(prev => ({
                                ...prev,
                                [juice.key]: e.target.checked
                              }))}
                              className="w-3 h-3"
                            />
                            <span className="flex-1">{juice.label}</span>
                            <Badge variant="outline" className="text-xs">#{juice.priority}</Badge>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Prioridade: menor número = maior prioridade
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Verduras e Sucos Selecionados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">VERDURAS</label>
                      {selectedVegetables.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {selectedVegetables.map(veg => (
                              <Badge key={veg.id} variant="outline" className="text-xs">
                                {veg.name}
                              </Badge>
                            ))}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedVegetables([])}
                            className="w-full"
                          >
                            Limpar Verduras
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-2">
                          <Leaf className="h-6 w-6 mx-auto mb-1 opacity-50" />
                          <div className="text-xs">Nenhuma verdura selecionada</div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleApplyAutoRecommendations}
                            className="mt-1"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Sugestões Automáticas
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground">SUCOS ATIVOS</label>
                      <div className="space-y-1">
                        {Object.entries(juiceSettings).filter(([_, active]) => active).length > 0 ? (
                          Object.entries(juiceSettings)
                            .filter(([_, active]) => active)
                            .map(([key, _]) => (
                              <Badge key={key} variant="default" className="text-xs mr-1">
                                {key === 'use_pro_mix' ? 'Pró Mix' :
                                 key === 'use_pro_vita' ? 'Vita Suco' :
                                 key === 'use_suco_diet' ? 'Diet' : 'Natural'}
                              </Badge>
                            ))
                        ) : (
                          <div className="text-xs text-muted-foreground">Nenhum suco selecionado (usará Natural)</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="vegetables">
              <VegetableIntelligencePanel
                onSelectVegetables={setSelectedVegetables}
                selectedVegetables={selectedVegetables}
                budget={generationSettings.budget}
              />
            </TabsContent>

            <TabsContent value="generate">
              <SimpleMenuForm
                onSubmit={handleEnhancedGeneration}
                onCancel={clearError}
                isGenerating={isGenerating}
                error={menuError}
              />
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {generatedMenu ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Cardápio gerado com sucesso! {selectedVegetables.length > 0 && 
                        `Incluindo ${selectedVegetables.length} verduras selecionadas.`}
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Calculator className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                        <div className="font-medium">Custo Total</div>
                        <div className="text-lg font-bold text-blue-600">
                          R$ {generatedMenu.totalCost.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-600" />
                        <div className="font-medium">Por Refeição</div>
                        <div className="text-lg font-bold text-green-600">
                          R$ {generatedMenu.costPerMeal.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Clock className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                        <div className="font-medium">Receitas</div>
                        <div className="text-lg font-bold text-purple-600">
                          {generatedMenu.totalRecipes}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {generatedMenu.recipes && generatedMenu.recipes.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Receitas Geradas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {generatedMenu.recipes.map((receita: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded">
                              <span className="text-sm font-medium">{receita.nome || receita.name || `Receita ${index + 1}`}</span>
                              <Badge variant="outline">
                                {receita.categoria || receita.category || 'Indefinida'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {generatedMenu.juiceMenu && generatedMenu.juiceMenu.cardapio_semanal && generatedMenu.juiceMenu.cardapio_semanal.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Grape className="h-4 w-4 text-purple-600" />
                          Cardápio de Sucos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <JuiceMenuDisplay juiceConfig={generatedMenu.juiceMenu} />
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={clearGeneratedMenu}
                      className="flex-1"
                    >
                      Novo Cardápio
                    </Button>
                    {onMenuGenerated && (
                      <Button
                        onClick={() => onMenuGenerated(generatedMenu)}
                        className="flex-1"
                      >
                        Aprovar Cardápio
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <ChefHat className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <div className="text-lg font-medium mb-2">Nenhum cardápio gerado ainda</div>
                  <div className="text-sm">Configure as opções e gere um cardápio na aba "Gerar"</div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Erros */}
      {menuError && (
        <Alert>
          <AlertDescription>
            Erro na geração: {menuError}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};