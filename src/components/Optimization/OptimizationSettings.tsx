
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Settings, RotateCcw, Save } from 'lucide-react';
import { OptimizationConfig } from '@/types/optimization';
import { useOptimization } from '@/hooks/useOptimization';

interface OptimizationSettingsProps {
  className?: string;
}

const OptimizationSettings: React.FC<OptimizationSettingsProps> = ({ className }) => {
  const { config, updateConfig, resetConfig } = useOptimization();

  const handleToleranciaChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
      updateConfig({ tolerancia_sobra_percentual: numValue });
    }
  };

  const handleMaxEmbalagensChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
      updateConfig({ maximo_tipos_embalagem_por_produto: numValue });
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Configurações de Otimização</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prioridade de Promoções */}
        <div className="space-y-2">
          <Label htmlFor="prioridade-promocao">Prioridade para Promoções</Label>
          <Select
            value={config.prioridade_promocao}
            onValueChange={(value: 'alta' | 'media' | 'baixa') => 
              updateConfig({ prioridade_promocao: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alta">Alta - Sempre priorizar promoções</SelectItem>
              <SelectItem value="media">Média - Balancear preço e promoção</SelectItem>
              <SelectItem value="baixa">Baixa - Focar apenas no menor preço</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tolerância de Sobra */}
        <div className="space-y-2">
          <Label htmlFor="tolerancia-sobra">
            Tolerância de Sobra ({config.tolerancia_sobra_percentual}%)
          </Label>
          <Input
            id="tolerancia-sobra"
            type="number"
            min="0"
            max="50"
            step="0.5"
            value={config.tolerancia_sobra_percentual}
            onChange={(e) => handleToleranciaChange(e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-gray-500">
            Percentual máximo de sobra aceito para produtos integrais
          </p>
        </div>

        {/* Máximo de Tipos de Embalagem */}
        <div className="space-y-2">
          <Label htmlFor="max-embalagens">
            Máximo de Tipos por Produto ({config.maximo_tipos_embalagem_por_produto})
          </Label>
          <Input
            id="max-embalagens"
            type="number"
            min="1"
            max="10"
            value={config.maximo_tipos_embalagem_por_produto}
            onChange={(e) => handleMaxEmbalagensChange(e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-gray-500">
            Limite de diferentes embalagens para o mesmo produto base
          </p>
        </div>

        {/* Preferir Produtos Integrais */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Preferir Produtos Integrais</Label>
            <p className="text-xs text-gray-500">
              Priorizar produtos que só podem ser comprados em pacotes fechados
            </p>
          </div>
          <Switch
            checked={config.preferir_produtos_integrais}
            onCheckedChange={(checked) => 
              updateConfig({ preferir_produtos_integrais: checked })
            }
          />
        </div>

        {/* Considerar Custo de Compra */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Usar Preço de Compra</Label>
            <p className="text-xs text-gray-500">
              Usar preço de compra ao invés do preço de venda para otimização
            </p>
          </div>
          <Switch
            checked={config.considerar_custo_compra}
            onCheckedChange={(checked) => 
              updateConfig({ considerar_custo_compra: checked })
            }
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex space-x-2 pt-4">
          <Button 
            variant="outline" 
            onClick={resetConfig}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Padrão
          </Button>
        </div>

        {/* Resumo da Configuração */}
        <div className="bg-gray-50 p-3 rounded-lg mt-4">
          <h4 className="text-sm font-medium mb-2">Resumo da Configuração:</h4>
          <ul className="text-xs space-y-1 text-gray-600">
            <li>• Prioridade de promoções: {config.prioridade_promocao}</li>
            <li>• Tolerância de sobra: {config.tolerancia_sobra_percentual}%</li>
            <li>• Máx. tipos por produto: {config.maximo_tipos_embalagem_por_produto}</li>
            <li>• Preferir integrais: {config.preferir_produtos_integrais ? 'Sim' : 'Não'}</li>
            <li>• Usar preço compra: {config.considerar_custo_compra ? 'Sim' : 'Não'}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default OptimizationSettings;
