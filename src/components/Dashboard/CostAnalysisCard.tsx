import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateWeeklyTotalFromDailyCosts, getTopExpensiveClients } from '@/utils/costCalculations';
import { ClientCostDetails } from '@/types/clientCosts';

interface CostAnalysis {
  totalCost: number;
  averageCost: number;
  costByDay: Record<string, number>;
  clientsAboveAverage: number;
  costTrend: 'up' | 'down' | 'stable';
  topExpensiveClients: Array<{ name: string; cost: number; filial_id: number }>;
}

const toCCD = (row: any): ClientCostDetails => ({
  id: row.id,
  cliente_id_legado: row.cliente_id_legado || 0,
  filial_id: row.filial_id || 0,
  nome_filial: row.nome_filial || '',
  razao_social: row.razao_social || '',
  nome_fantasia: row.nome_fantasia || '',
  custo_total: Number(row.custo_total || 0),
  custo_medio_semanal: Number(row.custo_medio_semanal || 0),
  RefCustoSegunda: Number(row.RefCustoSegunda || 0),
  RefCustoTerca: Number(row.RefCustoTerca || 0),
  RefCustoQuarta: Number(row.RefCustoQuarta || 0),
  RefCustoQuinta: Number(row.RefCustoQuinta || 0),
  RefCustoSexta: Number(row.RefCustoSexta || 0),
  RefCustoSabado: Number(row.RefCustoSabado || 0),
  RefCustoDomingo: Number(row.RefCustoDomingo || 0),
  RefCustoDiaEspecial: Number(row.RefCustoDiaEspecial || 0),
  QtdeRefeicoesUsarMediaValidarSimNao: !!row.QtdeRefeicoesUsarMediaValidarSimNao,
  PorcentagemLimiteAcimaMedia: Number(row.PorcentagemLimiteAcimaMedia || 0),
  solicitacao_filial_custo_id: row.solicitacao_filial_custo_id || 0,
  solicitacao_compra_tipo_id: row.solicitacao_compra_tipo_id || 0,
  solicitacao_compra_tipo_descricao: row.solicitacao_compra_tipo_descricao || '',
  user_name: row.user_name || '',
  user_date_time: row.user_date_time || '',
  sync_at: row.sync_at || '',
  created_at: row.created_at || '',
  updated_at: row.updated_at || ''
});

const CostAnalysisCard = () => {
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCostAnalysis = async () => {
      try {
        const { data: costData, error } = await supabase
          .from('custos_filiais')
          .select('*');

        if (error) throw error;

        if (costData && costData.length > 0) {
          const mapped = costData.map(toCCD);
          // Calculate total cost using daily costs instead of custo_total (which is 0.00)
          const totalCost = mapped.reduce((sum, cost) => sum + calculateWeeklyTotalFromDailyCosts(cost), 0);
          const averageCost = totalCost / mapped.length;

          const costByDay = {
            Segunda: mapped.reduce((sum, cost) => sum + Number(cost.RefCustoSegunda || 0), 0) / mapped.length,
            Terça: mapped.reduce((sum, cost) => sum + Number(cost.RefCustoTerca || 0), 0) / mapped.length,
            Quarta: mapped.reduce((sum, cost) => sum + Number(cost.RefCustoQuarta || 0), 0) / mapped.length,
            Quinta: mapped.reduce((sum, cost) => sum + Number(cost.RefCustoQuinta || 0), 0) / mapped.length,
            Sexta: mapped.reduce((sum, cost) => sum + Number(cost.RefCustoSexta || 0), 0) / mapped.length,
            Sábado: mapped.reduce((sum, cost) => sum + Number(cost.RefCustoSabado || 0), 0) / mapped.length,
            Domingo: mapped.reduce((sum, cost) => sum + Number(cost.RefCustoDomingo || 0), 0) / mapped.length,
          };

          const clientsAboveAverage = mapped.filter(cost => calculateWeeklyTotalFromDailyCosts(cost) > averageCost).length;
          
          const topExpensiveClients = getTopExpensiveClients(mapped, 5);

          // Simple trend calculation based on daily costs
          const recentCosts = mapped.slice(0, Math.min(10, mapped.length));
          const oldCosts = mapped.slice(-Math.min(10, mapped.length));
          const recentAvg = recentCosts.reduce((sum, cost) => sum + calculateWeeklyTotalFromDailyCosts(cost), 0) / recentCosts.length;
          const oldAvg = oldCosts.reduce((sum, cost) => sum + calculateWeeklyTotalFromDailyCosts(cost), 0) / oldCosts.length;
          
          let costTrend: 'up' | 'down' | 'stable' = 'stable';
          if (recentAvg > oldAvg * 1.05) costTrend = 'up';
          else if (recentAvg < oldAvg * 0.95) costTrend = 'down';

          setAnalysis({
            totalCost,
            averageCost,
            costByDay,
            clientsAboveAverage,
            costTrend,
            topExpensiveClients
          });
        }
      } catch (error) {
        console.error('Erro ao carregar análise de custos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCostAnalysis();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Análise de Custos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Análise de Custos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Dados de custo não disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const highestCostDay = Object.entries(analysis.costByDay).reduce((a, b) => 
    a[1] > b[1] ? a : b
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Análise de Custos
          <Badge variant={analysis.costTrend === 'up' ? 'destructive' : analysis.costTrend === 'down' ? 'default' : 'secondary'}>
            {analysis.costTrend === 'up' && <TrendingUp className="w-3 h-3 mr-1" />}
            {analysis.costTrend === 'down' && <TrendingDown className="w-3 h-3 mr-1" />}
            {analysis.costTrend === 'up' ? 'Crescimento' : analysis.costTrend === 'down' ? 'Redução' : 'Estável'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Custo Médio</p>
            <p className="text-lg font-bold text-primary">R$ {analysis.averageCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Acima da Média</p>
            <p className="text-lg font-bold text-secondary">{analysis.clientsAboveAverage} clientes</p>
          </div>
        </div>

        {/* Highest Cost Day */}
        <div className="p-3 bg-accent/10 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">Dia mais caro:</span>
            <Badge variant="outline">{highestCostDay[0]}</Badge>
          </div>
          <p className="text-lg font-bold text-accent mt-1">R$ {highestCostDay[1].toFixed(2)}</p>
        </div>

        {/* Top Expensive Clients */}
        <div>
          <h4 className="text-sm font-medium mb-2">Top 3 Clientes (Custo)</h4>
          <div className="space-y-2">
            {analysis.topExpensiveClients.slice(0, 3).map((client, index) => (
              <div key={client.filial_id} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                <div>
                  <p className="text-sm font-medium truncate max-w-[120px]">{client.name}</p>
                  <p className="text-xs text-muted-foreground">Filial {client.filial_id}</p>
                </div>
                <Badge variant={index === 0 ? 'destructive' : index === 1 ? 'secondary' : 'outline'}>
                  R$ {client.cost.toFixed(0)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CostAnalysisCard;