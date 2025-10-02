import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { CategoryAuditReport, ReceitaAuditada } from '@/hooks/useRecipeAuditor';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useState } from 'react';

interface CategoryAuditCardProps {
  report: CategoryAuditReport;
}

const getSeverityBadge = (severidade: string) => {
  const variants: Record<string, { variant: any; label: string }> = {
    critica: { variant: 'destructive', label: 'Crítica' },
    alta: { variant: 'default', label: 'Alta' },
    media: { variant: 'secondary', label: 'Média' },
    baixa: { variant: 'outline', label: 'Baixa' }
  };

  const config = variants[severidade] || variants.media;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const CategoryAuditCard = ({ report }: CategoryAuditCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const percentualValidas = report.receitas_testadas > 0
    ? (report.receitas_validas.length / report.receitas_testadas) * 100
    : 0;

  const totalProblemas = Object.values(report.estatisticas.problemas_por_severidade).reduce((a, b) => a + b, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-primary">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                <CardTitle className="text-lg">{report.categoria}</CardTitle>
                {report.receitas_problematicas.length === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {report.receitas_testadas} receitas testadas
                </div>
                <Badge variant={percentualValidas >= 80 ? 'default' : 'destructive'}>
                  {percentualValidas.toFixed(0)}% válidas
                </Badge>
              </div>
            </div>

            <div className="mt-3">
              <Progress value={percentualValidas} className="h-2" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-4">
            {/* Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Custo Mínimo</div>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <TrendingDown className="h-4 w-4 text-green-500" />
                    R$ {report.estatisticas.custo_minimo.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Custo Máximo</div>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-destructive" />
                    R$ {report.estatisticas.custo_maximo.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Custo Médio</div>
                  <div className="text-2xl font-bold text-primary">
                    R$ {report.estatisticas.custo_medio.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Total Problemas</div>
                  <div className="text-2xl font-bold text-destructive">
                    {totalProblemas}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribuição de Problemas */}
            {totalProblemas > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Problemas por Severidade</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(report.estatisticas.problemas_por_severidade).map(([sev, count]) => (
                    count > 0 && (
                      <div key={sev} className="flex items-center gap-2 text-sm">
                        {getSeverityBadge(sev)}
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Termos Extraídos */}
            <Collapsible open={showTerms} onOpenChange={setShowTerms}>
              <CollapsibleTrigger asChild>
                <button className="w-full text-left">
                  <h4 className="font-semibold text-sm flex items-center gap-2 hover:text-primary transition-colors">
                    <ChevronDown className={`h-4 w-4 transition-transform ${showTerms ? 'rotate-180' : ''}`} />
                    Termos Extraídos ({report.termos_extraidos.palavras_chave.length} palavras-chave)
                  </h4>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Ingredientes Principais:</p>
                    <div className="flex flex-wrap gap-1">
                      {report.termos_extraidos.ingredientes_principais.slice(0, 20).map(ing => (
                        <Badge key={ing} variant="secondary" className="text-xs">
                          {ing}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Palavras-Chave (Top 30):</p>
                    <div className="flex flex-wrap gap-1">
                      {report.termos_extraidos.palavras_chave.slice(0, 30).map(palavra => (
                        <Badge key={palavra} variant="outline" className="text-xs">
                          {palavra}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Receitas Problemáticas */}
            {report.receitas_problematicas.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">
                  Receitas Problemáticas ({report.receitas_problematicas.length})
                </h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receita</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-center">Problemas</TableHead>
                        <TableHead className="text-center">Severidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {report.receitas_problematicas.slice(0, 10).map(receita => (
                        <TableRow key={receita.receita_id}>
                          <TableCell className="font-medium">{receita.nome}</TableCell>
                          <TableCell className="text-right">
                            R$ {(receita.custo_por_porcao ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {receita.problemas_detectados.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {getSeverityBadge(receita.validacao.severidade)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {report.receitas_problematicas.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Mostrando 10 de {report.receitas_problematicas.length} receitas problemáticas
                  </p>
                )}
              </div>
            )}

            {/* Receitas Válidas (resumo) */}
            {report.receitas_validas.length > 0 && (
              <div className="text-sm text-muted-foreground">
                ✅ {report.receitas_validas.length} receita(s) válida(s) encontrada(s)
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
