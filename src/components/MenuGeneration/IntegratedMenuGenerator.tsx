import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChefHat, Calendar, CheckCircle, XCircle, ShoppingCart, DollarSign, Users, Plus, Wifi, WifiOff } from 'lucide-react';
import { useIntegratedMenuGeneration } from '@/hooks/useIntegratedMenuGeneration';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import { WeeklyMenuView } from '@/components/MenuGeneration/WeeklyMenuView';
import { SimpleMenuForm, SimpleMenuFormData } from '@/components/MenuGeneration/SimpleMenuForm';
import { ContractFormData } from '@/hooks/useClientContracts';
import MenuValidationPanel from '@/components/MenuGeneration/MenuValidationPanel';
import { MenuCostBreakdown } from '@/components/MenuGeneration/MenuCostBreakdown';
import { testEdgeFunctionConnectivity, testMenuGeneration } from '@/utils/edgeFunctionTest';
import { useToast } from '@/hooks/use-toast';

const IntegratedMenuGenerator = () => {
  const [showForm, setShowForm] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  
  const { toast } = useToast();
  const { selectedClient } = useSelectedClient();
  const {
    isGenerating,
    generatedMenu,
    generateMenuWithFormData,
    approveMenu,
    rejectMenu,
    generateShoppingListFromMenu,
    clearGeneratedMenu,
    clearMenuExplicitly,
    error,
    viableRecipes,
    marketIngredients,
    violations,
    validateMenu,
    validateMenuAndSetViolations
  } = useIntegratedMenuGeneration();

  // Memoize validation rules to prevent unnecessary re-calculations
  const validationRules = useMemo(() => {
    if (!generatedMenu?.recipes || generatedMenu.recipes.length === 0) {
      return null;
    }
    return validateMenu(generatedMenu.recipes);
  }, [generatedMenu?.recipes]);

  // Update violations only when menu changes (remove validateMenuAndSetViolations dependency)
  useEffect(() => {
    if (generatedMenu?.recipes && generatedMenu.recipes.length > 0) {
      validateMenuAndSetViolations(generatedMenu.recipes);
    }
  }, [generatedMenu?.recipes]); // CORREÇÃO: Remover dependência que causa loop


  const handleGenerateMenu = async (formData: SimpleMenuFormData) => {
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

  // Test connectivity function
  const handleTestConnectivity = async () => {
    setIsTesting(true);
    setConnectionStatus('unknown');
    
    try {
      console.log('[UI] Iniciando teste de conectividade...');
      
      const connectivityResult = await testEdgeFunctionConnectivity();
      console.log('[UI] Resultado do teste:', connectivityResult);
      
      if (connectivityResult.isConnected) {
        setConnectionStatus('healthy');
        toast({
          title: "✅ Conectividade OK",
          description: `Edge Function está funcionando (${connectivityResult.timestamp})`,
          variant: "default"
        });
        
        // Se conectividade OK, testar geração rápida
        if (selectedClient) {
          console.log('[UI] Testando geração de cardápio rápida...');
          const testResult = await testMenuGeneration({
            action: 'generate_menu',
            filialIdLegado: selectedClient.filial_id || 8,
            numDays: 1,
            refeicoesPorDia: 10, // Teste pequeno
            useDiaEspecial: false,
            baseRecipes: { arroz: 580, feijao: 1600 }
          });
          
          if (testResult.success) {
            toast({
              title: "🎯 Teste de Geração OK",
              description: "Sistema funcionando end-to-end!",
              variant: "default"
            });
          } else {
            toast({
              title: "⚠️ Conectividade OK, mas geração falhou",
              description: testResult.error || "Erro na geração",
              variant: "destructive"
            });
          }
        }
        
      } else {
        setConnectionStatus('error');
        toast({
          title: "❌ Problema de Conectividade",
          description: connectivityResult.error || "Edge Function não respondeu",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('[UI] Erro no teste:', error);
      setConnectionStatus('error');
      toast({
        title: "❌ Erro no Teste",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
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

      {/* Generate Menu Button - Now shows when menu is persisted */}
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
              Estrutura: PP1, PP2, Arroz Branco, Feijão, Guarnição, 
              Salada 1 (Verduras), Salada 2 (Legumes), Suco 1, Suco 2, Sobremesa.
              Garante variedade de proteínas, evita processos e controla custos para qualquer período.
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={handleShowForm}
                disabled={isGenerating}
                className="flex-1"
                size="lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Gerar Novo Cardápio
              </Button>
              <Button 
                onClick={handleTestConnectivity}
                disabled={isTesting}
                variant="outline"
                size="lg"
                className="flex items-center gap-2"
              >
                {isTesting ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : connectionStatus === 'healthy' ? (
                  <Wifi className="w-4 h-4 text-green-600" />
                ) : connectionStatus === 'error' ? (
                  <WifiOff className="w-4 h-4 text-red-600" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {isTesting ? 'Testando...' : 'Testar Conectividade'}
              </Button>
            </div>
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
                {localStorage.getItem('current-generated-menu') && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Em Andamento
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
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
                {generatedMenu.status === 'pending_approval' && (
                  <Button
                    onClick={() => clearMenuExplicitly()}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
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
            {validationRules && (
              <MenuValidationPanel
                rules={validationRules}
                violations={violations}
                marketAvailability={{
                  totalIngredients: marketIngredients.length,
                  availableIngredients: viableRecipes.length,
                  missingIngredients: []
                }}
                menuId={generatedMenu.id}
                onViolationsChanged={() => {
                  // Re-validate menu when violations are approved/suggestions are made
                  if (generatedMenu?.recipes && generatedMenu.recipes.length > 0) {
                    validateMenuAndSetViolations(generatedMenu.recipes);
                  }
                }}
              />
            )}

            {/* Weekly Menu View */}
            {generatedMenu.recipes && generatedMenu.recipes.length > 0 ? (
              <>
                <WeeklyMenuView menu={generatedMenu} />
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
                    onClick={() => clearMenuExplicitly()}
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