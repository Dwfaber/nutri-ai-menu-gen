import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, LogOut } from 'lucide-react';

export const DemoIndicator = () => {
  const { isDemoMode, signOut } = useAuth();

  if (!isDemoMode) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50/90 border-b border-yellow-200 backdrop-blur-sm dark:bg-yellow-900/20 dark:border-yellow-800">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400">
            <Eye className="w-3 h-3 mr-1" />
            Modo Demonstração
          </Badge>
          <span className="text-sm text-muted-foreground">
            Acesso limitado apenas para visualização
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
        >
          <LogOut className="w-4 h-4 mr-1" />
          Sair do Demo
        </Button>
      </div>
    </div>
  );
};