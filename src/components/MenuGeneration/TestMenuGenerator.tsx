/**
 * Component for testing menu generation with the new local system
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSimplifiedMenuGeneration } from '@/hooks/useSimplifiedMenuGeneration';
import { MenuCalculationProgress } from './MenuCalculationProgress';
import { ChefHat, Calculator, Clock, AlertCircle, CheckCircle } from 'lucide-react';

export function TestMenuGenerator() {
  const [mealQuantity, setMealQuantity] = useState(50);
  const [period, setPeriod] = useState('semanal');
  const [restrictions, setRestrictions] = useState('');
  const [preferences, setPreferences] = useState('');
  
  const { 
    isGenerating, 
    generatedMenu, 
    error, 
    progress, 
    generateMenu, 
    clearGeneratedMenu,
    clearError 
  } = useSimplifiedMenuGeneration();

  const handleGenerateMenu = async () => {
    const clientData = {
      id: 'test-client',
      nome: 'Cliente Teste',
      orcamento_refeicao: 15.0,
      funcionarios: mealQuantity,
      restricoes_alimentares: restrictions.split(',').map(r => r.trim()).filter(Boolean),
      preferencias: preferences.split(',').map(p => p.trim()).filter(Boolean)
    };

    const restrictionsArray = restrictions.split(',').map(r => r.trim()).filter(Boolean);
    const preferencesArray = preferences.split(',').map(p => p.trim()).filter(Boolean);

    await generateMenu(clientData, period, mealQuantity, restrictionsArray, preferencesArray);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5" />
            Geração Rápida de Cardápio
          </CardTitle>
          <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-md">
            <p>⚠️ <strong>Versão Simplificada:</strong> Esta é uma demonstração rápida. 
            Para cálculos de custo precisos e recursos completos, acesse a seção 
            <strong> "Cardápios" → "Gerador Inteligente"</strong>.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mealQuantity">Quantidade de Refeições</Label>
              <Input
                id="mealQuantity"
                type="number"
                value={mealQuantity}
                onChange={(e) => setMealQuantity(Number(e.target.value))}
                min="1"
                max="1000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="period">Período</Label>
              <select 
                id="period"
                className="w-full px-3 py-2 border border-input bg-background rounded-md"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="restrictions">Restrições Alimentares (separadas por vírgula)</Label>
            <Textarea
              id="restrictions"
              placeholder="Ex: sem glúten, sem lactose, vegetariano"
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferences">Preferências (separadas por vírgula)</Label>
            <Textarea
              id="preferences"
              placeholder="Ex: comida brasileira, pratos leves, vegetais"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleGenerateMenu} 
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Gerar Cardápio Teste
                </>
              )}
            </Button>
            
            {generatedMenu && (
              <Button variant="outline" onClick={clearGeneratedMenu}>
                Limpar
              </Button>
            )}
            
            {error && (
              <Button variant="outline" onClick={clearError}>
                Limpar Erro
              </Button>
            )}
          </div>

          {error && (
            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="font-semibold">Erro na geração:</span>
              </div>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {progress && (
            <MenuCalculationProgress progress={progress} />
          )}
        </CardContent>
      </Card>

      {generatedMenu && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Cardápio Gerado com Sucesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">R$ {generatedMenu.totalCost.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Custo Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">R$ {generatedMenu.costPerMeal.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Custo por Refeição</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{generatedMenu.recipes.length}</div>
                <div className="text-sm text-muted-foreground">Receitas</div>
              </div>
            </div>

            {generatedMenu.recipes.some(recipe => recipe.ingredientes_calculados?.some((ing: any) => ing.violacao || !ing.produto_encontrado)) && (
              <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">
                  Receitas com Ingredientes Problemáticos
                </h4>
                <p className="text-sm text-yellow-700">
                  Algumas receitas contêm ingredientes que não foram encontrados no mercado ou violam restrições.
                </p>
              </div>
            )}

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-4">Receitas do Cardápio</h3>
              <div className="grid gap-4">
                {generatedMenu.recipes.map((recipe, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{recipe.nome || `Receita ${index + 1}`}</h4>
                      <div className="text-right">
                        <div className="text-sm font-medium">R$ {recipe.custo_total?.toFixed(2) || '0.00'}</div>
                        <div className="text-xs text-muted-foreground">
                          R$ {recipe.custo_por_refeicao?.toFixed(2) || '0.00'} por refeição
                        </div>
                      </div>
                    </div>
                    
                    {recipe.descricao && (
                      <p className="text-sm text-muted-foreground mb-2">{recipe.descricao}</p>
                    )}
                    
                    {recipe.ingredientes && recipe.ingredientes.length > 0 && (
                      <div className="text-xs">
                        <strong>Ingredientes:</strong> {recipe.ingredientes.join(', ')}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}