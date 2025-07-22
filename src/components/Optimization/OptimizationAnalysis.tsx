
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Percent, 
  DollarSign,
  AlertTriangle,
  CheckCircle 
} from 'lucide-react';
import { OptimizationResult, OptimizationSummary } from '@/types/optimization';

interface OptimizationAnalysisProps {
  results: OptimizationResult[];
  summary?: OptimizationSummary;
  className?: string;
}

const OptimizationAnalysis: React.FC<OptimizationAnalysisProps> = ({ 
  results, 
  summary,
  className 
}) => {
  const totalEconomia = results.reduce((sum, result) => sum + result.economia_obtida, 0);
  const totalCusto = results.reduce((sum, result) => sum + result.custo_total, 0);
  const produtosComSobra = results.filter(r => r.sobra > 0).length;
  const produtosComPromocao = results.filter(r => 
    r.pacotes_selecionados.some(p => p.em_promocao)
  ).length;

  const economiaPercentual = totalCusto > 0 ? (totalEconomia / (totalCusto + totalEconomia)) * 100 : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Economia Total</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {totalEconomia.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  {economiaPercentual.toFixed(1)}% de economia
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Produtos Analisados</p>
                <p className="text-2xl font-bold">{results.length}</p>
                <p className="text-xs text-gray-500">
                  {produtosComPromocao} com promoções
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Percent className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Produtos com Sobra</p>
                <p className="text-2xl font-bold">{produtosComSobra}</p>
                <p className="text-xs text-gray-500">
                  de {results.length} produtos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              {economiaPercentual > 5 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-600">Eficiência</p>
                <p className={`text-2xl font-bold ${
                  economiaPercentual > 5 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {economiaPercentual > 5 ? 'Alta' : 'Baixa'}
                </p>
                <p className="text-xs text-gray-500">
                  Otimização {economiaPercentual.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista Detalhada de Resultados */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Otimização</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.produto_base_id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{result.produto_base_nome}</h4>
                    <p className="text-sm text-gray-600">
                      Solicitado: {result.quantidade_solicitada.toFixed(2)} | 
                      Comprado: {result.quantidade_total_comprada.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R$ {result.custo_total.toFixed(2)}</p>
                    {result.economia_obtida > 0 && (
                      <p className="text-sm text-green-600">
                        -R$ {result.economia_obtida.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Badges de Status */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {result.sobra > 0 && (
                    <Badge variant="outline" className="text-orange-600">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Sobra: {result.sobra.toFixed(2)}
                    </Badge>
                  )}
                  {result.pacotes_selecionados.some(p => p.em_promocao) && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Com Promoção
                    </Badge>
                  )}
                  {result.economia_obtida > 0 && (
                    <Badge className="bg-blue-100 text-blue-800">
                      Otimizado
                    </Badge>
                  )}
                </div>

                {/* Pacotes Selecionados */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Pacotes Selecionados:</h5>
                  {result.pacotes_selecionados.map((pacote, index) => (
                    <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                      <div className="flex justify-between items-center">
                        <span>
                          {pacote.quantidade_pacotes}x {pacote.descricao}
                        </span>
                        <span className="font-medium">
                          R$ {pacote.custo_total.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {pacote.motivo_selecao}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Justificativa */}
                {result.justificativa && (
                  <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                    <p className="text-blue-800">{result.justificativa}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OptimizationAnalysis;
