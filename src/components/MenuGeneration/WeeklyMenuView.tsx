import React, { useState } from "react";
import { GeneratedMenu } from "@/hooks/useIntegratedMenuGeneration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekNavigator } from "./WeekNavigator";

interface WeeklyMenuViewProps {
  menu: GeneratedMenu;
}

// ✅ Mapeamento entre nomes do backend e códigos da UI
const CATEGORY_MAPPING: Record<string, string> = {
  "Proteína Principal 1": "PP1",
  "Prato Principal 1": "PP1", // sinônimo
  "Proteína Principal 2": "PP2",
  "Prato Principal 2": "PP2", // sinônimo
  "Arroz Branco": "Arroz Branco",
  "Feijão": "Feijão",
  "Guarnição": "Guarnição",
  "Salada 1 (Verduras)": "Salada 1",
  "Salada 2 (Legumes)": "Salada 2",
  "Salada": "Salada 1", // fallback, se vier genérico
  "Suco 1": "Suco 1",
  "Suco 2": "Suco 2",
  "Suco": "Suco 1", // fallback, se vier genérico
  "Sobremesa": "Sobremesa",
};

// ✅ Definimos as categorias fixas que SEMPRE devem aparecer
const CATEGORIAS_FIXAS = [
  "PP1",
  "PP2", 
  "Arroz Branco",
  "Feijão",
  "Guarnição",
  "Salada 1",
  "Salada 2",
  "Suco 1",
  "Suco 2",
  "Sobremesa",
];

export const WeeklyMenuView: React.FC<WeeklyMenuViewProps> = ({ menu }) => {
  if (!menu?.recipes?.length) {
    return <p>Nenhuma receita encontrada para este cardápio.</p>;
  }

  // 🔎 Agrupar receitas por dia com mapeamento de categorias
  const receitasPorDia = menu.recipes.reduce((acc: any, r) => {
    if (!acc[r.day]) acc[r.day] = {};
    
    // 🔧 Mapeia categoria do backend para código da UI
    const categoriaMapeada = CATEGORY_MAPPING[r.category] || r.category;
    
    // 🔧 Elimina duplicadas: se já existe categoria, não sobrescreve
    if (!acc[r.day][categoriaMapeada]) {
      acc[r.day][categoriaMapeada] = r;
    }
    return acc;
  }, {});

  // Definir ordem dos dias da semana
  const DIAS_ORDEM = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira', 
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo'
  ];

  // Agrupar dias por semanas (7 dias cada)
  const diasDisponiveis = Object.keys(receitasPorDia).sort((a, b) => {
    const indexA = DIAS_ORDEM.indexOf(a);
    const indexB = DIAS_ORDEM.indexOf(b);
    return indexA - indexB;
  });

  const semanas: Record<number, string[]> = {};
  diasDisponiveis.forEach((dia, index) => {
    const numeroSemana = Math.floor(index / 7) + 1;
    if (!semanas[numeroSemana]) {
      semanas[numeroSemana] = [];
    }
    semanas[numeroSemana].push(dia);
  });

  const totalSemanas = Object.keys(semanas).length;
  const [semanaAtual, setSemanaAtual] = useState(1);

  // Obter dias da semana atual
  const diasSemanaAtual = semanas[semanaAtual] || [];

  return (
    <div className="space-y-6">
      <WeekNavigator
        currentWeek={semanaAtual}
        totalWeeks={totalSemanas}
        onWeekChange={setSemanaAtual}
      />
      
      {totalSemanas > 1 && (
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-muted-foreground">
            Semana {semanaAtual} - {menu.clientName}
          </h3>
        </div>
      )}
      
      {diasSemanaAtual.map((dia) => {
        const categorias = receitasPorDia[dia];
        return (
          <Card key={dia} className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{dia}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {CATEGORIAS_FIXAS.map((cat) => {
                  const receita = (categorias as any)[cat];
                  return (
                    <div
                      key={cat}
                      className="border rounded p-2 shadow-sm bg-card"
                    >
                      <p className="font-semibold text-foreground">{cat}</p>
                      {receita ? (
                        <>
                          <p className="text-foreground">{receita.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Custo: R$ {Number(receita.cost || 0).toFixed(2)}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted-foreground italic">Não disponível</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};