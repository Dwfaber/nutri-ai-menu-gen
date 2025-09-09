import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ContractClient } from '@/contexts/ClientContractsContext';

interface ProteinConfigFormProps {
  client: ContractClient;
  onUpdate: (clientId: string, config: {
    protein_grams_pp1?: number;
    protein_grams_pp2?: number;
  }) => void;
}

export const ProteinConfigForm: React.FC<ProteinConfigFormProps> = ({
  client,
  onUpdate
}) => {
  const handleProteinGramsChange = (field: string, value: number) => {
    onUpdate(client.id, { [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de Gramagem das Proteínas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="protein_grams_pp1">Proteína Principal 1</Label>
            <Select
              value={(client as any).protein_grams_pp1?.toString() || "100"}
              onValueChange={(value) => handleProteinGramsChange('protein_grams_pp1', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Gramagem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90">90g</SelectItem>
                <SelectItem value="100">100g</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="protein_grams_pp2">Proteína Principal 2</Label>
            <Select
              value={(client as any).protein_grams_pp2?.toString() || "90"}
              onValueChange={(value) => handleProteinGramsChange('protein_grams_pp2', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Gramagem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90">90g</SelectItem>
                <SelectItem value="100">100g</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mt-4">
          <p><strong>Configuração de gramagem por proteína:</strong></p>
          <ul className="list-disc list-inside mt-1">
            <li>PP1 (Proteína Principal 1): padrão 100g</li>
            <li>PP2 (Proteína Principal 2): padrão 90g</li>
          </ul>
          <p className="mt-2 text-xs">
            A gramagem configurada afeta o cálculo de custos e será aplicada na geração de cardápios.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};