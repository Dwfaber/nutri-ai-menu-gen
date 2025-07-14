
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ChefHat, 
  ShoppingCart, 
  BarChart3, 
  Settings,
  Brain,
  Network
} from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/cardapios', icon: ChefHat, label: 'Cardápios' },
    { path: '/compras', icon: ShoppingCart, label: 'Lista de Compras' },
    { path: '/relatorios', icon: BarChart3, label: 'Relatórios' },
    { path: '/arquitetura', icon: Network, label: 'Arquitetura' },
    { path: '/configuracoes', icon: Settings, label: 'Configurações' }
  ];

  return (
    <aside className="bg-white w-64 min-h-screen border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Nutr's IA</h1>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-700 border-r-2 border-green-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          © 2024 Nutr's IA
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
