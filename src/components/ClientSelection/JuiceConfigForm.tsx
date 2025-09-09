import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContractClient } from '@/contexts/ClientContractsContext';

interface JuiceConfigFormProps {
  client: ContractClient;
  onUpdate: (clientId: string, config: {
    use_pro_mix?: boolean;
    use_pro_vita?: boolean;
    use_suco_diet?: boolean;
    use_suco_natural?: boolean;
    protein_grams_pp1?: number;
    protein_grams_pp2?: number;
  }) => void;
}

export const JuiceConfigForm: React.FC<JuiceConfigFormProps> = ({
  client,
  onUpdate
}) => {
  const handleJuiceConfigChange = (field: string, value: boolean) => {
    onUpdate(client.id, { [field]: value });
  };

  const handleProteinGramsChange = (field: string, value: number) => {
    onUpdate(client.id, { [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de Sucos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="use_pro_mix"
            checked={client.use_pro_mix || false}
            onCheckedChange={(checked) => 
              handleJuiceConfigChange('use_pro_mix', checked as boolean)
            }
          />
          <Label htmlFor="use_pro_mix">Usar Suco Pró Mix</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="use_pro_vita"
            checked={client.use_pro_vita || false}
            onCheckedChange={(checked) => 
              handleJuiceConfigChange('use_pro_vita', checked as boolean)
            }
          />
          <Label htmlFor="use_pro_vita">Usar Vita Suco</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="use_suco_diet"
            checked={client.use_suco_diet || false}
            onCheckedChange={(checked) => 
              handleJuiceConfigChange('use_suco_diet', checked as boolean)
            }
          />
          <Label htmlFor="use_suco_diet">Usar Suco Diet</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="use_suco_natural"
            checked={client.use_suco_natural || false}
            onCheckedChange={(checked) => 
              handleJuiceConfigChange('use_suco_natural', checked as boolean)
            }
          />
          <Label htmlFor="use_suco_natural">Usar Suco Natural</Label>
        </div>

        <div className="border-t pt-4 space-y-4">
          <h4 className="font-medium text-foreground">Configuração de Gramagem das Proteínas</h4>
          
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
        </div>

        <div className="text-sm text-muted-foreground mt-4">
          <p>Prioridade dos sucos:</p>
          <ol className="list-decimal list-inside">
            <li>Suco Pró Mix</li>
            <li>Vita Suco</li>
            <li>Suco Diet</li>
            <li>Suco Natural</li>
          </ol>
          <p className="mt-2">Se nenhum suco for selecionado, o sistema usará Suco Natural como padrão.</p>
          <p className="mt-2"><strong>Gramagem padrão:</strong> PP1 = 100g, PP2 = 90g</p>
        </div>
      </CardContent>
    </Card>
  );
};