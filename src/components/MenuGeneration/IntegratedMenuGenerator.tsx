import React, { useState, useMemo, useEffect } from 'react';
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
import WeeklyMenuView from "@/components/MenuGeneration/WeeklyMenuView";
import { SimpleMenuForm, SimpleMenuFormData } from '@/components/MenuGeneration/SimpleMenuForm';
import MenuValidationPanel from '@/components/MenuGeneration/MenuValidationPanel';
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
    error,
    violations,
    validateMenu,
    validateMenuAndSetViolations
  } = useIntegratedMenuGeneration();

  const validationRules = useMemo(() => {
    if (!generatedMenu?.recipes || generatedMenu.recipes.length === 0) {
      return null;
    }
    return validateMenu(generatedMenu.recipes);
  }, [generatedMenu?.recipes]);

  useEffect(() => {
    if (generatedMenu?.recipes && generatedMenu.recipes.length > 0) {
      validateMenuAndSetViolations(generatedMenu.recipes);
    }
  }, [generatedMenu?.recipes]);

  const handleGenerateMenu = async (formData: SimpleMenuFormData) => {
    await generateMenuWithFormData(formData);
    setShowForm(false);
  };

  const handleShowForm = () => setShowForm(true);
  const handleCancelForm = () => setShowForm(false);

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
        
        if (selectedClient) {
          console.log('[UI] Testando geração de cardápio rápida...');
          const testResult = await testMenuGeneration({
            action: 'generate_menu',
            filialIdLegado: selectedClient.filial_id || 8,
            numDays: 1,
            refeicoesPorDia: 10,
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

  // Se não tem cliente selecionado
  if (!selectedClient) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">Selecione um cliente para gerar cardápios</p>
        </CardContent>
      </Card>
    );
  }

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
      {/* Info do Cliente */}
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

      {/* Botão Principal */}
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
              Salada 1, Salada 2, Suco 1, Suco 2, Sobremesa.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleShowForm} disabled={isGenerating} className="flex-1" size="lg">
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

      {/* Se já existe menu gerado */}
      {generatedMenu && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Cardápio: {generatedMenu.weekPeriod}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Validação de Regras */}
            {validationRules && (
              <MenuValidationPanel
                rules={validationRules}
                violations={violations}
                marketAvailability={{
                  totalIngredients: 0,
                  availableIngredients: 0,
                  missingIngredients: []
                }}
                menuId={generatedMenu.id}
                onViolationsChanged={() => {
                  if (generatedMenu?.recipes && generatedMenu.recipes.length > 0) {
                    validateMenuAndSetViolations(generatedMenu.recipes);
                  }
                }}
              />
            )}

            {/* Visão semanal */}
            {generatedMenu.recipes?.length > 0 ? (
              <WeeklyMenuView menu={generatedMenu} />
            ) : (
              <div className="p-8 text-center text-gray-500">
                <ChefHat className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhuma receita encontrada no cardápio</p>
              </div>
            )}

            <Separator />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IntegratedMenuGenerator;