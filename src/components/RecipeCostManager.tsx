import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calculator, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useRecipeCosting } from "@/hooks/useRecipeCosting";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const RecipeCostManager = () => {
  const { isRecalculating, stats, logs, triggerRecalculation } = useRecipeCosting();

  const getProgressPercentage = () => {
    if (!stats) return 0;
    return stats.total_recipes > 0 
      ? (stats.recipes_with_cost / stats.total_recipes) * 100 
      : 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluido': return 'default';
      case 'erro': return 'destructive';
      case 'iniciado': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido': return <CheckCircle className="h-3 w-3" />;
      case 'erro': return <AlertCircle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>Gestão de Custos de Receitas</CardTitle>
          </div>
          <CardDescription>
            Gerencie o recálculo automático dos custos das receitas baseado nos preços atuais dos ingredientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Total de Receitas</div>
                <div className="text-2xl font-bold">{stats.total_recipes}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Com Custo Calculado</div>
                <div className="text-2xl font-bold text-green-600">{stats.recipes_with_cost}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Sem Custo</div>
                <div className="text-2xl font-bold text-orange-600">{stats.recipes_without_cost}</div>
              </div>
            </div>
          )}

          {stats && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso dos Cálculos</span>
                <span>{getProgressPercentage().toFixed(1)}%</span>
              </div>
              <Progress value={getProgressPercentage()} className="h-2" />
            </div>
          )}

          {stats && stats.recipes_without_cost > 0 && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-orange-800 dark:text-orange-200">
                  {stats.recipes_without_cost} receitas sem custo calculado
                </div>
                <div className="text-orange-700 dark:text-orange-300">
                  Execute o recálculo para atualizar os custos baseados nos preços atuais dos ingredientes.
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={triggerRecalculation}
              disabled={isRecalculating}
              className="flex items-center gap-2"
            >
              {isRecalculating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Recalculando...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4" />
                  Recalcular Custos
                </>
              )}
            </Button>
          </div>

          {stats && stats.last_calculation && (
            <div className="text-sm text-muted-foreground">
              Último cálculo: {formatDistanceToNow(new Date(stats.last_calculation), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Recálculos</CardTitle>
            <CardDescription>
              Últimas execuções do recálculo de custos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusColor(log.status)} className="flex items-center gap-1">
                      {getStatusIcon(log.status)}
                      {log.status}
                    </Badge>
                    <div className="text-sm">
                      {log.registros_processados} receitas processadas
                    </div>
                    {log.tempo_execucao_ms && (
                      <div className="text-sm text-muted-foreground">
                        {(log.tempo_execucao_ms / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};