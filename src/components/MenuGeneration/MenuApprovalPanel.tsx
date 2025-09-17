import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Edit3, User, Calendar, DollarSign, Clock } from 'lucide-react';
import { GeneratedMenu } from '@/hooks/useIntegratedMenuGeneration';
import { MenuViolation } from '@/hooks/useMenuBusinessRules';

interface MenuApprovalPanelProps {
  menu: GeneratedMenu;
  violations: MenuViolation[];
  hasUnapprovedViolations: boolean;
  onApprove: (approverName: string, notes?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onEdit: (editedMenu: Partial<GeneratedMenu>) => Promise<void>;
  onGenerateShoppingList: () => Promise<void>;
}

const MenuApprovalPanel: React.FC<MenuApprovalPanelProps> = ({
  menu,
  violations,
  hasUnapprovedViolations,
  onApprove,
  onReject,
  onEdit,
  onGenerateShoppingList
}) => {
  const [approverName, setApproverName] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedMenu, setEditedMenu] = useState<Partial<GeneratedMenu>>({
    totalCost: menu.totalCost,
    costPerMeal: menu.costPerMeal,
    mealsPerDay: menu.mealsPerDay
  });
  const [nutritionistNotes, setNutritionistNotes] = useState('');

  const canApprove = !hasUnapprovedViolations && approverName.trim().length > 0;
  const canReject = rejectionReason.trim().length > 0;

  const handleApprove = async () => {
    if (canApprove) {
      await onApprove(approverName.trim(), approvalNotes.trim() || undefined);
      setApproverName('');
      setApprovalNotes('');
    }
  };

  const handleReject = async () => {
    if (canReject) {
      await onReject(rejectionReason.trim());
      setRejectionReason('');
    }
  };

  const handleSaveEdit = async () => {
    const updates = {
      ...editedMenu,
      // Add nutritionist notes to the menu if provided
      ...(nutritionistNotes.trim() && {
        warnings: [
          ...(menu.warnings || []),
          `Nota da Nutricionista (${approverName.trim() || 'Nutricionista'}): ${nutritionistNotes.trim()}`
        ]
      })
    };
    
    await onEdit(updates);
    setIsEditMode(false);
    setNutritionistNotes('');
  };

  const getStatusBadge = () => {
    switch (menu.status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">Aguardando Aprovação</Badge>;
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Aprovação de Cardápio
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Menu Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-blue-600" />
            <p className="text-xs text-gray-600">Período</p>
            <p className="font-semibold text-sm">{menu.weekPeriod}</p>
          </div>
          <div className="text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-600" />
            <p className="text-xs text-gray-600">Custo Total</p>
            <p className="font-semibold text-sm">R$ {menu.totalCost.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-blue-600" />
            <p className="text-xs text-gray-600">Por Refeição</p>
            <p className="font-semibold text-sm">R$ {menu.costPerMeal.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-purple-600" />
            <p className="text-xs text-gray-600">Refeições/Dia</p>
            <p className="font-semibold text-sm">{menu.mealsPerDay}</p>
          </div>
        </div>

        {/* Violation Status */}
        {violations.length > 0 && (
          <Alert variant={hasUnapprovedViolations ? "destructive" : "default"}>
            <div className="flex items-center gap-2">
              {hasUnapprovedViolations ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {hasUnapprovedViolations ? (
                  <span className="font-medium">
                    Existem {violations.filter((_, i) => !violations[i]).length} violações pendentes de aprovação
                  </span>
                ) : (
                  <span className="font-medium text-green-800">
                    Todas as violações foram aprovadas pela nutricionista
                  </span>
                )}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Edit Mode */}
        {isEditMode && (
          <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
            <h4 className="font-medium text-blue-900 mb-4 flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              Edição de Cardápio
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="editCostTotal">Custo Total (R$)</Label>
                <Input
                  id="editCostTotal"
                  type="number"
                  step="0.01"
                  value={editedMenu.totalCost}
                  onChange={(e) => setEditedMenu({
                    ...editedMenu,
                    totalCost: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div>
                <Label htmlFor="editCostPerMeal">Custo por Refeição (R$)</Label>
                <Input
                  id="editCostPerMeal"
                  type="number"
                  step="0.01"
                  value={editedMenu.costPerMeal}
                  onChange={(e) => setEditedMenu({
                    ...editedMenu,
                    costPerMeal: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div>
                <Label htmlFor="editMealsPerDay">Refeições por Dia</Label>
                <Input
                  id="editMealsPerDay"
                  type="number"
                  value={editedMenu.mealsPerDay}
                  onChange={(e) => setEditedMenu({
                    ...editedMenu,
                    mealsPerDay: parseInt(e.target.value) || 1
                  })}
                />
              </div>
            </div>

            <div className="mb-4">
              <Label htmlFor="nutritionistNotes">Observações da Nutricionista</Label>
              <Textarea
                id="nutritionistNotes"
                placeholder="Adicione observações, ajustes ou orientações especiais para este cardápio..."
                value={nutritionistNotes}
                onChange={(e) => setNutritionistNotes(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} size="sm">
                Salvar Alterações
              </Button>
              <Button 
                onClick={() => setIsEditMode(false)} 
                variant="outline" 
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Approval Section */}
        {menu.status === 'pending_approval' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="approverName">Nome da Nutricionista</Label>
                <Input
                  id="approverName"
                  placeholder="Digite seu nome"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="approvalNotes">Observações (opcional)</Label>
                <Input
                  id="approvalNotes"
                  placeholder="Observações sobre a aprovação"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleApprove}
                disabled={!canApprove}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Aprovar Cardápio
              </Button>
              
              <Button
                onClick={() => setIsEditMode(true)}
                variant="outline"
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Editar Cardápio
              </Button>

              <Button
                onClick={onGenerateShoppingList}
                variant="outline"
              >
                Gerar Lista de Compras
              </Button>
            </div>

            {/* Rejection Section */}
            <div className="pt-4 border-t">
              <Label htmlFor="rejectionReason">Motivo da Rejeição (opcional)</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Descreva o motivo da rejeição do cardápio..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="mt-1"
                rows={2}
              />
              <Button
                onClick={handleReject}
                disabled={!canReject}
                variant="destructive"
                size="sm"
                className="mt-2"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar Cardápio
              </Button>
            </div>
          </div>
        )}

        {/* Already Approved/Rejected Status */}
        {menu.status === 'approved' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Cardápio aprovado</strong>
              <div className="text-xs text-green-600 mt-1">
                Criado em {new Date(menu.createdAt).toLocaleString()}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {menu.status === 'rejected' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Cardápio rejeitado</strong>
              <div className="text-xs mt-1">
                Status: {menu.status}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default MenuApprovalPanel;