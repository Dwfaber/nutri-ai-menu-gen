import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, ArrowRight, X, TrendingUp } from 'lucide-react';
import { isProductSuggestion, type ProductSuggestionViolation } from '@/utils/ingredientSuggestions';
import { cacheApprovedSuggestion, recordRejectedSuggestion, getSuggestionStats } from '@/utils/systemOptimization';

interface IngredientSuggestionsPanelProps {
  violations: any[];
  onApproveSuggestion: (originalName: string, suggestedProduct: any) => void;
  onRejectSuggestion: (originalName: string) => void;
  approvedSuggestions: Record<string, any>;
  isLoading?: boolean;
}

export const IngredientSuggestionsPanel: React.FC<IngredientSuggestionsPanelProps> = ({
  violations,
  onApproveSuggestion,
  onRejectSuggestion,
  approvedSuggestions,
  isLoading = false
}) => {
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());

  // Filtra e otimiza sugestões
  const productSuggestions = useMemo(() => {
    return violations.filter(isProductSuggestion) as ProductSuggestionViolation[];
  }, [violations]);
  
  const suggestionStats = useMemo(() => getSuggestionStats(), [productSuggestions]);

  const handleApprove = async (suggestion: ProductSuggestionViolation) => {
    const key = suggestion.originalIngredient;
    setProcessingItems(prev => new Set([...prev, key]));
    
    try {
      const approvedProduct = {
        descricao: suggestion.suggestedProduct,
        preco: suggestion.price,
        unidade: suggestion.unit,
        similarity_score: suggestion.score
      };
      
      await onApproveSuggestion(suggestion.originalIngredient, approvedProduct);
      cacheApprovedSuggestion(suggestion.originalIngredient, approvedProduct);
    } catch (error) {
      console.error('[ERRO] Falha na aprovação:', error);
    } finally {
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleReject = async (suggestion: ProductSuggestionViolation) => {
    const key = suggestion.originalIngredient;
    setProcessingItems(prev => new Set([...prev, key]));
    
    try {
      await onRejectSuggestion(suggestion.originalIngredient);
      recordRejectedSuggestion(suggestion.originalIngredient);
    } catch (error) {
      console.error('[ERRO] Falha na rejeição:', error);
    } finally {
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (productSuggestions.length === 0) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <Card className="border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Sugestões Inteligentes ({productSuggestions.length})
          </div>
          {suggestionStats.totalSuggestions > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {suggestionStats.approvalRate.toFixed(0)}% aprovação
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Sistema de busca inteligente encontrou {productSuggestions.length} sugestão(ões). 
            Produtos com score ≥80% são recomendados para aprovação automática.
          </AlertDescription>
        </Alert>

        {productSuggestions.map((suggestion, index) => {
          const isApproved = approvedSuggestions[suggestion.originalIngredient];
          const isProcessing = processingItems.has(suggestion.originalIngredient);

          return (
            <div
              key={`${suggestion.originalIngredient}-${index}`}
              className={`p-4 rounded-lg border transition-colors ${
                isApproved 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-card border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-sm">
                    <span className="font-medium text-muted-foreground">Procurado:</span>
                    <div className="font-mono text-destructive">
                      {suggestion.originalIngredient}
                    </div>
                  </div>
                  
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  
                  <div className="text-sm flex-1">
                    <span className="font-medium text-muted-foreground">Sugestão:</span>
                    <div className="font-mono text-primary">
                      {suggestion.suggestedProduct}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      R$ {(suggestion.price / 100).toFixed(2)} por {suggestion.unit}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={`${getScoreColor(suggestion.score)} flex items-center gap-1`}
                  >
                    {getScoreIcon(suggestion.score)}
                    {suggestion.score}%
                  </Badge>
                  
                  {isApproved ? (
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                      ✓ Aprovado
                    </Badge>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApprove(suggestion)}
                        disabled={isLoading || isProcessing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isProcessing ? 'Aprovando...' : 'Aprovar'}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(suggestion)}
                        disabled={isLoading || isProcessing}
                        className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {suggestion.score >= 95 && !isApproved && (
                <div className="text-xs text-green-600 font-medium">
                  🎯 Match perfeito - aprovação recomendada
                </div>
              )}
              {suggestion.score >= 80 && suggestion.score < 95 && !isApproved && (
                <div className="text-xs text-green-600 font-medium">
                  💡 Alta similaridade - recomendado aprovar
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(approvedSuggestions).length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <div className="text-sm text-muted-foreground">
              ✅ {Object.keys(approvedSuggestions).length} sugestão(ões) aprovada(s)
            </div>
            {suggestionStats.totalSuggestions > 5 && (
              <div className="text-xs text-muted-foreground">
                Eficácia do sistema: {suggestionStats.approvalRate.toFixed(1)}% de aprovação
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};