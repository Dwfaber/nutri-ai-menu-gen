
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Visão geral do sistema Nutr's IA</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Clientes Ativos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">--</p>
              <p className="text-sm text-gray-500 mt-1">Aguardando sincronização</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Cardápios Gerados</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">--</p>
              <p className="text-sm text-gray-500 mt-1">Aguardando sincronização</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Economia Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">R$ --</p>
              <p className="text-sm text-gray-500 mt-1">Aguardando sincronização</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Taxa de Aceitação</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">--%</p>
              <p className="text-sm text-gray-500 mt-1">Aguardando sincronização</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg font-medium">Nenhuma atividade encontrada</p>
                <p className="text-sm">Sincronize os dados para visualizar atividades recentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Próximas Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg font-medium">Nenhuma ação pendente</p>
                <p className="text-sm">Configure o sistema para visualizar próximas ações</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
