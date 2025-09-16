import React, { useEffect, useState } from "react";
import { gerarSemanas, preencherReceitasSugeridas } from "@/utils/weekGenerator";
import { generateMenu } from "@/utils/costCalculations";
import MenuTable from "@/components/MenuTable";

interface WeeklyMenuViewProps {
  clienteId: string;
  periodoDias?: number;
  refeicoesPorDia?: number;
  orcamentoPorRefeicao?: number;
}

const WeeklyMenuView: React.FC<WeeklyMenuViewProps> = ({
  clienteId,
  periodoDias = 5,
  refeicoesPorDia = 50,
  orcamentoPorRefeicao = 7
}) => {
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [weekPeriod, setWeekPeriod] = useState("");

  useEffect(() => {
    const gerarMenu = async () => {
      try {
        // 1. Gera os dias da semana
        const semanas = gerarSemanas(new Date(), new Date(Date.now() + (periodoDias - 1) * 86400000), false);

        // 2. Preenche automaticamente as receitas sugeridas
        const receitas_sugeridas = await preencherReceitasSugeridas(semanas);

        // 3. Chama o CostCalculator
        const menuResult = await generateMenu({
          cliente: clienteId,
          periodo_dias: periodoDias,
          refeicoes_por_dia: refeicoesPorDia,
          orcamento_por_refeicao: orcamentoPorRefeicao,
          receitas_fixas: ["580", "1600"], // Arroz + Feijão
          receitas_sugeridas: receitas_sugeridas.map(r => r.id.toString())
        });

        // 4. Converte para o formato que o MenuTable espera
        const recipesMapped = [
          ...(menuResult.receitas.fixas || []),
          ...(menuResult.receitas.principais || []),
          ...(menuResult.receitas.acompanhamentos || [])
        ].map(r => ({
          id: r.receita_id,
          name: r.nome,
          category: r.categoria,
          day: "Segunda-feira", // 🔧 Aqui podemos usar weeks/dia real se precisar
          cost: r.custo_por_porcao,
          servings: r.porcoes_calculadas,
          ingredients: r.ingredientes?.map(i => ({
            name: i.nome,
            quantity: i.quantidade_necessaria,
            unit: i.unidade
          }))
        }));

        setRecipes(recipesMapped);
        setTotalCost(menuResult.resumo_custos.custo_total_calculado);
        setWeekPeriod(`${menuResult.data_inicio} - ${menuResult.data_fim}`);
      } catch (err: any) {
        console.error("Erro ao gerar cardápio:", err.message);
      } finally {
        setLoading(false);
      }
    };

    gerarMenu();
  }, [clienteId, periodoDias, refeicoesPorDia, orcamentoPorRefeicao]);

  if (loading) return <div>Carregando cardápio...</div>;

  return (
    <MenuTable
      title="Cardápio Semanal"
      weekPeriod={weekPeriod}
      totalCost={totalCost}
      recipes={recipes}
    />
  );
};

export default WeeklyMenuView;