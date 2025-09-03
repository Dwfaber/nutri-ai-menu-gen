import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ContractClient } from '@/contexts/ClientContractsContext';
import { Badge } from '@/components/ui/badge';
import { Users, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { JuiceConfigForm } from './JuiceConfigForm';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

export interface ClientAdditionalInfo {
  total_funcionarios: number;
  periodicidade: 'diario' | 'semanal' | 'mensal';
  total_refeicoes_mes: number;
  restricoes_alimentares: string[];
  observacoes?: string;
}

interface ClientInfoFormProps {
  client: ContractClient;
  onComplete: (info: ClientAdditionalInfo) => void;
  onCancel: () => void;
}

const ClientInfoForm = ({ client, onComplete, onCancel }: ClientInfoFormProps) => {
  const [formData, setFormData] = useState<ClientAdditionalInfo>({
    total_funcionarios: 0,
    periodicidade: 'mensal',
    total_refeicoes_mes: 0,
    restricoes_alimentares: [],
    observacoes: ''
  });
  
  const [newRestriction, setNewRestriction] = useState('');
  const { toast } = useToast();

  const handleJuiceConfigUpdate = async (clientId: string, config: {
    use_pro_mix?: boolean;
    use_pro_vita?: boolean;
    use_suco_diet?: boolean;
    use_suco_natural?: boolean;
  }) => {
    try {
      const supabase = createClient(
        'https://wzbhhioegxdpegirglbq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YmhoaW9lZ3hkcGVnaXJnbGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDA0MDUsImV4cCI6MjA2ODA3NjQwNX0.ufwv_XD8LZ2SGMPYUy7Z-CkK2GRNx8mailJb6ZRZHXQ'
      );
      const { error } = await supabase
        .from('contratos_corporativos')
        .update(config)
        .eq('id', clientId);

      if (error) throw error;

      toast({
        title: "Configuração atualizada",
        description: "As configurações de suco foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao atualizar configuração de sucos:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar as configurações de suco.",
        variant: "destructive",
      });
    }
  };

  const handleAddRestriction = () => {
    if (newRestriction.trim() && !formData.restricoes_alimentares.includes(newRestriction.trim())) {
      setFormData(prev => ({
        ...prev,
        restricoes_alimentares: [...prev.restricoes_alimentares, newRestriction.trim()]
      }));
      setNewRestriction('');
    }
  };

  const handleRemoveRestriction = (restriction: string) => {
    setFormData(prev => ({
      ...prev,
      restricoes_alimentares: prev.restricoes_alimentares.filter(r => r !== restriction)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(formData);
  };

  return (
    <div className="space-y-4">
      <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Informações Complementares
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Complete as informações necessárias para <strong>{client.nome_fantasia}</strong>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dados do Cliente (apenas visualização) */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Empresa:</span>
              <div className="font-medium">{client.nome_fantasia}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Tipo Refeição:</span>
              <div className="font-medium">{client.tipo_refeicao}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Custo Médio Diário:</span>
              <div className="font-medium">R$ {client.custo_medio_diario.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Custo Dia Especial:</span>
              <div className="font-medium">R$ {client.custo_dia_especial.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Número de Funcionários */}
          <div className="space-y-2">
            <Label htmlFor="funcionarios" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total de Funcionários *
            </Label>
            <Input
              id="funcionarios"
              type="number"
              min="1"
              required
              value={formData.total_funcionarios || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                total_funcionarios: parseInt(e.target.value) || 0
              }))}
              placeholder="Ex: 50"
            />
          </div>

          {/* Periodicidade */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Periodicidade do Cardápio *
            </Label>
            <Select
              value={formData.periodicidade}
              onValueChange={(value: 'diario' | 'semanal' | 'mensal') => 
                setFormData(prev => ({ ...prev, periodicidade: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diário</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Total de Refeições por Mês */}
          <div className="space-y-2">
            <Label htmlFor="refeicoes" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total de Refeições por Mês *
            </Label>
            <Input
              id="refeicoes"
              type="number"
              min="1"
              required
              value={formData.total_refeicoes_mes || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                total_refeicoes_mes: parseInt(e.target.value) || 0
              }))}
              placeholder="Ex: 1000"
            />
          </div>

          {/* Restrições Alimentares */}
          <div className="space-y-2">
            <Label>Restrições Alimentares</Label>
            <div className="flex gap-2">
              <Input
                value={newRestriction}
                onChange={(e) => setNewRestriction(e.target.value)}
                placeholder="Ex: Sem glúten, Vegetariano..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRestriction())}
              />
              <Button type="button" onClick={handleAddRestriction} size="sm">
                Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.restricoes_alimentares.map((restriction, index) => (
                <Badge key={index} variant="secondary" className="cursor-pointer" 
                       onClick={() => handleRemoveRestriction(restriction)}>
                  {restriction} ×
                </Badge>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações Adicionais</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Observações sobre o cliente, preferências, etc."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              Continuar com Geração do Cardápio
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <JuiceConfigForm 
      client={client}
      onUpdate={handleJuiceConfigUpdate}
    />
    </div>
  );
};

export default ClientInfoForm;