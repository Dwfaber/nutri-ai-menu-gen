import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface JuiceInfo {
  id: number;
  nome: string;
}

interface JuiceConfigResult {
  periodo: {
    inicio: string;
    fim: string;
  };
  tipos_configurados: string[];
  cardapio_semanal: Array<{
    data: string;
    dia_semana: string;
    suco1: JuiceInfo;
    suco2: JuiceInfo;
    sobremesa: string;
  }>;
  gerado_em: string;
}

interface JuiceMenuDisplayProps {
  juiceConfig?: JuiceConfigResult | null;
}

export const JuiceMenuDisplay: React.FC<JuiceMenuDisplayProps> = ({ juiceConfig }) => {
  if (!juiceConfig || !juiceConfig.cardapio_semanal || juiceConfig.cardapio_semanal.length === 0) {
    return <p className="text-muted-foreground">Nenhuma configuração de sucos disponível.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Sucos - Período {juiceConfig.periodo.inicio} a {juiceConfig.periodo.fim}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              <strong>Tipos configurados:</strong> {juiceConfig.tipos_configurados.join(', ')}
            </p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {juiceConfig.cardapio_semanal.map((dia, index) => (
              <Card key={index} className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{dia.dia_semana}</CardTitle>
                  <p className="text-xs text-muted-foreground">{dia.data}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Suco 1</p>
                    <p className="text-sm text-muted-foreground">
                      {dia.suco1.nome} (ID: {dia.suco1.id})
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium">Suco 2</p>
                    <p className="text-sm text-muted-foreground">
                      {dia.suco2.nome} (ID: {dia.suco2.id})
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium">Sobremesa</p>
                    <p className="text-sm text-muted-foreground">{dia.sobremesa}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground">
            <p>Gerado em: {new Date(juiceConfig.gerado_em).toLocaleString('pt-BR')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};