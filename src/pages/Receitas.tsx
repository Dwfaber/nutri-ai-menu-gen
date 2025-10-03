import { ChefHat, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useRecipeAuditor } from '@/hooks/useRecipeAuditor';
import { AuditConfigForm } from '@/components/Recipes/AuditConfigForm';
import { AuditResults } from '@/components/Recipes/AuditResults';

const Receitas = () => {
  const {
    auditing,
    progress: auditProgress,
    result: auditResult,
    error: auditError,
    currentCategory,
    runAudit,
    exportToJSON,
    exportToCSV
  } = useRecipeAuditor();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ChefHat className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Auditoria de Receitas</h1>
          <p className="text-muted-foreground">
            Análise completa e validação de receitas do sistema
          </p>
        </div>
      </div>

      {/* Audit Content */}
      <Card>
        <CardHeader>
          <CardTitle>Auditoria Completa de Receitas</CardTitle>
          <CardDescription>
            Executa uma análise detalhada das receitas, validando ingredientes, custos e problemas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuditConfigForm 
            onStartAudit={runAudit}
            isAuditing={auditing}
          />

          {auditing && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-lg">Auditoria em Andamento...</CardTitle>
                {currentCategory && (
                  <CardDescription>
                    Processando categoria: <strong>{currentCategory}</strong>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Progress value={auditProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">
                  {auditProgress.toFixed(0)}% concluído
                </p>
              </CardContent>
            </Card>
          )}

          {auditError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{auditError}</AlertDescription>
            </Alert>
          )}

          {auditResult && (
            <AuditResults 
              result={auditResult}
              onExportJSON={exportToJSON}
              onExportCSV={exportToCSV}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Receitas;
