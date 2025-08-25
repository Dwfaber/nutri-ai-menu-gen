import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WeeklyCostData {
  day: string;
  cost: number;
  fullDay: string;
}

const WeeklyCostChart = () => {
  const [weeklyData, setWeeklyData] = useState<WeeklyCostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalWeeklyCost, setTotalWeeklyCost] = useState(0);

  useEffect(() => {
    const fetchWeeklyCosts = async () => {
      try {
        const { data: costData, error } = await supabase
          .from('custos_filiais')
          .select('RefCustoSegunda, RefCustoTerca, RefCustoQuarta, RefCustoQuinta, RefCustoSexta, RefCustoSabado, RefCustoDomingo');

        if (error) throw error;

        if (costData && costData.length > 0) {
          // Calculate average costs for each day
          const averageCosts = {
            segunda: costData.reduce((sum, cost) => sum + Number(cost.RefCustoSegunda || 0), 0) / costData.length,
            terca: costData.reduce((sum, cost) => sum + Number(cost.RefCustoTerca || 0), 0) / costData.length,
            quarta: costData.reduce((sum, cost) => sum + Number(cost.RefCustoQuarta || 0), 0) / costData.length,
            quinta: costData.reduce((sum, cost) => sum + Number(cost.RefCustoQuinta || 0), 0) / costData.length,
            sexta: costData.reduce((sum, cost) => sum + Number(cost.RefCustoSexta || 0), 0) / costData.length,
            sabado: costData.reduce((sum, cost) => sum + Number(cost.RefCustoSabado || 0), 0) / costData.length,
            domingo: costData.reduce((sum, cost) => sum + Number(cost.RefCustoDomingo || 0), 0) / costData.length,
          };

          const chartData: WeeklyCostData[] = [
            { day: 'Seg', cost: averageCosts.segunda, fullDay: 'Segunda-feira' },
            { day: 'Ter', cost: averageCosts.terca, fullDay: 'Terça-feira' },
            { day: 'Qua', cost: averageCosts.quarta, fullDay: 'Quarta-feira' },
            { day: 'Qui', cost: averageCosts.quinta, fullDay: 'Quinta-feira' },
            { day: 'Sex', cost: averageCosts.sexta, fullDay: 'Sexta-feira' },
            { day: 'Sáb', cost: averageCosts.sabado, fullDay: 'Sábado' },
            { day: 'Dom', cost: averageCosts.domingo, fullDay: 'Domingo' },
          ];

          const total = Object.values(averageCosts).reduce((sum, cost) => sum + cost, 0);
          
          setWeeklyData(chartData);
          setTotalWeeklyCost(total);
        }
      } catch (error) {
        console.error('Erro ao carregar custos semanais:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeeklyCosts();
  }, []);

  const formatCurrency = (value: number) => `R$ ${value.toFixed(0)}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.fullDay}</p>
          <p className="text-primary font-bold">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Custos por Dia da Semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              Carregando gráfico de custos...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Custos por Dia da Semana
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Total semanal médio: <span className="font-bold text-primary">{formatCurrency(totalWeeklyCost)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCurrency}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="cost" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                className="opacity-80 hover:opacity-100 transition-opacity"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Valores representam a média de custos por dia entre todos os clientes
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyCostChart;