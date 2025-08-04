
import { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, DollarSign, Users, Clock, CheckCircle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClientContracts, ContractFormData } from '@/hooks/useClientContracts';
import { ProductRequestManager } from '../ProductRequests/ProductRequestManager';

interface MenuCreationFormProps {
  onSubmit: (formData: ContractFormData) => void;
  onCancel: () => void;
  isGenerating: boolean;
  error?: string | null;
}

export const MenuCreationForm = ({ onSubmit, onCancel, isGenerating, error }: MenuCreationFormProps) => {
  const { 
    clients, 
    isLoading, 
    getClientContract, 
    calculateEstimatedMeals,
    validateContract,
    generateAIContextSummary 
  } = useClientContracts();

  const [formData, setFormData] = useState<ContractFormData>({
    clientId: '',
    period: {
      start: '',
      end: ''
    },
    estimatedMeals: 0,
    mealsPerDay: 0,
    budgetPerMeal: 0,
    totalBudget: 0,
    restrictions: [],
    preferences: '',
    contractData: null
  });

  const [contractWarnings, setContractWarnings] = useState<string[]>([]);
  const [isLoadingContract, setIsLoadingContract] = useState(false);
  const [productCosts, setProductCosts] = useState({ total: 0, purchase: 0 });

  // Available restriction options
  const restrictionOptions = [
    { value: 'vegetariano', label: 'Vegetariano' },
    { value: 'vegano', label: 'Vegano' },
    { value: 'sem-gluten', label: 'Sem Glúten' },
    { value: 'sem-lactose', label: 'Sem Lactose' },
    { value: 'halal', label: 'Halal' },
    { value: 'kosher', label: 'Kosher' },
    { value: 'diabetico', label: 'Diabético' }
  ];

  // Load contract data when client is selected
  const handleClientChange = async (clientId: string) => {
    if (!clientId) return;

    setIsLoadingContract(true);
    const contract = await getClientContract(clientId);
    
    if (contract) {
      const validation = validateContract(contract);
      setContractWarnings(validation.warnings);

      // Auto-populate form with contract data
      setFormData(prev => ({
        ...prev,
        clientId,
        contractData: contract,
        budgetPerMeal: contract.custo_medio_diario,
        restrictions: [] // Will be collected from form
      }));
    }
    
    setIsLoadingContract(false);
  };

  // Calculate estimated meals when period changes
  useEffect(() => {
    if (formData.contractData && formData.period.start && formData.period.end) {
      const meals = calculateEstimatedMeals(
        formData.contractData,
        formData.period.start,
        formData.period.end
      );
      
      setFormData(prev => ({
        ...prev,
        estimatedMeals: meals,
        totalBudget: meals * prev.budgetPerMeal
      }));
    }
  }, [formData.contractData, formData.period.start, formData.period.end, formData.budgetPerMeal]);

  // Update total budget when budget per meal changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      totalBudget: prev.estimatedMeals * prev.budgetPerMeal
    }));
  }, [formData.budgetPerMeal, formData.estimatedMeals]);

  const handleRestrictionToggle = (restriction: string) => {
    setFormData(prev => ({
      ...prev,
      restrictions: prev.restrictions.includes(restriction)
        ? prev.restrictions.filter(r => r !== restriction)
        : [...prev.restrictions, restriction]
    }));
  };

  const handleProductCostChange = (totalCost: number, purchaseCost: number) => {
    setProductCosts({ total: totalCost, purchase: purchaseCost });
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const canSubmit = formData.clientId && formData.period.start && formData.period.end && formData.estimatedMeals > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Criar Novo Cardápio com IA</span>
          {isLoadingContract && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-6">
            {/* Client Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Cliente</label>
              <Select value={formData.clientId} onValueChange={handleClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nome_fantasia} - R$ {client.custo_medio_diario.toFixed(2)}
                      (Filial: {client.filial_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contract Information */}
            {formData.contractData && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-sm">Informações do Contrato</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span>Filial: {formData.contractData.filial_id}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span>Tipo: {formData.contractData.tipo_refeicao}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    <span>Custo médio diário: R$ {formData.contractData.custo_medio_diario.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Validação: {formData.contractData.usa_validacao_media ? 'Ativa' : 'Inativa'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Contract Warnings */}
            {contractWarnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">Atenção aos seguintes pontos do contrato:</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {contractWarnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Period Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Data de Início</label>
                <Input
                  type="date"
                  value={formData.period.start}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    period: { ...prev.period, start: e.target.value }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data de Término</label>
                <Input
                  type="date"
                  value={formData.period.end}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    period: { ...prev.period, end: e.target.value }
                  }))}
                />
              </div>
            </div>

            {/* Budget Configuration */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Orçamento por Refeição</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.budgetPerMeal}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    budgetPerMeal: parseFloat(e.target.value) || 0
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Refeições por Dia</label>
                <Input
                  type="number"
                  value={formData.mealsPerDay || 0}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    mealsPerDay: parseInt(e.target.value) || 0
                  }))}
                  placeholder="Ex: 50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Refeições Estimadas (Total)</label>
                <Input
                  type="number"
                  value={formData.estimatedMeals}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    estimatedMeals: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
            </div>

            {/* Total Budget Display */}
            {formData.totalBudget > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Orçamento Total Estimado:</span>
                  <Badge variant="secondary" className="text-lg">
                    R$ {formData.totalBudget.toFixed(2)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Product Costs Summary */}
            {productCosts.total > 0 && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Custo dos Produtos:</span>
                  <div className="flex space-x-4">
                    <Badge variant="outline" className="text-green-600">
                      <Package className="w-3 h-3 mr-1" />
                      R$ {productCosts.total.toFixed(2)}
                    </Badge>
                    <Badge variant="outline" className="text-blue-600">
                      Compra: R$ {productCosts.purchase.toFixed(2)}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {productCosts.total > formData.budgetPerMeal * formData.estimatedMeals ? (
                    <span className="text-red-600">⚠️ Custos excedem o orçamento planejado</span>
                  ) : (
                    <span className="text-green-600">✅ Custos dentro do orçamento</span>
                  )}
                </div>
              </div>
            )}

            {/* Dietary Restrictions */}
            <div>
              <label className="block text-sm font-medium mb-2">Restrições Alimentares</label>
              <div className="grid grid-cols-2 gap-2">
                {restrictionOptions.map(option => (
                  <label key={option.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.restrictions.includes(option.value)}
                      onChange={() => handleRestrictionToggle(option.value)}
                      className="rounded"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Preferences */}
            <div>
              <label className="block text-sm font-medium mb-2">Preferências Adicionais</label>
              <Textarea
                placeholder="Ex: pratos regionais, comida caseira, mínimo 2 proteínas bovinas por semana..."
                value={formData.preferences}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  preferences: e.target.value
                }))}
              />
            </div>

            {/* AI Context Summary */}
            {formData.contractData && formData.period.start && formData.period.end && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Resumo para IA:</h4>
                <p className="text-sm text-gray-700">
                  {generateAIContextSummary(formData)}
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="products">
            <ProductRequestManager 
              menuId={formData.clientId}
              clientId={formData.clientId}
              onCostChange={handleProductCostChange}
            />
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isGenerating}
            className="bg-green-600 hover:bg-green-700"
          >
            {isGenerating ? 'Gerando com IA...' : 'Gerar Cardápio com IA'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
