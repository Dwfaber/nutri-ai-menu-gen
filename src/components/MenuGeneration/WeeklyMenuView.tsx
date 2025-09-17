import React, { useEffect, useState } from "react";
import { generateMenu, MenuResult, RecipeCost } from "@/utils/costCalculations";
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

  // Converter receitas categorizadas para array simples
  const convertRecipesToArray = (receitas: { fixas: RecipeCost[]; principais: RecipeCost[]; acompanhamentos: RecipeCost[] }) => {
    const allRecipes = [
      ...receitas.fixas || [],
      ...receitas.principais || [], 
      ...receitas.acompanhamentos || []
    ];
    
    return allRecipes.map((recipe, index) => ({
      id: recipe.receita_id?.toString() || index.toString(),
      name: recipe.nome,
      category: recipe.categoria || 'PP1',
      day: 'Segunda-feira', // Default day - will be updated based on recipe position
      cost: recipe.custo_total,
      servings: recipe.porcoes_calculadas,
      ingredients: recipe.ingredientes?.map(ing => ({
        name: ing.nome,
        quantity: ing.quantidade_necessaria,
        unit: ing.unidade
      })) || []
    }));
  };

  // Caso já receba menu pronto (ex: vindo de Cardapios.tsx)
  if (menu) {
    const recipesArray = convertRecipesToArray(menu.receitas);
    return (
      <MenuTable
        title={`Cardápio - ${menu.periodo}`}
        weekPeriod={menu.periodo}
        totalCost={menu.resumo_custos.custo_total_calculado}
        recipes={recipesArray}
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

  const recipesArray = convertRecipesToArray(generatedMenu.receitas);
  return (
    <MenuTable
      title={`Cardápio - ${generatedMenu.periodo}`}
      weekPeriod={generatedMenu.periodo}
      totalCost={generatedMenu.resumo_custos.custo_total_calculado}
      recipes={recipesArray}
    />
  );
};

export default WeeklyMenuView;