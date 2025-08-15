import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { MenuViolation } from '@/hooks/useMenuBusinessRules';
import { useToast } from '@/hooks/use-toast';

interface ViolationAutoResolverProps {
  violations: MenuViolation[];
  menuId?: string;
  onAutoResolved?: (resolvedViolations: number[]) => void;
  onViolationsChanged?: () => void;
}

interface AutoResolutionSuggestion {
  violationIndex: number;
  suggestion: string;
  confidence: 'high' | 'medium' | 'low';
  type: 'protein_swap' | 'recipe_replacement' | 'structure_fix' | 'monday_processing';
}

const ViolationAutoResolver: React.FC<ViolationAutoResolverProps> = ({
  violations,
  menuId,
  onAutoResolved,
  onViolationsChanged
}) => {
  const [isResolving, setIsResolving] = useState(false);
  const [autoSuggestions, setAutoSuggestions] = useState<AutoResolutionSuggestion[]>([]);
  const { toast } = useToast();

  // Generate automatic resolution suggestions based on violation types
  const generateAutoSuggestions = (): AutoResolutionSuggestion[] => {
    const suggestions: AutoResolutionSuggestion[] = [];

    violations.forEach((violation, index) => {
      const message = violation.message.toLowerCase();
      
      // Protein variety violations
      if (message.includes('proteína repetida') || message.includes('mesmo tipo de proteína')) {
        suggestions.push({
          violationIndex: index,
          suggestion: `Substituir uma das proteínas por uma alternativa disponível no mercado`,
          confidence: 'high',
          type: 'protein_swap'
        });
      }
      
      // Red meat violations
      if (message.includes('carne vermelha') || message.includes('duas carnes vermelhas')) {
        suggestions.push({
          violationIndex: index,
          suggestion: `Substituir uma carne vermelha por frango, peixe ou proteína vegetal`,
          confidence: 'high',
          type: 'protein_swap'
        });
      }
      
      // Monday processing violations
      if (message.includes('segunda-feira') && message.includes('preparo antecipado')) {
        suggestions.push({
          violationIndex: index,
          suggestion: `Substituir receita que requer preparo antecipado por uma receita de preparo simples`,
          confidence: 'medium',
          type: 'monday_processing'
        });
      }
      
      // Structure violations
      if (message.includes('estrutura') || message.includes('categoria obrigatória')) {
        suggestions.push({
          violationIndex: index,
          suggestion: `Adicionar receita da categoria faltante com ingredientes disponíveis no mercado`,
          confidence: 'medium',
          type: 'structure_fix'
        });
      }
    });

    return suggestions;
  };

  const handleGenerateSuggestions = () => {
    const suggestions = generateAutoSuggestions();
    setAutoSuggestions(suggestions);
    
    toast({
      title: "Sugestões Geradas",
      description: `${suggestions.length} sugestões automáticas foram criadas.`
    });
  };

  const handleAutoResolve = async (suggestion: AutoResolutionSuggestion) => {
    setIsResolving(true);
    
    try {
      // Simulate auto-resolution process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, this would call the NLP API with the suggestion
      // await editMenuWithNLP(menuId, suggestion.suggestion);
      
      toast({
        title: "Violação Resolvida Automaticamente",
        description: `Violação #${suggestion.violationIndex + 1} foi resolvida com sucesso.`
      });
      
      onAutoResolved?.([suggestion.violationIndex]);
      onViolationsChanged?.();
      
      // Remove the resolved suggestion
      setAutoSuggestions(prev => 
        prev.filter(s => s.violationIndex !== suggestion.violationIndex)
      );
      
    } catch (error) {
      console.error('Error auto-resolving violation:', error);
      toast({
        title: "Erro na Resolução Automática",
        description: "Não foi possível resolver automaticamente. Tente a resolução manual.",
        variant: "destructive"
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleResolveAll = async () => {
    setIsResolving(true);
    
    try {
      const highConfidenceSuggestions = autoSuggestions.filter(s => s.confidence === 'high');
      
      for (const suggestion of highConfidenceSuggestions) {
        await new Promise(resolve => setTimeout(resolve, 800));
        // In real implementation: await editMenuWithNLP(menuId, suggestion.suggestion);
      }
      
      toast({
        title: "Resolução Automática Concluída",
        description: `${highConfidenceSuggestions.length} violações foram resolvidas automaticamente.`
      });
      
      onAutoResolved?.(highConfidenceSuggestions.map(s => s.violationIndex));
      onViolationsChanged?.();
      setAutoSuggestions([]);
      
    } catch (error) {
      console.error('Error auto-resolving violations:', error);
      toast({
        title: "Erro na Resolução Automática",
        description: "Algumas violações não puderam ser resolvidas automaticamente.",
        variant: "destructive"
      });
    } finally {
      setIsResolving(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge variant="outline" className={variants[confidence as keyof typeof variants]}>
        {confidence === 'high' ? 'Alta' : confidence === 'medium' ? 'Média' : 'Baixa'} Confiança
      </Badge>
    );
  };

  if (violations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="w-5 h-5" />
          Resolução Automática de Violações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateSuggestions}
            variant="outline"
            disabled={isResolving}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Gerar Sugestões Automáticas
          </Button>
          
          {autoSuggestions.length > 0 && (
            <Button
              onClick={handleResolveAll}
              disabled={isResolving || autoSuggestions.filter(s => s.confidence === 'high').length === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="w-4 h-4" />
              Resolver Automaticamente ({autoSuggestions.filter(s => s.confidence === 'high').length})
            </Button>
          )}
        </div>

        {autoSuggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Sugestões de Resolução:</h4>
            
            {autoSuggestions.map((suggestion, index) => (
              <Alert key={index} className="relative">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">
                        Violação #{suggestion.violationIndex + 1}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {suggestion.suggestion}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {getConfidenceBadge(suggestion.confidence)}
                        <Badge variant="outline" className="text-xs">
                          {suggestion.type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => handleAutoResolve(suggestion)}
                      disabled={isResolving}
                      className="ml-3 bg-blue-600 hover:bg-blue-700"
                    >
                      <Wand2 className="w-3 h-3 mr-1" />
                      Resolver
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {autoSuggestions.length === 0 && violations.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Clique em "Gerar Sugestões Automáticas" para ver opções de resolução inteligente para as violações encontradas.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default ViolationAutoResolver;