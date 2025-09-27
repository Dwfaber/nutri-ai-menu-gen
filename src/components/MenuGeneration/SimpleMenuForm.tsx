import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ChefHat, X, Loader2 } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { useSelectedClient } from '../../contexts/SelectedClientContext';
import { PeriodSelector, SelectedPeriod } from '../ui/period-selector';

export interface SimpleMenuFormData {
  clientId: string;
  period: {
    type: string;
    label: string;
    days: number;
    includeWeekends: boolean;
  };
  mealsPerDay: number;
  estimatedMeals?: number;
  budgetPerMeal?: number;
  totalBudget?: number;
  preferences?: string[];
  juiceConfig?: {
    use_pro_mix?: boolean;
    use_vita_suco?: boolean;
    use_suco_diet?: boolean;
    use_suco_natural?: boolean;
  };
  proteinGrams?: string;
  diasUteis: boolean;
}

interface SimpleMenuFormProps {
  onSubmit: (formData: SimpleMenuFormData) => void;
  onCancel: () => void;
  isGenerating: boolean;
  error?: string | null;
}

export const SimpleMenuForm: React.FC<SimpleMenuFormProps> = ({
  onSubmit,
  onCancel,
  isGenerating,
  error
}) => {
  const { selectedClient } = useSelectedClient();
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod | null>(null);
  const [preferences, setPreferences] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState(50);
  
  // Estados para seleção de sucos
  const [selectedJuices, setSelectedJuices] = useState({
    use_pro_mix: false,
    use_vita_suco: false,
    use_suco_diet: false,
    use_suco_natural: true // Padrão
  });

  // Estado para gramagem de proteína
  const [selectedProteinGrams, setSelectedProteinGrams] = useState('100');
  
  // Estado para prevenir duplo clique
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPeriod || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const formData: SimpleMenuFormData = {
      clientId: selectedClient?.id || '',
      period: {
        type: selectedPeriod.option.type,
        label: selectedPeriod.option.label,
        days: selectedPeriod.totalDays,
        includeWeekends: selectedPeriod.option.includeWeekends
      },
      mealsPerDay: selectedPeriod.mealsPerDay,
      estimatedMeals: selectedPeriod.totalMeals,
      budgetPerMeal: selectedClient?.custo_medio_diario || 0,
      totalBudget: (selectedClient?.custo_medio_diario || 0) * selectedPeriod.totalMeals,
      preferences: preferences.trim() ? [preferences.trim()] : undefined,
      juiceConfig: selectedJuices,
      proteinGrams: selectedProteinGrams,
      diasUteis: !selectedPeriod.option.includeWeekends
    };

    try {
      onSubmit(formData);
    } finally {
      // Reset submission state after a delay
      setTimeout(() => setIsSubmitting(false), 2000);
    }
  };

  const handleMealsPerDayChange = (value: number) => {
    setMealsPerDay(value);
  };

  const handleJuiceChange = (juiceType: keyof typeof selectedJuices, checked: boolean) => {
    setSelectedJuices(prev => ({
      ...prev,
      [juiceType]: checked
    }));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="w-5 h-5" />
          Gerar Cardápio Personalizado
        </CardTitle>
        <div className="text-sm text-gray-600">
          Cliente: <span className="font-medium">{selectedClient?.nome_fantasia}</span>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Seleção de Período */}
          <PeriodSelector
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            mealsPerDay={mealsPerDay}
            onMealsPerDayChange={handleMealsPerDayChange}
          />
            
          {/* Configurações de Sucos e Proteínas */}
          <div className="space-y-4">
            {/* Seleção de Sucos */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Tipos de Sucos</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pro_mix"
                    checked={selectedJuices.use_pro_mix}
                    onCheckedChange={(checked) => handleJuiceChange('use_pro_mix', checked as boolean)}
                  />
                  <Label htmlFor="pro_mix" className="text-sm">Pró Mix</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="vita_suco"
                    checked={selectedJuices.use_vita_suco}
                    onCheckedChange={(checked) => handleJuiceChange('use_vita_suco', checked as boolean)}
                  />
                  <Label htmlFor="vita_suco" className="text-sm">Vita Suco</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="suco_diet"
                    checked={selectedJuices.use_suco_diet}
                    onCheckedChange={(checked) => handleJuiceChange('use_suco_diet', checked as boolean)}
                  />
                  <Label htmlFor="suco_diet" className="text-sm">Suco Diet</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="suco_natural"
                    checked={selectedJuices.use_suco_natural}
                    onCheckedChange={(checked) => handleJuiceChange('use_suco_natural', checked as boolean)}
                  />
                  <Label htmlFor="suco_natural" className="text-sm">Suco Natural</Label>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {Object.values(selectedJuices).filter(Boolean).length} tipo{Object.values(selectedJuices).filter(Boolean).length !== 1 ? 's' : ''} selecionado{Object.values(selectedJuices).filter(Boolean).length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Seleção de Gramagem de Proteína */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Gramagem de Proteína por Porção</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="protein_90g"
                    name="protein_grams"
                    value="90"
                    checked={selectedProteinGrams === '90'}
                    onChange={(e) => setSelectedProteinGrams(e.target.value)}
                    className="w-4 h-4 text-primary border-gray-300 focus:ring-primary focus:ring-2"
                  />
                  <Label htmlFor="protein_90g" className="text-sm cursor-pointer">90g por porção</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="protein_100g"
                    name="protein_grams"
                    value="100"
                    checked={selectedProteinGrams === '100'}
                    onChange={(e) => setSelectedProteinGrams(e.target.value)}
                    className="w-4 h-4 text-primary border-gray-300 focus:ring-primary focus:ring-2"
                  />
                  <Label htmlFor="protein_100g" className="text-sm cursor-pointer">100g por porção</Label>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Gramagem selecionada: {selectedProteinGrams}g - Serão selecionadas apenas receitas com proteínas de {selectedProteinGrams}g
              </p>
            </div>
          </div>

          {/* Preferências */}
          <div className="space-y-2">
            <Label htmlFor="preferences">Preferências Especiais (Opcional)</Label>
            <Textarea
              id="preferences"
              placeholder="Ex: Evitar frutos do mar, incluir mais vegetais, pratos regionais..."
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              rows={3}
            />
          </div>

          {/* Informações do Cliente */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Resumo do Cliente</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Custo Médio Diário</p>
                <p className="font-medium text-green-600">
                  R$ {(selectedClient?.custo_medio_diario || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Filial</p>
                <p className="font-medium">{selectedClient?.nome_filial || 'Principal'}</p>
              </div>
              <div>
                <p className="text-gray-600">Orçamento Total</p>
                <p className="font-medium text-blue-600">
                  R$ {((selectedClient?.custo_medio_diario || 0) * (selectedPeriod?.totalMeals || 0)).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isGenerating}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isGenerating || isSubmitting || !selectedPeriod || mealsPerDay <= 0}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="animate-pulse">Processando receitas e custos...</span>
                </>
              ) : (
                <>
                  <ChefHat className="w-4 h-4 mr-2" />
                  Gerar Cardápio
                </>
              )}
            </Button>
          </div>

          {/* Explicação do Processo */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Como funciona:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Selecionamos receitas das categorias: Prato Principal, Guarnição, Salada e Sobremesa</li>
              <li>• Garantimos variedade durante o período (não repetimos receitas)</li>
              <li>• Calculamos custos baseados no orçamento do cliente</li>
              <li>• Geramos lista de compras automaticamente após aprovação</li>
            </ul>
            {isGenerating && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  ⏰ <strong>Processamento em andamento:</strong> A geração pode levar até 1 minuto. Por favor, aguarde...
                </p>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};