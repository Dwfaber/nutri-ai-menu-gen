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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Safe fallbacks for undefined values
  const problematics = report?.receitas_problematicas ?? [];
  const valids = report?.receitas_validas ?? [];
  const terms = {
    ingredientes_principais: report?.termos_extraidos?.ingredientes_principais ?? [],
    palavras_chave: report?.termos_extraidos?.palavras_chave ?? []
  };
  const bySeverity = report?.estatisticas?.problemas_por_severidade ?? { critica: 0, alta: 0, media: 0, baixa: 0 };

  const percentualValidas = report.receitas_testadas > 0
    ? (valids.length / report.receitas_testadas) * 100
    : 0;

  const totalProblemas = Object.values(bySeverity).reduce((a, b) => a + b, 0);

  // Pagination logic
  const totalPages = Math.ceil(problematics.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProblematicRecipes = problematics.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to table top
    document.getElementById('problematic-recipes-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-primary">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                <CardTitle className="text-lg">{report.categoria}</CardTitle>
                {problematics.length === 0 ? (
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
                  {Object.entries(bySeverity).map(([sev, count]) => (
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
                    Termos Extraídos ({terms.palavras_chave.length} palavras-chave)
                  </h4>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Ingredientes Principais:</p>
                    <div className="flex flex-wrap gap-1">
                      {terms.ingredientes_principais.slice(0, 20).map(ing => (
                        <Badge key={ing} variant="secondary" className="text-xs">
                          {ing}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Palavras-Chave (Top 30):</p>
                    <div className="flex flex-wrap gap-1">
                      {terms.palavras_chave.slice(0, 30).map(palavra => (
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
            {problematics.length > 0 && (
              <div className="space-y-3" id="problematic-recipes-table">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">
                    Receitas Problemáticas ({problematics.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mostrar:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-[80px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">
                      Exibindo {startIndex + 1}-{Math.min(endIndex, problematics.length)} de {problematics.length}
                    </span>
                  </div>
                </div>

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
                      {currentProblematicRecipes.map(receita => (
                        <TableRow key={receita.receita_id}>
                          <TableCell className="font-medium">{receita.nome}</TableCell>
                          <TableCell className="text-right">
                            R$ {(receita.custo_por_porcao ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {receita.problemas_detectados?.length ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {getSeverityBadge(receita.validacao?.severidade ?? 'media')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => handlePageChange(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationLink
                              onClick={() => handlePageChange(totalPages)}
                              className="cursor-pointer"
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            )}

            {/* Receitas Válidas (resumo) */}
            {valids.length > 0 && (
              <div className="text-sm text-muted-foreground">
                ✅ {valids.length} receita(s) válida(s) encontrada(s)
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
