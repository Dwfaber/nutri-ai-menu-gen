import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, DollarSign, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useProductRequests, ProductRequest } from '@/hooks/useProductRequests';
import { supabase } from '@/integrations/supabase/client';

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
    createRequest, 
    updateRequest, 
    deleteRequest,
    calculateTotalCost,
    calculateTotalPurchaseCost 
  } = useProductRequests();
  
  const [availableProducts, setAvailableProducts] = useState<LegacyProduct[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ProductRequest | null>(null);
  const [formData, setFormData] = useState<Partial<ProductRequest>>({
    solicitacao_id: Date.now(),
    per_capita: 0,
    inteiro: false,
    arredondar_tipo: 0,
    promocao: false,
    quantidade_embalagem: 1,
    apenas_valor_inteiro: false,
    em_promocao: false,
    produto_base_qtd_embalagem: 1
  });

  // Load available products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('produtos_legado')
        .select('*')
        .eq('disponivel', true)
        .order('nome');

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      setAvailableProducts(data || []);
    };

    fetchProducts();
  }, []);

  // Update parent component with cost changes
  useEffect(() => {
    if (onCostChange) {
      const totalCost = calculateTotalCost();
      const purchaseCost = calculateTotalPurchaseCost();
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
      ...formData,
      solicitacao_id: editingRequest ? editingRequest.solicitacao_id : Date.now()
    } as ProductRequest;

    if (editingRequest) {
      await updateRequest(editingRequest.solicitacao_id, requestData);
      setEditingRequest(null);
    } else {
      await createRequest(requestData);
    }

    setFormData({
      solicitacao_id: Date.now(),
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Solicitações de Produtos</h3>
          <p className="text-sm text-gray-600">Gerencie os produtos do cardápio</p>
        </div>
        <Button 
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Produto
        </Button>
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
              <Button onClick={handleSubmit} disabled={isLoading}>
                {editingRequest ? 'Atualizar' : 'Adicionar'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setEditingRequest(null);
                  setFormData({
                    solicitacao_id: Date.now(),
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
                <p className="text-2xl font-bold">{requests.length}</p>
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
          <Card key={request.solicitacao_id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium">{request.descricao}</h4>
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
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDelete(request.solicitacao_id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {requests.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhuma solicitação de produto encontrada</p>
            <p className="text-sm">Adicione produtos ao cardápio para começar</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
