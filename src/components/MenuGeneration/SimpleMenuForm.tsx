import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, ChefHat, X, Loader2 } from 'lucide-react';
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
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [preferences, setPreferences] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!weekStart || !weekEnd) {
      return;
    }

    const formData = {
      clientId: selectedClient?.id,
      contractData: selectedClient,
      period: {
        start: weekStart,
        end: weekEnd
      },
      preferences: preferences.trim() || undefined
    };

    onSubmit(formData);
  };

  // Função para calcular data fim automaticamente (5 dias úteis)
  const handleWeekStartChange = (value: string) => {
    setWeekStart(value);
    
    if (value) {
      const startDate = new Date(value);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 4); // Adicionar 4 dias para ter 5 dias úteis
      
      setWeekEnd(endDate.toISOString().split('T')[0]);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="w-5 h-5" />
          Gerar Cardápio Semanal
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
                <Label htmlFor="weekStart">Data de Início *</Label>
                <Input
                  id="weekStart"
                  type="date"
                  value={weekStart}
                  onChange={(e) => handleWeekStartChange(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="weekEnd">Data de Fim *</Label>
                <Input
                  id="weekEnd"
                  type="date"
                  value={weekEnd}
                  onChange={(e) => setWeekEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              O cardápio será gerado para 5 dias úteis (segunda a sexta)
            </p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
              disabled={isGenerating || !weekStart || !weekEnd}
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
              <li>• Garantimos variedade durante a semana (não repetimos receitas)</li>
              <li>• Calculamos custos baseados no orçamento do cliente</li>
              <li>• Geramos lista de compras automaticamente após aprovação</li>
            </ul>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};