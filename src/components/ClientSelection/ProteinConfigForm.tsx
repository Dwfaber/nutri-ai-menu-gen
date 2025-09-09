import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Label
} from '@/components/ui/label';
import {
  ToggleGroup,
  ToggleGroupItem
} from '@/components/ui/toggle-group';
import { ContractClient } from '@/contexts/ClientContractsContext';

interface ProteinConfigFormProps {
  client: ContractClient & {
    protein_grams_pp1?: number;
    protein_grams_pp2?: number;
  };
  onUpdate: (
    clientId: string,
    config: {
      protein_grams_pp1?: number;
      protein_grams_pp2?: number;
    }
  ) => void;
}

export const ProteinConfigForm: React.FC<ProteinConfigFormProps> = ({
  client,
  onUpdate
}) => {
  const handleProteinGramsChange = (
    field: 'protein_grams_pp1' | 'protein_grams_pp2',
    value: string
  ) => {
    if (!value) return;
    onUpdate(client.id, { [field]: parseInt(value) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de Gramagem das Proteínas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Proteína Principal 1 */}
        <div className="space-y-2">
          <Label>Proteína Principal 1</Label>
          <ToggleGroup
            type="single"
            value={(client.protein_grams_pp1 ?? 100).toString()}
            onValueChange={(val) =>
              handleProteinGramsChange('protein_grams_pp1', val)
            }
            className="flex gap-2"
          >
            <ToggleGroupItem value="90">90g</ToggleGroupItem>
            <ToggleGroupItem value="100">100g</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Proteína Principal 2 */}
        <div className="space-y-2">
          <Label>Proteína Principal 2</Label>
          <ToggleGroup
            type="single"
            value={(client.protein_grams_pp2 ?? 90).toString()}
            onValueChange={(val) =>
              handleProteinGramsChange('protein_grams_pp2', val)
            }
            className="flex gap-2"
          >
            <ToggleGroupItem value="90">90g</ToggleGroupItem>
            <ToggleGroupItem value="100">100g</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Texto explicativo */}
        <div className="text-sm text-muted-foreground mt-4">
          <p><strong>Configuração de gramagem por proteína:</strong></p>
          <ul className="list-disc list-inside mt-1">
            <li>PP1: padrão 100g</li>
            <li>PP2: padrão 90g</li>
          </ul>
          <p className="mt-2 text-xs">
            Esta definição altera diretamente o custo final e a composição do cardápio.
          </p>
        </div>

      </CardContent>
    </Card>
  );
};