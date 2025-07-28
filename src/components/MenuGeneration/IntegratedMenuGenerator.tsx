import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChefHat, Clock, DollarSign, Users, CheckCircle, XCircle, ShoppingCart, Calendar } from 'lucide-react';
import { useIntegratedMenuGeneration } from '@/hooks/useIntegratedMenuGeneration';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import MenuTable from '@/components/MenuTable/MenuTable';

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
    generateShoppingListFromMenu,
    clearGeneratedMenu
  } = useIntegratedMenuGeneration();


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
              <p className="text-lg font-bold text-green-600">R$ {(selectedClient.custo_medio_diario || 0).toFixed(2)}</p>
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
              <DateRangePicker
                value={weekPeriod}
                onChange={setWeekPeriod}
                placeholder="Ex: Semana de 27/01 a 31/01/2025"
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
                <p className="text-xl font-bold text-blue-600">R$ {generatedMenu.costPerMeal.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <ChefHat className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="font-medium text-gray-700">Receitas</p>
                <p className="text-xl font-bold text-purple-600">{generatedMenu.recipes.length}</p>
              </div>
            </div>

            {/* Menu Table */}
            {generatedMenu.recipes && generatedMenu.recipes.length > 0 ? (
              <>
                {console.log('Generated Menu:', generatedMenu)}
                {console.log('Recipes:', generatedMenu.recipes)}
                <MenuTable
                  title="CARDÁPIO"
                  weekPeriod={generatedMenu.weekPeriod}
                  totalCost={generatedMenu.totalCost}
                  recipes={generatedMenu.recipes.map((recipe: any, index) => ({
                    id: recipe.id || `recipe-${index}`,
                    name: recipe.name || 'Receita sem nome',
                    category: recipe.category || 'PP1',
                    day: recipe.day || '',
                    cost: recipe.cost || 0,
                    servings: recipe.servings || 50
                  }))}
                  onEdit={(recipeId) => console.log('Edit recipe:', recipeId)}
                  onExport={() => console.log('Export menu')}
                  onCopy={() => console.log('Copy menu')}
                />
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <ChefHat className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhuma receita encontrada no cardápio</p>
                {generatedMenu && (
                  <pre className="mt-4 text-xs text-left bg-gray-100 p-4 rounded">
                    {JSON.stringify(generatedMenu, null, 2)}
                  </pre>
                )}
              </div>
            )}

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
                <p className="text-sm text-red-700 mt-1">{generatedMenu.rejectedReason}</p>
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