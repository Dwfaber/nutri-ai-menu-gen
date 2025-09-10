
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ChefHat, DollarSign, TrendingUp, Building2 } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import StatsCard from '@/components/Dashboard/StatsCard';
import { useSelectedClient } from '@/contexts/SelectedClientContext';
import ClientSelectorDropdown from '@/components/Dashboard/ClientSelectorDropdown';
import WeeklyCostChart from '@/components/Dashboard/WeeklyCostChart';
import CostAnalysisCard from '@/components/Dashboard/CostAnalysisCard';
import logo from "@/assets/nutris-logo.png";

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
        <div className="flex items-center gap-4">
          <img 
            src={logo} 
            alt="Nutr's Refeições Coletivas" 
            className="h-12 object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              {selectedClient ? `Cliente: ${selectedClient.nome_fantasia}` : 'Visão geral do sistema Nutr\'s IA'}
            </p>
          </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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
          title="Custo Diário Médio (contratual)"
          value={isLoading ? "R$ --" : `R$ ${metrics.averageDailyCost.toFixed(2)}`}
          change={isLoading ? "Carregando..." : "Baseado em dados contratuais"}
          changeType="neutral"
          icon={DollarSign}
        />

        <StatsCard
          title="Custo por Refeição (contratual)"
          value={isLoading ? "R$ --" : `R$ ${metrics.averageContractMealCost.toFixed(2)}`}
          change={isLoading ? "Carregando..." : "Equivalente contratual por refeição"}
          changeType="neutral"
          icon={DollarSign}
        />

        <StatsCard
          title="Taxa de Aceitação"
          value={isLoading ? "--%"  : `${metrics.acceptanceRate}%`}
          change={isLoading ? "Carregando..." : `Economia: R$ ${metrics.totalSavings.toFixed(2)}`}
          changeType="positive"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyCostChart />
        <CostAnalysisCard />
      </div>
    </div>
  );
};

export default Dashboard;
