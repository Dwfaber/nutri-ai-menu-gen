import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateWeeklyTotalFromDailyCosts, getTopExpensiveClients } from '@/utils/costCalculations';

interface CostAnalysis {
  totalCost: number;
  averageCost: number;
  costByDay: Record<string, number>;
  clientsAboveAverage: number;
  costTrend: 'up' | 'down' | 'stable';
  topExpensiveClients: Array<{ name: string; cost: number; filial_id: number }>;
}

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
          // Calculate total cost using daily costs instead of custo_total (which is 0.00)
          const totalCost = costData.reduce((sum, cost) => sum + calculateWeeklyTotalFromDailyCosts(cost), 0);
          const averageCost = totalCost / costData.length;

          const costByDay = {
            Segunda: costData.reduce((sum, cost) => sum + Number(cost.RefCustoSegunda || 0), 0) / costData.length,
            Terça: costData.reduce((sum, cost) => sum + Number(cost.RefCustoTerca || 0), 0) / costData.length,
            Quarta: costData.reduce((sum, cost) => sum + Number(cost.RefCustoQuarta || 0), 0) / costData.length,
            Quinta: costData.reduce((sum, cost) => sum + Number(cost.RefCustoQuinta || 0), 0) / costData.length,
            Sexta: costData.reduce((sum, cost) => sum + Number(cost.RefCustoSexta || 0), 0) / costData.length,
            Sábado: costData.reduce((sum, cost) => sum + Number(cost.RefCustoSabado || 0), 0) / costData.length,
            Domingo: costData.reduce((sum, cost) => sum + Number(cost.RefCustoDomingo || 0), 0) / costData.length,
          };

          const clientsAboveAverage = costData.filter(cost => calculateWeeklyTotalFromDailyCosts(cost) > averageCost).length;
          
          const topExpensiveClients = getTopExpensiveClients(costData, 5);

          // Simple trend calculation based on daily costs
          const recentCosts = costData.slice(0, Math.min(10, costData.length));
          const oldCosts = costData.slice(-Math.min(10, costData.length));
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