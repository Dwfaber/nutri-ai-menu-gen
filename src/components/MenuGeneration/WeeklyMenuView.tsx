import React, { useEffect, useState } from "react";
import { generateMenu, MenuResult } from "@/utils/costCalculations";
import MenuTable from "@/components/MenuTable/MenuTable";
import { Loader2 } from "lucide-react";

export interface WeeklyMenuViewProps {
  clienteId?: string;
  periodoDias?: number;
  refeicoesPorDia?: number;
  orcamentoPorRefeicao?: number;
  menu?: MenuResult; // Pode receber menu já pronto
}

const WeeklyMenuView: React.FC<WeeklyMenuViewProps> = ({
  clienteId,
  periodoDias = 5,
  refeicoesPorDia = 50,
  orcamentoPorRefeicao = 7,
  menu,
}) => {
  const [generatedMenu, setGeneratedMenu] = useState<MenuResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Caso já receba menu pronto (ex: vindo de Cardapios.tsx)
  if (menu) {
    return (
      <MenuTable
        title={`Cardápio - ${menu.periodo}`}
        weekPeriod={menu.periodo}
        totalCost={menu.resumo_custos.custo_total_calculado}
        costPerServing={menu.resumo_custos.custo_por_refeicao}
        totalServings={menu.total_refeicoes}
        recipes={menu.receitas}
      />
    );
  }

  // Gera menu chamando Edge Function quando não recebe pronto
  useEffect(() => {
    const fetchMenu = async () => {
      if (!clienteId) return;
      setLoading(true);
      try {
        const result = await generateMenu({
          cliente: clienteId,
          periodo_dias: periodoDias,
          refeicoes_por_dia: refeicoesPorDia,
          orcamento_por_refeicao: orcamentoPorRefeicao,
        });
        setGeneratedMenu(result);
      } catch (error) {
        console.error("Erro ao gerar cardápio:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [clienteId, periodoDias, refeicoesPorDia, orcamentoPorRefeicao]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
        Gerando cardápio...
      </div>
    );
  }

  if (!generatedMenu) {
    return (
      <div className="p-8 text-center text-gray-500">
        Nenhum cardápio disponível
      </div>
    );
  }

  return (
    <MenuTable
      title={`Cardápio - ${generatedMenu.periodo}`}
      weekPeriod={generatedMenu.periodo}
      totalCost={generatedMenu.resumo_custos.custo_total_calculado}
      costPerServing={generatedMenu.resumo_custos.custo_por_refeicao}
      totalServings={generatedMenu.total_refeicoes}
      recipes={generatedMenu.receitas}
    />
  );
};

export default WeeklyMenuView;