import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChefHat, Calendar, ShoppingCart, DollarSign, Users, Plus, Wifi, WifiOff } from 'lucide-react';
import { useIntegratedMenuGeneration } from '@/hooks/useIntegratedMenuGeneration';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import WeeklyMenuView from "@/components/MenuGeneration/WeeklyMenuView";
import { SimpleMenuForm, SimpleMenuFormData } from '@/components/MenuGeneration/SimpleMenuForm';
import { MenuGenerationProgress } from '@/components/MenuGeneration/MenuGenerationProgress';
import { testEdgeFunctionConnectivity, testMenuGeneration } from '@/utils/edgeFunctionTest';
import { useToast } from '@/hooks/use-toast';

const IntegratedMenuGenerator = () => {
  const [showForm, setShowForm] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [generationStage, setGenerationStage] = useState<'fetching' | 'calculating' | 'processing' | 'finalizing' | 'complete'>('fetching');
  
  const { toast } = useToast();
  const { selectedClient } = useSelectedClient();
  const {
    isGenerating,
    generatedMenu,
    generateMenuWithFormData,
    approveMenu,
    rejectMenu,
    generateShoppingListFromMenu,
    updateGeneratedMenu,
    clearGeneratedMenu,
    error
  } = useIntegratedMenuGeneration();

  const handleGenerateMenu = async (formData: SimpleMenuFormData) => {
    setGenerationStage('fetching');
    
    setTimeout(() => setGenerationStage('calculating'), 2000);
    setTimeout(() => setGenerationStage('processing'), 8000);
    setTimeout(() => setGenerationStage('finalizing'), 35000);
    
    await generateMenuWithFormData(formData);
    setGenerationStage('complete');
    setTimeout(() => setShowForm(false), 1000);
  };

  const handleShowForm = () => setShowForm(true);
  const handleCancelForm = () => setShowForm(false);

  const handleApprove = async (approverName: string, notes?: string) => {
    if (generatedMenu) {
      const success = await approveMenu(generatedMenu.id, approverName);
      if (success) {
        toast({
          title: "Cardápio Aprovado",
          description: `Cardápio aprovado por ${approverName}`,
          variant: "default"
        });
      }
    }
  };

  const handleReject = async (reason: string) => {
    if (generatedMenu) {
      const success = await rejectMenu(generatedMenu.id, reason);
      if (success) {
        toast({
          title: "Cardápio Rejeitado", 
          description: "Cardápio foi rejeitado",
          variant: "destructive"
        });
      }
    }
  };

  const handleEditMenu = async (editedMenu: Partial<any>) => {
    if (generatedMenu) {
      const success = await updateGeneratedMenu(generatedMenu.id, editedMenu);
      if (success) {
        toast({
          title: "Cardápio Editado",
          description: "Alterações salvas com sucesso",
          variant: "default"
        });
      } else {
        toast({
          title: "Erro ao Editar",
          description: "Não foi possível salvar as alterações",
          variant: "destructive"
        });
      }
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
          title: "Conectividade OK",
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
              title: "Teste de Geração OK",
              description: "Sistema funcionando end-to-end!",
              variant: "default"
            });
          } else {
            toast({
              title: "Conectividade OK, mas geração falhou",
              description: testResult.error || "Erro na geração",
              variant: "destructive"
            });
          }
        }
      } else {
        setConnectionStatus('error');
        toast({
          title: "Problema de Conectividade",
          description: connectivityResult.error || "Edge Function não respondeu",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[UI] Erro no teste:', error);
      setConnectionStatus('error');
      toast({
        title: "Erro no Teste",
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

  if (showForm && !generatedMenu) {
    return (
      <div className="space-y-6">
        <SimpleMenuForm
          onSubmit={handleGenerateMenu}
          onCancel={handleCancelForm}
          isGenerating={isGenerating}
          error={error}
        />
        
        {isGenerating && (
          <MenuGenerationProgress 
            stage={generationStage}
            message="Processamento detalhado de receitas e custos em andamento..."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {generatedMenu && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Cardápio: {generatedMenu.weekPeriod}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Total de Receitas</p>
                <p className="text-2xl font-bold text-blue-600">{generatedMenu.totalRecipes}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Custo por Refeição</p>
                <p className="text-2xl font-bold text-green-600">R$ {generatedMenu.costPerMeal.toFixed(2)}</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600">Custo Total</p>
                <p className="text-2xl font-bold text-purple-600">R$ {generatedMenu.totalCost.toFixed(2)}</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Refeições/Dia</p>
                <p className="text-2xl font-bold text-orange-600">{generatedMenu.mealsPerDay || 50}</p>
              </div>
            </div>

            <Separator />

            {generatedMenu.menu ? (
              <WeeklyMenuView menu={generatedMenu.menu} />
            ) : (
              <div className="p-8 text-center text-gray-500">
                <ChefHat className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhuma receita encontrada no cardápio</p>
              </div>
            )}

            <Separator />

            <div className="flex gap-3">
              <Button onClick={handleGenerateShoppingList} className="flex-1">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Gerar Lista de Compras
              </Button>
              <Button onClick={clearGeneratedMenu} variant="outline">
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IntegratedMenuGenerator;