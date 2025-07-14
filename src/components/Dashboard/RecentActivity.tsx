
import { Clock, ChefHat, ShoppingCart, FileText } from 'lucide-react';

const RecentActivity = () => {
  const activities = [
    {
      id: 1,
      type: 'menu',
      title: 'Cardápio semanal gerado',
      client: 'Tech Corp',
      time: '2 horas atrás',
      icon: ChefHat
    },
    {
      id: 2,
      type: 'purchase',
      title: 'Lista de compras otimizada',
      client: 'StartupXYZ',
      time: '4 horas atrás',
      icon: ShoppingCart
    },
    {
      id: 3,
      type: 'report',
      title: 'Relatório mensal gerado',
      client: 'Empresa ABC',
      time: '1 dia atrás',
      icon: FileText
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Atividade Recente</h3>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                <activity.icon className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{activity.title}</h4>
                <p className="text-sm text-gray-600">{activity.client}</p>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                {activity.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;
