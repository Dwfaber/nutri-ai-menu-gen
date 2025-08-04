import { useState } from 'react';
import { MenuViolation } from '@/hooks/useMenuBusinessRules';
import { useMenuAI } from '@/hooks/useMenuAI';
import { useToast } from '@/hooks/use-toast';

export interface ApprovedViolation {
  violationIndex: number;
  approvedBy: string;
  approvedAt: string;
  justification?: string;
  nlpSuggestion?: string;
}

export interface ViolationApprovalState {
  approvedViolations: ApprovedViolation[];
  nutritionistSuggestions: { [violationIndex: number]: string };
  processingNLP: { [violationIndex: number]: boolean };
}

export const useViolationApproval = () => {
  const [approvalState, setApprovalState] = useState<ViolationApprovalState>({
    approvedViolations: [],
    nutritionistSuggestions: {},
    processingNLP: {}
  });

  const { editMenuWithNLP } = useMenuAI();
  const { toast } = useToast();

  const approveViolation = (
    violationIndex: number, 
    approvedBy: string, 
    justification?: string
  ) => {
    const newApproval: ApprovedViolation = {
      violationIndex,
      approvedBy,
      approvedAt: new Date().toISOString(),
      justification
    };

    setApprovalState(prev => ({
      ...prev,
      approvedViolations: [...prev.approvedViolations, newApproval]
    }));

    toast({
      title: "Violação Aprovada",
      description: `Violação #${violationIndex + 1} foi aprovada pela nutricionista.`
    });
  };

  const processSuggestionWithNLP = async (
    violationIndex: number,
    suggestion: string,
    menuId?: string
  ) => {
    setApprovalState(prev => ({
      ...prev,
      processingNLP: { ...prev.processingNLP, [violationIndex]: true }
    }));

    try {
      // If we have a menu ID, try to apply the suggestion
      if (menuId && suggestion.trim()) {
        await editMenuWithNLP(menuId, suggestion);
      }

      // Store the suggestion
      setApprovalState(prev => ({
        ...prev,
        nutritionistSuggestions: {
          ...prev.nutritionistSuggestions,
          [violationIndex]: suggestion
        },
        processingNLP: { ...prev.processingNLP, [violationIndex]: false }
      }));

      toast({
        title: "Sugestão Processada",
        description: "Sugestão da nutricionista foi registrada e processada."
      });

    } catch (error) {
      console.error('Error processing NLP suggestion:', error);
      setApprovalState(prev => ({
        ...prev,
        processingNLP: { ...prev.processingNLP, [violationIndex]: false }
      }));

      toast({
        title: "Erro ao Processar",
        description: "Não foi possível processar a sugestão. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const isViolationApproved = (violationIndex: number): boolean => {
    return approvalState.approvedViolations.some(
      approval => approval.violationIndex === violationIndex
    );
  };

  const getViolationApproval = (violationIndex: number): ApprovedViolation | undefined => {
    return approvalState.approvedViolations.find(
      approval => approval.violationIndex === violationIndex
    );
  };

  const getSuggestion = (violationIndex: number): string => {
    return approvalState.nutritionistSuggestions[violationIndex] || '';
  };

  const isProcessingNLP = (violationIndex: number): boolean => {
    return approvalState.processingNLP[violationIndex] || false;
  };

  const clearApprovals = () => {
    setApprovalState({
      approvedViolations: [],
      nutritionistSuggestions: {},
      processingNLP: {}
    });
  };

  const getApprovalSummary = (violations: MenuViolation[]) => {
    const totalViolations = violations.length;
    const approvedCount = approvalState.approvedViolations.length;
    const pendingCount = totalViolations - approvedCount;

    return {
      total: totalViolations,
      approved: approvedCount,
      pending: pendingCount,
      canApproveMenu: pendingCount === 0 && totalViolations > 0
    };
  };

  return {
    approvalState,
    approveViolation,
    processSuggestionWithNLP,
    isViolationApproved,
    getViolationApproval,
    getSuggestion,
    isProcessingNLP,
    clearApprovals,
    getApprovalSummary
  };
};