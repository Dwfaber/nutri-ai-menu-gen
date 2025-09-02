import React from "react";
import { GeneratedMenu } from "@/hooks/useIntegratedMenuGeneration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  return (
    <div className="space-y-6">
      {Object.entries(receitasPorDia).map(([dia, categorias]) => (
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
                    className="border rounded p-2 shadow-sm bg-white"
                  >
                    <p className="font-semibold">{cat}</p>
                    {receita ? (
                      <>
                        <p>{receita.name}</p>
                        <p className="text-sm text-gray-500">
                          Custo: R$ {Number(receita.cost || 0).toFixed(2)}
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-400 italic">Não disponível</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};