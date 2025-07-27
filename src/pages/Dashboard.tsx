
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ChefHat, DollarSign, TrendingUp, Clock, ShoppingCart, Building2 } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import StatsCard from '@/components/Dashboard/StatsCard';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import ClientSelectorDropdown from '@/components/Dashboard/ClientSelectorDropdown';

const Dashboard = () => {
  const { metrics, isLoading, error, refetch } = useDashboardData();
  const { selectedClient } = useSelectedClient();

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Visão geral do sistema Nutr's IA</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-lg font-medium text-red-600">Erro ao carregar dados</p>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
            <button 
              onClick={refetch}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            {selectedClient ? `Cliente: ${selectedClient.nome_fantasia}` : 'Visão geral do sistema Nutr\'s IA'}
          </p>
        </div>
        <div className="w-80">
          <ClientSelectorDropdown />
        </div>
      </div>

      {/* Client Information Card */}
      {selectedClient && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Building2 className="w-5 h-5" />
              Filial Ativa: {selectedClient.nome_fantasia}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700">Filial ID</p>
                <p className="text-lg font-bold text-primary">{selectedClient.filial_id}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Custo Médio Diário</p>
                <p className="text-lg font-bold text-green-600">R$ {(selectedClient.custo_medio_diario || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Tipo Refeição</p>
                <p className="text-lg font-bold text-blue-600">{selectedClient.tipo_refeicao}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Clientes Ativos"
          value={isLoading ? "--" : metrics.activeClients}
          change={isLoading ? "Carregando..." : `${metrics.totalEmployees} funcionários`}
          changeType="neutral"
          icon={Users}
        />

        <StatsCard
          title="Cardápios Gerados"
          value={isLoading ? "--" : metrics.generatedMenus}
          change={isLoading ? "Carregando..." : `${metrics.monthlyMeals} refeições/mês`}
          changeType="positive"
          icon={ChefHat}
        />

        <StatsCard
          title="Economia Total"
          value={isLoading ? "R$ --" : `R$ ${metrics.totalSavings.toFixed(2)}`}
          change={isLoading ? "Carregando..." : `Orçamento: R$ ${metrics.monthlyBudget.toFixed(2)}`}
          changeType="positive"
          icon={DollarSign}
        />

        <StatsCard
          title="Taxa de Aceitação"
          value={isLoading ? "--%"  : `${metrics.acceptanceRate}%`}
          change={isLoading ? "Carregando..." : `R$ ${metrics.averageMealCost.toFixed(2)} por refeição`}
          changeType="positive"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                {isLoading ? (
                  <div className="animate-pulse">
                    <p className="text-lg font-medium">Carregando atividades...</p>
                  </div>
                ) : metrics.generatedMenus > 0 ? (
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Última Sincronização</p>
                    <p className="text-sm">
                      {metrics.generatedMenus} cardápios processados
                    </p>
                    <p className="text-sm">
                      {metrics.activeClients} clientes ativos
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium">Nenhuma atividade encontrada</p>
                    <p className="text-sm">Configure contratos para visualizar atividades</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Próximas Ações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                {isLoading ? (
                  <div className="animate-pulse">
                    <p className="text-lg font-medium">Carregando ações...</p>
                  </div>
                ) : metrics.activeClients > 0 ? (
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Ações Sugeridas</p>
                    <p className="text-sm">
                      • Gerar cardápios para {metrics.activeClients} clientes
                    </p>
                    <p className="text-sm">
                      • Revisar orçamento mensal: R$ {metrics.monthlyBudget.toFixed(2)}
                    </p>
                    <p className="text-sm">
                      • Otimizar custos das {metrics.monthlyMeals} refeições
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium">Nenhuma ação pendente</p>
                    <p className="text-sm">Configure contratos para visualizar ações</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
