import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { testMenuGenerationComplete } from '@/utils/testMenuGeneration';
import { PlayCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';

export function MenuGenerationTestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [currentTest, setCurrentTest] = useState<string>('');

  const runTests = async () => {
    setIsRunning(true);
    setResults(null);
    setCurrentTest('Iniciando testes...');
    
    try {
      const testResults = await testMenuGenerationComplete();
      setResults(testResults);
      setCurrentTest('');
    } catch (error) {
      console.error('Erro ao executar testes:', error);
      setResults({
        results: [],
        successRate: 0,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          Testes de Geração de Cardápios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={runTests}
            disabled={isRunning}
            className="gap-2"
          >
            <PlayCircle className="h-4 w-4" />
            {isRunning ? 'Executando...' : 'Executar Testes Completos'}
          </Button>
          
          {isRunning && (
            <div className="flex-1">
              <Progress value={undefined} className="h-2" />
              <p className="text-sm text-muted-foreground mt-1">{currentTest}</p>
            </div>
          )}
        </div>

        {results && (
          <div className="space-y-4 mt-6">
            <Alert className={results.successRate === 100 ? 'border-green-500' : 'border-yellow-500'}>
              <AlertDescription className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {results.successRate === 100 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  <span className="font-semibold">
                    Taxa de Sucesso: {results.successRate.toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm">
                  {results.results.filter((r: any) => r.success).length} de {results.results.length} testes passaram
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {results.results.map((result: any, index: number) => (
                <Card key={index} className={result.success ? 'border-green-200' : 'border-red-200'}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <h4 className="font-semibold">{result.test}</h4>
                      </div>
                      {result.duration && (
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {result.duration}ms
                        </Badge>
                      )}
                    </div>

                    {result.validations && (
                      <div className="space-y-1 text-sm mt-3">
                        {result.validations.map((validation: string, vIdx: number) => (
                          <div
                            key={vIdx}
                            className={`flex items-start gap-2 ${
                              validation.startsWith('✅')
                                ? 'text-green-700'
                                : validation.startsWith('❌')
                                ? 'text-red-700'
                                : 'text-yellow-700'
                            }`}
                          >
                            <span>{validation}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.error && (
                      <Alert variant="destructive" className="mt-3">
                        <AlertDescription className="text-xs">
                          {result.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
