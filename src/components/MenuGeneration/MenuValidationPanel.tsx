import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, AlertTriangle, Info, UserCheck, MessageSquare } from 'lucide-react';
import { MenuBusinessRules, MenuViolation } from '@/hooks/useMenuBusinessRules';
import { useViolationApproval } from '@/hooks/useViolationApproval';
import NLPInput from '@/components/MenuGenerator/NLPInput';

interface MenuValidationPanelProps {
  rules: MenuBusinessRules;
  violations: MenuViolation[];
  marketAvailability: {
    totalIngredients: number;
    availableIngredients: number;
    missingIngredients: string[];
  };
  menuId?: string;
  onViolationsChanged?: () => void;
}

const MenuValidationPanel: React.FC<MenuValidationPanelProps> = ({
  rules,
  violations,
  marketAvailability,
  menuId,
  onViolationsChanged
}) => {
  const [approverName, setApproverName] = useState('');
  
  const {
    approveViolation,
    processSuggestionWithNLP,
    isViolationApproved,
    getViolationApproval,
    getSuggestion,
    isProcessingNLP,
    getApprovalSummary
  } = useViolationApproval();

  const approvalSummary = getApprovalSummary(violations);
  const getRuleIcon = (isValid: boolean) => {
    return isValid ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    );
  };

  const getRuleBadge = (isValid: boolean) => {
    return (
      <Badge variant={isValid ? "default" : "destructive"} className="text-xs">
        {isValid ? "OK" : "VIOLAÇÃO"}
      </Badge>
    );
  };

  const handleApproveViolation = (violationIndex: number) => {
    if (approverName.trim()) {
      approveViolation(violationIndex, approverName.trim());
      onViolationsChanged?.();
    }
  };

  const handleNLPSuggestion = async (violationIndex: number, suggestion: string) => {
    await processSuggestionWithNLP(violationIndex, suggestion, menuId);
    onViolationsChanged?.();
  };

  const availabilityPercentage = marketAvailability.totalIngredients > 0 
    ? (marketAvailability.availableIngredients / marketAvailability.totalIngredients) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Validação de Regras de Negócio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Market Availability */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Disponibilidade de Ingredientes no Mercado
          </h4>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {marketAvailability.availableIngredients} de {marketAvailability.totalIngredients} ingredientes disponíveis
            </span>
            <Badge 
              variant={availabilityPercentage >= 80 ? "default" : "destructive"}
              className="text-xs"
            >
              {availabilityPercentage.toFixed(1)}%
            </Badge>
          </div>
          {marketAvailability.missingIngredients.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-blue-700 mb-1">Ingredientes não disponíveis:</p>
              <div className="flex flex-wrap gap-1">
                {marketAvailability.missingIngredients.slice(0, 5).map((ingredient, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {ingredient}
                  </Badge>
                ))}
                {marketAvailability.missingIngredients.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{marketAvailability.missingIngredients.length - 5} mais
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Business Rules */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Regras de Negócio:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {getRuleIcon(rules.proteinVariety)}
                <span className="text-sm">Variedade de Proteínas</span>
              </div>
              {getRuleBadge(rules.proteinVariety)}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {getRuleIcon(rules.redMeatLimit)}
                <span className="text-sm">Limite Carnes Vermelhas</span>
              </div>
              {getRuleBadge(rules.redMeatLimit)}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {getRuleIcon(rules.mondayProcessing)}
                <span className="text-sm">Processos Segunda-feira</span>
              </div>
              {getRuleBadge(rules.mondayProcessing)}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {getRuleIcon(rules.requiredStructure)}
                <span className="text-sm">Estrutura Completa</span>
              </div>
              {getRuleBadge(rules.requiredStructure)}
            </div>
          </div>
        </div>

        {/* Approval Summary */}
        {violations.length > 0 && (
          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-amber-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                Status das Violações
              </h4>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {approvalSummary.approved}/{approvalSummary.total} aprovadas
                </Badge>
                {approvalSummary.canApproveMenu && (
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                    Pode aprovar cardápio
                  </Badge>
                )}
              </div>
            </div>
            
            {approvalSummary.pending > 0 && (
              <div className="mb-4">
                <Label htmlFor="approverName" className="text-sm">Nome da Nutricionista:</Label>
                <Input
                  id="approverName"
                  placeholder="Digite seu nome para aprovar violações"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
        )}

        {/* Violations */}
        {violations.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-red-900">Violações Encontradas:</h4>
            {violations.map((violation, index) => {
              const isApproved = isViolationApproved(index);
              const approval = getViolationApproval(index);
              const suggestion = getSuggestion(index);
              const processingNLP = isProcessingNLP(index);

              return (
                <div key={index} className="space-y-3">
                  <Alert variant={isApproved ? "default" : "destructive"}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {isApproved ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <AlertDescription className="mt-2">
                          <strong>{violation.day ? `${violation.day}: ` : ''}</strong>
                          {violation.message}
                          {violation.recipes && violation.recipes.length > 0 && (
                            <div className="mt-1 text-xs">
                              Receitas: {violation.recipes.join(', ')}
                            </div>
                          )}
                          
                          {isApproved && approval && (
                            <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                              <p className="font-medium text-green-800">
                                ✓ Aprovado por {approval.approvedBy}
                              </p>
                              <p className="text-green-600">
                                {new Date(approval.approvedAt).toLocaleString()}
                              </p>
                              {approval.justification && (
                                <p className="text-green-700 mt-1">
                                  Justificativa: {approval.justification}
                                </p>
                              )}
                            </div>
                          )}
                        </AlertDescription>
                      </div>
                      
                      {!isApproved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApproveViolation(index)}
                          disabled={!approverName.trim()}
                          className="ml-3 text-xs border-green-500 text-green-600 hover:bg-green-50"
                        >
                          <UserCheck className="w-3 h-3 mr-1" />
                          Aprovar
                        </Button>
                      )}
                    </div>
                  </Alert>

                  {/* NLP Suggestion Field */}
                  <div className="ml-6 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        Sugestão da Nutricionista
                      </span>
                    </div>
                    
                    <NLPInput
                      onCommand={(suggestion) => handleNLPSuggestion(index, suggestion)}
                      isProcessing={processingNLP}
                      placeholder={`Sugestão para resolver: "${violation.message.substring(0, 50)}..."`}
                    />
                    
                    {suggestion && (
                      <div className="mt-2 p-2 bg-blue-100 rounded text-xs">
                        <p className="font-medium text-blue-800">Última sugestão:</p>
                        <p className="text-blue-700">{suggestion}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Success Message */}
        {violations.length === 0 && Object.values(rules).every(rule => rule) && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Todas as regras de negócio foram atendidas! O cardápio está aprovado para geração.
            </AlertDescription>
          </Alert>
        )}

        {/* Approved Menu with Violations */}
        {violations.length > 0 && approvalSummary.canApproveMenu && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Cardápio pode ser aprovado!</strong> Todas as violações foram aprovadas pela nutricionista.
              {approvalSummary.approved > 0 && (
                <div className="mt-1 text-xs">
                  {approvalSummary.approved} violação(ões) aprovada(s) pela nutricionista.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default MenuValidationPanel;