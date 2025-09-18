import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Package, ShoppingCart, Percent } from "lucide-react";

interface OptimizationSummary {
  total_cost: number;
  cost_per_meal: number;
  total_meals: number;
  total_products: number;
  promotional_items: number;
  estimated_savings: number;
  savings_percentage: number;
  surplus_info: {
    total_surplus: number;
    products_with_surplus: number;
  };
}

interface OptimizedPurchasesSummaryProps {
  summary: OptimizationSummary;
}

export function OptimizedPurchasesSummary({ summary }: OptimizedPurchasesSummaryProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Resumo da Otimização de Compras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              R$ {summary.cost_per_meal.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">Por Refeição</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold">
              R$ {summary.total_cost.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">Custo Total</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold">
              {summary.total_meals}
            </div>
            <div className="text-sm text-muted-foreground">Refeições</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold">
              {summary.total_products}
            </div>
            <div className="text-sm text-muted-foreground">Produtos</div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Economia</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-green-600">
                R$ {summary.estimated_savings.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {summary.savings_percentage.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Promoções</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-orange-600">
                {summary.promotional_items}
              </div>
              <div className="text-xs text-muted-foreground">
                produtos
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Sobras</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-blue-600">
                {summary.surplus_info.products_with_surplus}
              </div>
              <div className="text-xs text-muted-foreground">
                produtos
              </div>
            </div>
          </div>
        </div>

        {summary.estimated_savings > 0 && (
          <div className="flex items-center justify-center p-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
              💰 Economia de R$ {summary.estimated_savings.toFixed(2)} vs compra diária
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}