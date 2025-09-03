import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ContractClient } from '@/contexts/ClientContractsContext';

interface JuiceConfigFormProps {
  client: ContractClient;
  onUpdate: (clientId: string, config: {
    use_pro_mix?: boolean;
    use_pro_vita?: boolean;
    use_suco_diet?: boolean;
    use_suco_natural?: boolean;
  }) => void;
}

export const JuiceConfigForm: React.FC<JuiceConfigFormProps> = ({
  client,
  onUpdate
}) => {
  const handleJuiceConfigChange = (field: string, value: boolean) => {
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

        <div className="text-sm text-muted-foreground mt-4">
          <p>Prioridade dos sucos:</p>
          <ol className="list-decimal list-inside">
            <li>Suco Pró Mix</li>
            <li>Vita Suco</li>
            <li>Suco Diet</li>
            <li>Suco Natural</li>
          </ol>
          <p className="mt-2">Se nenhum suco for selecionado, o sistema usará Suco Natural como padrão.</p>
        </div>
      </CardContent>
    </Card>
  );
};