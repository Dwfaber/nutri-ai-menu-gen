import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileJson, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { AuditResult } from '@/hooks/useRecipeAuditor';
import { CategoryAuditCard } from './CategoryAuditCard';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AuditResultsProps {
  result: AuditResult;
  onExportJSON?: () => void;
  onExportCSV?: () => void;
}

export const AuditResults = ({ result, onExportJSON, onExportCSV }: AuditResultsProps) => {
  // Validação de segurança
  if (!result?.resumo_geral || !result?.categorias_auditadas) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Dados de auditoria incompletos. Execute a auditoria novamente.
        </AlertDescription>
      </Alert>
    );
  }

  const percentualValidas = result.resumo_geral.total_receitas_testadas > 0
    ? (result.resumo_geral.receitas_validas / result.resumo_geral.total_receitas_testadas) * 100
    : 0;

  const percentualProblematicas = 100 - percentualValidas;

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <Card className="border-2 border-primary shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">📊 Resumo Geral da Auditoria</CardTitle>
            <div className="flex gap-2">
              {onExportJSON && (
                <Button variant="outline" size="sm" onClick={onExportJSON}>
                  <FileJson className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              )}
              {onExportCSV && (
                <Button variant="outline" size="sm" onClick={onExportCSV}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Auditoria realizada em {new Date(result.data_auditoria).toLocaleString('pt-BR')}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Estatísticas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-primary/5">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Testadas</div>
                <div className="text-3xl font-bold text-primary">
                  {result.resumo_geral.total_receitas_testadas}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  em {result.categorias_auditadas.length} categorias
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-500/10">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Receitas Válidas</div>
                <div className="text-3xl font-bold text-green-600">
                  {result.resumo_geral.receitas_validas}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {percentualValidas.toFixed(1)}% do total
                </div>
              </CardContent>
            </Card>

            <Card className="bg-destructive/10">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Receitas Problemáticas</div>
                <div className="text-3xl font-bold text-destructive">
                  {result.resumo_geral.receitas_problematicas}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {percentualProblematicas.toFixed(1)}% do total
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Progresso Visual */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600 font-medium">
                ✅ {percentualValidas.toFixed(1)}% Válidas
              </span>
              <span className="text-destructive font-medium">
                ❌ {percentualProblematicas.toFixed(1)}% Problemáticas
              </span>
            </div>
            <div className="relative">
              <Progress value={percentualValidas} className="h-4" />
            </div>
          </div>

          {/* Problemas por Tipo */}
          {Object.keys(result.resumo_geral.problemas_por_tipo).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Distribuição de Problemas</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(result.resumo_geral.problemas_por_tipo)
                  .sort(([, a], [, b]) => b - a)
                  .map(([tipo, count]) => (
                    <Card key={tipo} className="bg-muted/30">
                      <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">{tipo}</div>
                        <div className="text-lg font-bold">{count}</div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categorias Auditadas */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">
          Detalhamento por Categoria ({result.categorias_auditadas.length})
        </h3>
        
        {result.categorias_auditadas.map(categoryReport => (
          <CategoryAuditCard
            key={categoryReport.categoria}
            report={categoryReport}
          />
        ))}
      </div>

      {/* Recomendações */}
      {result.resumo_geral.receitas_problematicas > 0 && (
        <Card className="border-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              💡 Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Revisar receitas com severidade "Crítica" imediatamente</li>
              <li>Recalcular custos das receitas com preços ausentes</li>
              <li>Verificar ingredientes obrigatórios faltantes</li>
              <li>Considerar adicionar termos extraídos aos critérios de validação</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
