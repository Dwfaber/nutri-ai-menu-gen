import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChefHat, Clock, DollarSign, Users, CheckCircle, XCircle, ShoppingCart, Calendar } from 'lucide-react';
import { useIntegratedMenuGeneration } from '@/hooks/useIntegratedMenuGeneration';
import { useSelectedClient } from '@/contexts/SelectedClientContext';

const IntegratedMenuGenerator = () => {
  const [weekPeriod, setWeekPeriod] = useState('');
  const [preferences, setPreferences] = useState('');
  const [approverName, setApproverName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  const { selectedClient } = useSelectedClient();
  const {
    isGenerating,
    generatedMenu,
    generateMenu,
    approveMenu,
    rejectMenu,
    generateShoppingListFromMenu
  } = useIntegratedMenuGeneration();

  const clearGeneratedMenu = () => {
    // This would typically call a reset function from the hook
    window.location.reload(); // Simple solution for now
  };

  const handleGenerateMenu = async () => {
    if (!weekPeriod.trim()) {
      return;
    }

    const preferencesList = preferences
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    await generateMenu(weekPeriod, preferencesList);
  };

  const handleApprove = async () => {
    if (generatedMenu && approverName.trim()) {
      await approveMenu(generatedMenu.id, approverName);
    }
  };

  const handleReject = async () => {
    if (generatedMenu && rejectionReason.trim()) {
      await rejectMenu(generatedMenu.id, rejectionReason);
      setRejectionReason('');
    }
  };

  const handleGenerateShoppingList = async () => {
    if (generatedMenu) {
      await generateShoppingListFromMenu(generatedMenu);
    }
  };

  if (!selectedClient) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">Selecione um cliente para gerar cardápios</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Cliente Selecionado: {selectedClient.nome_fantasia}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-700">Tipo de Refeição</p>
              <p className="text-lg font-bold">{selectedClient.tipo_refeicao}</p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Custo Médio Diário</p>
              <p className="text-lg font-bold text-green-600">R$ {selectedClient.custo_medio_diario.toFixed(2)}</p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Filial</p>
              <p className="text-lg font-bold">{selectedClient.nome_filial || 'Principal'}</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-700">
              <strong>Nota:</strong> Para gerar cardápios, você precisará informar dados adicionais como número de funcionários e restrições alimentares.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Menu Generation Form */}
      {!generatedMenu && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="w-5 h-5" />
              Gerar Novo Cardápio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="weekPeriod">Período do Cardápio *</Label>
              <Input
                id="weekPeriod"
                placeholder="Ex: Semana de 27/01 a 31/01/2025"
                value={weekPeriod}
                onChange={(e) => setWeekPeriod(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="preferences">Preferências Especiais (opcional)</Label>
              <Textarea
                id="preferences"
                placeholder="Ex: mais proteínas, pratos vegetarianos, comida regional"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Separe múltiplas preferências por vírgula
              </p>
            </div>

            <Button 
              onClick={handleGenerateMenu}
              disabled={isGenerating || !weekPeriod.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Gerando Cardápio...
                </>
              ) : (
                <>
                  <ChefHat className="w-4 h-4 mr-2" />
                  Gerar Cardápio Inteligente
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generated Menu Display */}
      {generatedMenu && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Cardápio: {generatedMenu.weekPeriod}
              </CardTitle>
              <Badge 
                variant={generatedMenu.status === 'approved' ? 'default' : 'outline'}
                className={
                  generatedMenu.status === 'approved' ? 'bg-green-100 text-green-800' :
                  generatedMenu.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-amber-100 text-amber-800'
                }
              >
                {generatedMenu.status === 'pending_approval' && 'Aguardando Aprovação'}
                {generatedMenu.status === 'approved' && 'Aprovado'}
                {generatedMenu.status === 'rejected' && 'Rejeitado'}
                {generatedMenu.status === 'draft' && 'Rascunho'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Menu Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-gray-700">Custo Total</p>
                <p className="text-xl font-bold text-green-600">R$ {generatedMenu.totalCost.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <p className="font-medium text-gray-700">Custo por Refeição</p>
                <p className="text-xl font-bold text-blue-600">R$ {generatedMenu.estimatedCostPerMeal.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <ChefHat className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="font-medium text-gray-700">Receitas</p>
                <p className="text-xl font-bold text-purple-600">{generatedMenu.recipes.length}</p>
              </div>
            </div>

            {/* Recipes List */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Receitas do Cardápio:</h4>
              <div className="space-y-2">
                {generatedMenu.recipes.map((recipe, index) => (
                  <div key={recipe.id || index} className="flex justify-between items-center p-3 bg-white border rounded-lg">
                    <div>
                      <p className="font-medium">{recipe.name}</p>
                      <p className="text-sm text-gray-600">
                        {recipe.day} • {recipe.mealType} • {recipe.servings} porções
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">R$ {recipe.totalCost.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">R$ {recipe.costPerServing.toFixed(2)}/porção</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Approval Actions */}
            {generatedMenu.status === 'pending_approval' && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Aprovação do Cardápio:</h4>
                
                <div>
                  <Label htmlFor="approverName">Nome do Aprovador *</Label>
                  <Input
                    id="approverName"
                    placeholder="Digite seu nome"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleApprove}
                    disabled={!approverName.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprovar Cardápio
                  </Button>
                  
                  <Button 
                    onClick={() => setRejectionReason('Digite o motivo da rejeição')}
                    variant="outline" 
                    className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar
                  </Button>
                </div>

                {rejectionReason && (
                  <div className="space-y-2">
                    <Label htmlFor="rejectionReason">Motivo da Rejeição:</Label>
                    <Textarea
                      id="rejectionReason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                    />
                    <Button 
                      onClick={handleReject}
                      variant="destructive"
                      disabled={!rejectionReason.trim()}
                    >
                      Confirmar Rejeição
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Generate Shopping List */}
            {generatedMenu.status === 'approved' && (
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-green-900">Cardápio Aprovado!</h4>
                    <p className="text-sm text-green-700">
                      Aprovado por {generatedMenu.approvedBy} em {new Date(generatedMenu.approvedAt!).toLocaleString()}
                    </p>
                  </div>
                  <Button 
                    onClick={handleGenerateShoppingList}
                    disabled={isGenerating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Gerar Lista de Compras
                  </Button>
                </div>
              </div>
            )}

            {generatedMenu.status === 'rejected' && (
              <div className="p-4 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-900">Cardápio Rejeitado</h4>
                <p className="text-sm text-red-700 mt-1">{generatedMenu.notes}</p>
                <Button 
                  onClick={clearGeneratedMenu}
                  variant="outline"
                  className="mt-3"
                >
                  Gerar Novo Cardápio
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IntegratedMenuGenerator;