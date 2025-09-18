import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package2, Percent, TrendingUp } from "lucide-react";

interface OptimizedPurchase {
  produto_base_id: number;
  nome: string;
  total_needed: number;
  packages_to_buy: number;
  total_quantity_bought: number;
  total_cost: number;
  cost_per_unit: number;
  surplus: number;
  packaging_info: {
    descricao: string;
    quantidade_embalagem: number;
    preco: number;
    preco_compra: number;
    apenas_valor_inteiro: boolean;
    em_promocao: boolean;
  };
  daily_distribution: Array<{
    date: string;
    quantity_used: number;
    cost_allocated: number;
  }>;
}

interface OptimizedPurchasesTableProps {
  purchases: OptimizedPurchase[];
}

export function OptimizedPurchasesTable({ purchases }: OptimizedPurchasesTableProps) {
  const formatQuantity = (qty: number, unit?: string) => {
    return `${qty.toFixed(2)}${unit ? ` ${unit}` : ''}`;
  };

  const getSurplusPercentage = (surplus: number, total: number) => {
    return total > 0 ? (surplus / total) * 100 : 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package2 className="h-5 w-5" />
          Lista de Compras Otimizada
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Necessário</TableHead>
                <TableHead className="text-center">Embalagens</TableHead>
                <TableHead className="text-center">Total Compra</TableHead>
                <TableHead className="text-center">Sobra</TableHead>
                <TableHead className="text-right">Custo Total</TableHead>
                <TableHead className="text-right">Custo/Unidade</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => {
                const surplusPercentage = getSurplusPercentage(purchase.surplus, purchase.total_quantity_bought);
                
                return (
                  <TableRow key={purchase.produto_base_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{purchase.nome}</div>
                        <div className="text-sm text-muted-foreground">
                          {purchase.packaging_info.descricao}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="font-medium">
                        {formatQuantity(purchase.total_needed)}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {purchase.packages_to_buy}x
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatQuantity(purchase.packaging_info.quantidade_embalagem)} cada
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="font-medium">
                        {formatQuantity(purchase.total_quantity_bought)}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="font-medium">
                        {formatQuantity(purchase.surplus)}
                      </div>
                      {surplusPercentage > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {surplusPercentage.toFixed(1)}%
                        </div>
                      )}
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="font-bold">
                        R$ {purchase.total_cost.toFixed(2)}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="font-medium">
                        R$ {purchase.cost_per_unit.toFixed(4)}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-1">
                        {purchase.packaging_info.em_promocao && (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            <Percent className="h-3 w-3 mr-1" />
                            Promoção
                          </Badge>
                        )}
                        {purchase.surplus === 0 && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Exato
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}