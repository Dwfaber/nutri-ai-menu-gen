import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, DollarSign, Percent, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProductRequest } from '@/hooks/useProductRequests';
import { usePaginatedRequests } from '@/hooks/usePaginatedRequests';
import { supabase } from '@/integrations/supabase/client';
import { withRetry, createConnectionMonitor } from '@/utils/connectionUtils';

interface ProductRequestManagerProps {
  menuId?: string;
  clientId?: string;
  onCostChange?: (totalCost: number, purchaseCost: number) => void;
}

interface LegacyProduct {
  id: string;
  produto_id_legado: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  peso_unitario: number;
  preco_unitario: number;
  disponivel: boolean;
}

export const ProductRequestManager = ({ menuId, clientId, onCostChange }: ProductRequestManagerProps) => {
  const { 
    requests, 
    isLoading, 
    isLoadingMore,
    error,
    hasMore,
    totalCount,
    loadMore,
    refresh,
    createRequest, 
    updateRequest, 
    deleteRequest
  } = usePaginatedRequests({ pageSize: 20 });
  
  const [availableProducts, setAvailableProducts] = useState<LegacyProduct[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ProductRequest | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [formData, setFormData] = useState<Partial<ProductRequest>>({
    per_capita: 0,
    inteiro: false,
    arredondar_tipo: 0,
    promocao: false,
    quantidade_embalagem: 1,
    apenas_valor_inteiro: false,
    em_promocao: false,
    produto_base_qtd_embalagem: 1
  });

  // Monitor de conectividade
  useEffect(() => {
    const connectionMonitor = createConnectionMonitor();
    const unsubscribe = connectionMonitor.onStatusChange(setIsOnline);
    return unsubscribe;
  }, []);

  // Load available products with retry
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const operation = async () => {
          // Usar produtos_base em vez de produtos_legado
          const { data, error } = await supabase
            .from('produtos_base')
            .select('*')
            .order('descricao')
            .limit(100); // Limitar para evitar sobrecarga

          if (error) throw error;
          return data || [];
        };

        const data = await withRetry(operation, { maxRetries: 2 });
        // Mapear dados de produtos_base para o formato esperado
        const mappedProducts = data.map(item => ({
          id: item.id || '',
          produto_id_legado: item.produto_base_id?.toString() || '',
          nome: item.descricao || '',
          categoria: 'Produto Base',
          unidade: item.unidade || 'UN',
          peso_unitario: 0,
          preco_unitario: 0,
          disponivel: true
        }));
        setAvailableProducts(mappedProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  // Update parent component with cost changes
  useEffect(() => {
    if (onCostChange && requests.length > 0) {
      const totalCost = requests.reduce((total, req) => total + (req.preco || 0), 0);
      const purchaseCost = requests.reduce((total, req) => total + (req.preco_compra || 0), 0);
      onCostChange(totalCost, purchaseCost);
    }
  }, [requests, onCostChange]);

  const handleProductSelect = (productId: string) => {
    const product = availableProducts.find(p => p.produto_id_legado === productId);
    if (product) {
      setFormData(prev => ({
        ...prev,
        produto_id: parseInt(product.produto_id_legado),
        descricao: product.nome,
        unidade: product.unidade,
        preco: product.preco_unitario,
        preco_compra: product.preco_unitario
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.produto_id || !formData.descricao) return;

    const requestData = {
      ...formData
    } as Omit<ProductRequest, 'criado_em' | 'solicitacao_produto_listagem_id'>;

    if (editingRequest && editingRequest.solicitacao_produto_listagem_id) {
      await updateRequest(editingRequest.solicitacao_produto_listagem_id, requestData);
      setEditingRequest(null);
    } else {
      await createRequest(requestData);
    }

    setFormData({
      per_capita: 0,
      inteiro: false,
      arredondar_tipo: 0,
      promocao: false,
      quantidade_embalagem: 1,
      apenas_valor_inteiro: false,
      em_promocao: false,
      produto_base_qtd_embalagem: 1
    });
    setShowAddForm(false);
  };

  const handleEdit = (request: ProductRequest) => {
    setEditingRequest(request);
    setFormData(request);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja remover esta solicitação?')) {
      await deleteRequest(id);
    }
  };

  const getRoundingTypeLabel = (type: number) => {
    switch (type) {
      case 0: return 'Nenhum';
      case 1: return 'Para cima';
      case 2: return 'Para baixo';
      default: return 'Padrão';
    }
  };

  const calculateTotalCost = () => requests.reduce((total, req) => total + (req.preco || 0), 0);

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {!isOnline && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Sem conexão com a internet. Algumas funcionalidades podem não funcionar.</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert with Retry */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refresh}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Solicitações de Produtos</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>Total: {totalCount} produtos</span>
            <span>Exibindo: {requests.length}</span>
            {isOnline ? (
              <div className="flex items-center space-x-1 text-green-600">
                <Wifi className="w-3 h-3" />
                <span>Online</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-red-600">
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button 
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!isOnline}
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Produto
          </Button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingRequest ? 'Editar Solicitação' : 'Nova Solicitação'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Produto</Label>
                <Select onValueChange={handleProductSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map(product => (
                      <SelectItem key={product.id} value={product.produto_id_legado}>
                        {product.nome} - {product.unidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grupo</Label>
                <Input
                  value={formData.grupo || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, grupo: e.target.value }))}
                  placeholder="Ex: Proteínas, Carboidratos..."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Per Capita</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.per_capita || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, per_capita: parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Preço</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.preco || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, preco: parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Preço de Compra</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.preco_compra || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, preco_compra: parseFloat(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Quantidade por Embalagem</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.quantidade_embalagem || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantidade_embalagem: parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Qtd Base por Embalagem</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.produto_base_qtd_embalagem || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, produto_base_qtd_embalagem: parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Tipo de Arredondamento</Label>
                <Select 
                  value={formData.arredondar_tipo?.toString() || '0'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, arredondar_tipo: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Nenhum</SelectItem>
                    <SelectItem value="1">Para cima</SelectItem>
                    <SelectItem value="2">Para baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="inteiro"
                  checked={formData.inteiro || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, inteiro: checked }))}
                />
                <Label htmlFor="inteiro">Número Inteiro</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="promocao"
                  checked={formData.promocao || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, promocao: checked }))}
                />
                <Label htmlFor="promocao">Promoção</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="apenas_valor_inteiro"
                  checked={formData.apenas_valor_inteiro || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, apenas_valor_inteiro: checked }))}
                />
                <Label htmlFor="apenas_valor_inteiro">Apenas Valor Inteiro</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="em_promocao"
                  checked={formData.em_promocao || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, em_promocao: checked }))}
                />
                <Label htmlFor="em_promocao">Em Promoção</Label>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={handleSubmit} 
                disabled={isLoading || !isOnline}
              >
                {editingRequest ? 'Atualizar' : 'Adicionar'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setEditingRequest(null);
                  setFormData({
                    per_capita: 0,
                    inteiro: false,
                    arredondar_tipo: 0,
                    promocao: false,
                    quantidade_embalagem: 1,
                    apenas_valor_inteiro: false,
                    em_promocao: false,
                    produto_base_qtd_embalagem: 1
                  });
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total de Produtos</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Custo Total</p>
                <p className="text-2xl font-bold">R$ {calculateTotalCost().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Percent className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Em Promoção</p>
                <p className="text-2xl font-bold">{requests.filter(r => r.promocao).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.solicitacao_produto_listagem_id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium">{request.descricao}</h4>
                    {request.solicitacao_produto_listagem_id && (
                      <Badge variant="outline" className="text-xs">
                        ID: {request.solicitacao_produto_listagem_id}
                      </Badge>
                    )}
                    {request.solicitacao_id && (
                      <Badge variant="outline" className="text-xs">
                        Solicitação: {request.solicitacao_id}
                      </Badge>
                    )}
                    {request.promocao && (
                      <Badge className="bg-orange-100 text-orange-800">Promoção</Badge>
                    )}
                    {request.em_promocao && (
                      <Badge className="bg-green-100 text-green-800">Em Promoção</Badge>
                    )}
                    {request.apenas_valor_inteiro && (
                      <Badge className="bg-blue-100 text-blue-800">Valor Inteiro</Badge>
                    )}
                    {request.grupo && (
                      <Badge variant="outline">{request.grupo}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Per Capita</span>
                      <p>{request.per_capita}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Preço</span>
                      <p>R$ {request.preco?.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Unidade</span>
                      <p>{request.unidade}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Qtd Base Embalagem</span>
                      <p>{request.produto_base_qtd_embalagem}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Arredondamento</span>
                      <p>{getRoundingTypeLabel(request.arredondar_tipo || 0)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEdit(request)}
                    disabled={!isOnline}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => request.solicitacao_produto_listagem_id && handleDelete(request.solicitacao_produto_listagem_id)}
                    className="text-red-600 hover:text-red-700"
                    disabled={!isOnline}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            onClick={loadMore} 
            disabled={isLoadingMore || !isOnline}
          >
            {isLoadingMore ? 'Carregando...' : 'Carregar Mais'}
          </Button>
        </div>
      )}

      {/* Empty State */}
      {requests.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhuma solicitação de produto encontrada</p>
            <p className="text-sm">Adicione produtos ao cardápio para começar</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};
