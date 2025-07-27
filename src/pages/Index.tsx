
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChefHat, ShoppingCart, BarChart3, Settings } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  // Redirect to dashboard after a brief moment to show the landing page
  useEffect(() => {
    // Don't auto-redirect, let user choose when to proceed
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Nutr's IA
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Sistema Inteligente para Automação de Cardápios Corporativos
          </p>
          <p className="text-sm text-muted-foreground">
            Otimização de compras, criação de cardápios e relatórios de desempenho
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/')}>
            <CardHeader className="text-center">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-primary" />
              <CardTitle className="text-lg">Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Visão geral e métricas do sistema
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/cardapios')}>
            <CardHeader className="text-center">
              <ChefHat className="w-8 h-8 mx-auto mb-2 text-primary" />
              <CardTitle className="text-lg">Cardápios</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Geração inteligente de cardápios
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/compras')}>
            <CardHeader className="text-center">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-primary" />
              <CardTitle className="text-lg">Compras</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Otimização de listas de compras
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/relatorios')}>
            <CardHeader className="text-center">
              <Settings className="w-8 h-8 mx-auto mb-2 text-primary" />
              <CardTitle className="text-lg">Relatórios</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Análises e relatórios detalhados
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button onClick={() => navigate('/')} size="lg" className="px-8">
            Acessar Sistema
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
