
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ChefHat, 
  ShoppingCart, 
  BarChart3, 
  Settings,
  Brain,
  History
} from 'lucide-react';
import logo from "@/assets/nutris-logo.png";

const Sidebar = () => {
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/cardapios', icon: ChefHat, label: 'Cardápios' },
    { path: '/receitas', icon: Brain, label: 'Receitas' },
    { path: '/compras', icon: ShoppingCart, label: 'Lista de Compras' },
    { path: '/relatorios', icon: BarChart3, label: 'Relatórios' },
    { path: '/atualizacoes', icon: History, label: 'Atualizações' },
    { path: '/configuracoes', icon: Settings, label: 'Configurações' }
  ];

  return (
    <aside className="bg-card w-64 min-h-screen border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-center">
          <img 
            src={logo} 
            alt="Nutr's Refeições Coletivas" 
            className="h-10 object-contain"
          />
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
                      ? 'bg-primary/10 text-primary border-r-2 border-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
      
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          © 2024 Nutr's IA
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
