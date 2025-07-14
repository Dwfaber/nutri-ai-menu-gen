
import StatsCard from '../components/Dashboard/StatsCard';
import RecentActivity from '../components/Dashboard/RecentActivity';
import { Users, ChefHat, TrendingUp, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Visão geral do sistema Nutr's IA</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Clientes Ativos"
          value="12"
          change="+2 este mês"
          changeType="positive"
          icon={Users}
        />
        <StatsCard
          title="Cardápios Gerados"
          value="48"
          change="+8 esta semana"
          changeType="positive"
          icon={ChefHat}
        />
        <StatsCard
          title="Economia Total"
          value="R$ 15.240"
          change="+12% vs mês anterior"
          changeType="positive"
          icon={DollarSign}
        />
        <StatsCard
          title="Taxa de Aceitação"
          value="94%"
          change="+3% vs mês anterior"
          changeType="positive"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity />
        
        <Card>
          <CardHeader>
            <CardTitle>Próximas Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Renovação de Contrato</h4>
                  <p className="text-sm text-gray-600">Tech Corp - Vence em 15 dias</p>
                </div>
                <div className="text-sm font-medium text-yellow-600">Pendente</div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Relatório Mensal</h4>
                  <p className="text-sm text-gray-600">StartupXYZ - Gerar até quinta</p>
                </div>
                <div className="text-sm font-medium text-blue-600">Programado</div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Cardápio Semanal</h4>
                  <p className="text-sm text-gray-600">Empresa ABC - Pronto para envio</p>
                </div>
                <div className="text-sm font-medium text-green-600">Concluído</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
