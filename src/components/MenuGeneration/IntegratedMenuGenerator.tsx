import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChefHat, Calendar, CheckCircle, XCircle, ShoppingCart, DollarSign, Users, Plus } from 'lucide-react';
import { useIntegratedMenuGeneration } from '@/hooks/useIntegratedMenuGeneration';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import MenuTable from '@/components/MenuTable/MenuTable';
import { SimpleMenuForm } from '@/components/MenuGeneration/SimpleMenuForm';
import { ContractFormData } from '@/hooks/useClientContracts';
import MenuValidationPanel from '@/components/MenuGeneration/MenuValidationPanel';

const IntegratedMenuGenerator = () => {
  const [showForm, setShowForm] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  const { selectedClient } = useSelectedClient();
  const {
    isGenerating,
    generatedMenu,
    generateMenuWithFormData,
    approveMenu,
    rejectMenu,
    generateShoppingListFromMenu,
    clearGeneratedMenu,
    error,
    viableRecipes,
    marketIngredients,
    violations,
    validateMenu
  } = useIntegratedMenuGeneration();


  const handleGenerateMenu = async (formData: ContractFormData) => {
    await generateMenuWithFormData(formData);
    setShowForm(false);
  };

  const handleShowForm = () => {
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
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

  // Show menu creation form if form is requested and no menu is generated
  if (showForm && !generatedMenu) {
    return (
      <SimpleMenuForm
        onSubmit={handleGenerateMenu}
        onCancel={handleCancelForm}
        isGenerating={isGenerating}
        error={error}
      />
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
        </CardContent>
      </Card>

      {/* Generate Menu Button */}
      {!generatedMenu && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="w-5 h-5" />
              Gerador Inteligente de Cardápios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 text-sm">
              Sistema inteligente que verifica disponibilidade no mercado e aplica regras de negócio.
              Estrutura: PP1, PP2, Arroz Branco, Feijão, Salada 1 (Verduras), Salada 2 (Legumes), Suco 1, Suco 2.
              Garante variedade de proteínas, evita processos nas segundas e controla custos.
            </p>
            <Button 
              onClick={handleShowForm}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Gerar Cardápio da Semana
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

            {/* Business Rules Validation */}
            {generatedMenu.recipes && generatedMenu.recipes.length > 0 && (
              <MenuValidationPanel
                rules={validateMenu(generatedMenu.recipes)}
                violations={violations}
                marketAvailability={{
                  totalIngredients: marketIngredients.length,
                  availableIngredients: viableRecipes.length,
                  missingIngredients: []
                }}
              />
            )}

            {/* Menu Table */}
            {generatedMenu.recipes && generatedMenu.recipes.length > 0 ? (
              <>
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
                <div className="flex gap-2 mt-3">
                  <Button 
                    onClick={clearGeneratedMenu}
                    variant="outline"
                  >
                    Limpar Cardápio
                  </Button>
                  <Button 
                    onClick={handleShowForm}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Gerar Novo Cardápio
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IntegratedMenuGenerator;