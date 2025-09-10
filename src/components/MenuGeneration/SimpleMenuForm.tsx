import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, ChefHat, X, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useSelectedClient } from '@/contexts/SelectedClientContext';

interface SimpleMenuFormProps {
  onSubmit: (formData: any) => void;
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
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [preferences, setPreferences] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState(50);
  const [totalDays, setTotalDays] = useState(1);
  const [totalMeals, setTotalMeals] = useState(50);
  
  // Estados para seleção de sucos
  const [selectedJuices, setSelectedJuices] = useState({
    use_pro_mix: false,
    use_vita_suco: false,
    use_suco_diet: false,
    use_suco_natural: true // Padrão
  });

  // Estado para gramagem de proteína
  const [selectedProteinGrams, setSelectedProteinGrams] = useState('100');
  
  // Estado para controle de fins de semana
  const [incluirFimDeSemana, setIncluirFimDeSemana] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!periodStart || !periodEnd) {
      return;
    }

    const formData = {
      clientId: selectedClient?.id,
      contractData: selectedClient,
      period: {
        start: periodStart,
        end: periodEnd
      },
      mealsPerDay,
      totalMeals,
      estimatedMeals: totalMeals,
      budgetPerMeal: selectedClient?.custo_medio_diario || 0,
      totalBudget: (selectedClient?.custo_medio_diario || 0) * totalMeals,
      preferences: preferences.trim() || undefined,
      juiceConfig: selectedJuices,
      proteinGrams: selectedProteinGrams,
      diasUteis: !incluirFimDeSemana // Enviar true se excluir fins de semana
    };

    onSubmit(formData);
  };

  // Função para calcular total de dias e refeições
  const calculatePeriodData = (start: string, end: string, mealsPerDayValue?: number) => {
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      let daysDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Se não incluir fins de semana, calcular apenas dias úteis
      if (!incluirFimDeSemana && daysDifference > 0) {
        let diasUteis = 0;
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay(); // 0 = Domingo, 6 = Sábado
          if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Segunda a Sexta
            diasUteis++;
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        daysDifference = diasUteis;
      }
      
      if (daysDifference > 0) {
        setTotalDays(daysDifference);
        const mealsValue = mealsPerDayValue || mealsPerDay;
        setTotalMeals(daysDifference * mealsValue);
      }
    }
  };

  const handlePeriodStartChange = (value: string) => {
    setPeriodStart(value);
    calculatePeriodData(value, periodEnd);
  };

  const handlePeriodEndChange = (value: string) => {
    setPeriodEnd(value);
    calculatePeriodData(periodStart, value);
  };

  const handleMealsPerDayChange = (value: number) => {
    setMealsPerDay(value);
    calculatePeriodData(periodStart, periodEnd, value);
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

          {/* Período da Semana */}
          <div className="space-y-4">
            <Label className="text-base font-medium flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Período do Cardápio
            </Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="periodStart">Data de Início *</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => handlePeriodStartChange(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="periodEnd">Data de Fim *</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => handlePeriodEndChange(e.target.value)}
                  min={periodStart}
                  required
                />
              </div>
            </div>
            
            {/* Opção para incluir fins de semana */}
            <div className="flex items-center space-x-2 mt-3">
              <Checkbox
                id="incluirFimDeSemana"
                checked={incluirFimDeSemana}
                onCheckedChange={(checked) => {
                  setIncluirFimDeSemana(checked as boolean);
                  // Recalcular quando a opção mudar
                  calculatePeriodData(periodStart, periodEnd);
                }}
              />
              <Label htmlFor="incluirFimDeSemana" className="text-sm">
                Incluir fins de semana no cardápio
              </Label>
            </div>
            
            <p className="text-xs text-gray-500">
              O cardápio será gerado para {totalDays} dia{totalDays !== 1 ? 's' : ''} 
              {incluirFimDeSemana ? ' (incluindo fins de semana)' : ' (apenas dias úteis)'}
            </p>
          </div>

          {/* Configuração do Período */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Configuração do Período</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="totalDays">Total de Dias</Label>
                <Input
                  id="totalDays"
                  type="number"
                  value={totalDays}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="mealsPerDay">Refeições por Dia *</Label>
                <Input
                  id="mealsPerDay"
                  type="number"
                  min="1"
                  value={mealsPerDay}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    handleMealsPerDayChange(value);
                  }}
                  required
                />
              </div>
              <div>
                <Label htmlFor="totalMeals">Total de Refeições ({totalDays} dia{totalDays !== 1 ? 's' : ''})</Label>
                <Input
                  id="totalMeals"
                  type="number"
                  value={totalMeals}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
            </div>
            
            {/* Seleção de Sucos */}
            <div className="mt-4">
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
            <div className="mt-4">
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
                  R$ {((selectedClient?.custo_medio_diario || 0) * totalMeals).toFixed(2)}
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
              disabled={isGenerating || !periodStart || !periodEnd || mealsPerDay <= 0}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando Cardápio...
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
          </div>
        </form>
      </CardContent>
    </Card>
  );
};