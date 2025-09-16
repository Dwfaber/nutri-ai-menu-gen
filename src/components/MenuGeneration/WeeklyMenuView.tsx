import React, { useEffect, useState } from "react";
import { generateMenu } from "@/utils/costCalculations"; // ✅ garante que o arquivo tenha esse nome
import { GeneratedMenu } from "@/hooks/useIntegratedMenuGeneration";
import MenuTable from "@/components/MenuTable/MenuTable";
import { Loader2 } from "lucide-react";

export interface WeeklyMenuViewProps {
  // modo geração
  clienteId?: string;
  periodoDias?: number;
  refeicoesPorDia?: number;
  orcamentoPorRefeicao?: number;

  // modo renderização
  menu?: GeneratedMenu;
}

const WeeklyMenuView: React.FC<WeeklyMenuViewProps> = ({
  clienteId,
  periodoDias = 5,
  refeicoesPorDia = 50,
  orcamentoPorRefeicao = 7,
  menu,
}) => {
  const [generatedMenu, setGeneratedMenu] = useState<GeneratedMenu | null>(null);
  const [loading, setLoading] = useState(false);

  // 🔹 Se um menu pronto foi passado via prop → usa direto
  if (menu) {
    return (
      <MenuTable
        title={`Cardápio - ${menu.weekPeriod}`}
        weekPeriod={menu.weekPeriod}
        totalCost={menu.totalCost}
        recipes={menu.recipes}
      />
    );
  }

  // 🔹 Se não veio menu, gera automaticamente
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
        setGeneratedMenu(result as unknown as GeneratedMenu);
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
      title={`Cardápio - ${generatedMenu.weekPeriod}`}
      weekPeriod={generatedMenu.weekPeriod}
      totalCost={generatedMenu.totalCost}
      recipes={generatedMenu.recipes}
    />
  );
};

export default WeeklyMenuView;