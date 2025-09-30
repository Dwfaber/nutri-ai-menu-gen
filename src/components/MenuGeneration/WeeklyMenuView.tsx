import React, { useEffect, useState } from "react";
import { generateMenu, MenuResult, RecipeCost } from "@/utils/costCalculations";
import MenuTable from "@/components/MenuTable/MenuTable";
import { MenuDayCarousel } from "./MenuDayCarousel";
import { Loader2 } from "lucide-react";

export interface WeeklyMenuViewProps {
  clienteId?: string;
  periodoDias?: number;
  refeicoesPorDia?: number;
  orcamentoPorRefeicao?: number;
  menu?: MenuResult | any;
}

// FUNÇÃO AUXILIAR: Extrair custo de qualquer formato
const extractCost = (receita: any): number => {
  return Number(
    receita.custo || 
    receita.cost || 
    receita.custo_por_refeicao || 
    receita.custo_por_porcao ||
    0
  );
};

const WeeklyMenuView: React.FC<WeeklyMenuViewProps> = ({
  clienteId,
  periodoDias = 5,
  refeicoesPorDia = 50,
  orcamentoPorRefeicao = 7,
  menu,
}) => {
  const [generatedMenu, setGeneratedMenu] = useState<MenuResult | null>(null);
  const [loading, setLoading] = useState(false);

  const convertRecipesToArray = (receitas: { 
    fixas: RecipeCost[]; 
    principais: RecipeCost[]; 
    acompanhamentos: RecipeCost[] 
  }) => {
    const allRecipes = [
      ...receitas.fixas || [],
      ...receitas.principais || [], 
      ...receitas.acompanhamentos || []
    ];
    
    return allRecipes.map((recipe, index) => ({
      id: recipe.receita_id?.toString() || index.toString(),
      name: recipe.nome,
      category: recipe.categoria || 'PP1',
      day: 'Segunda-feira',
      cost: recipe.custo_total,
      servings: recipe.porcoes_calculadas,
      ingredients: recipe.ingredientes?.map(ing => ({
        name: ing.nome,
        quantity: ing.quantidade_necessaria,
        unit: ing.unidade
      })) || []
    }));
  };

  if (menu) {
    try {
      console.log('WeeklyMenuView received menu:', menu);
      
      // 1. FORMATO CORRIGIDO: menu.menu.dias (do hook corrigido)
      const hookDias = (menu as any).menu?.dias;
      if (hookDias && Array.isArray(hookDias)) {
        console.log('✅ Found hook corrected format: menu.menu.dias', hookDias);
        return (
          <div className="min-h-screen bg-gray-100 py-8">
            <div className="container mx-auto px-4">
              <MenuDayCarousel 
                menu={{
                  clientName: menu.clientName || menu.client_name || 'Cliente',
                  weekPeriod: menu.weekPeriod || menu.week_period || 'Período',
                  cardapio: hookDias.map((dia: any) => ({
                    dia: dia.dia,
                    receitas: dia.receitas?.map((receita: any) => ({
                      receita_id: receita.receita_id || receita.id,
                      nome: receita.nome || receita.name,
                      categoria: receita.categoria || receita.category,
                      custo: extractCost(receita),
                      ordem: receita.ordem
                    })) || [],
                    custo_total: dia.custo_total,
                    orcamento: dia.orcamento,
                    dentro_orcamento: dia.dentro_orcamento
                  }))
                }}
              />
            </div>
          </div>
        );
      }

      // 2. Saved menu format: menu_data.cardapio_semanal
      const savedCardapio = (menu as any).menu_data?.cardapio_semanal;
      if (savedCardapio && Array.isArray(savedCardapio)) {
        console.log('Found saved cardapio format:', savedCardapio);
        return (
          <div className="min-h-screen bg-gray-100 py-8">
            <div className="container mx-auto px-4">
              <MenuDayCarousel 
                menu={{
                  clientName: menu.client_name || menu.clientName || 'Cliente',
                  weekPeriod: menu.week_period || menu.weekPeriod || 'Período',
                  cardapio: savedCardapio
                }}
              />
            </div>
          </div>
        );
      }
      
      // 3. Validated menu format: top-level cardapio_semanal
      const validatedWeekly = (menu as any)?.cardapio_semanal;
      if (validatedWeekly && Array.isArray(validatedWeekly)) {
        console.log('Found validated cardapio_semanal format:', validatedWeekly);
        return (
          <div className="min-h-screen bg-gray-100 py-8">
            <div className="container mx-auto px-4">
              <MenuDayCarousel 
                menu={{
                  clientName: menu.client_name || menu.clientName || 'Cliente',
                  weekPeriod: menu.week_period || menu.weekPeriod || 'Período',
                  cardapio: validatedWeekly
                }}
              />
            </div>
          </div>
        );
      }
      
      // 4. Quick-worker format: menu.dias (direct dias array)
      const quickWorkerDias = (menu as any)?.dias;
      if (quickWorkerDias && Array.isArray(quickWorkerDias)) {
        console.log('Found quick-worker dias format:', quickWorkerDias);
        return (
          <div className="min-h-screen bg-gray-100 py-8">
            <div className="container mx-auto px-4">
              <MenuDayCarousel 
                menu={{
                  clientName: menu.cliente || menu.clientName || 'Cliente',
                  weekPeriod: menu.periodo || menu.weekPeriod || 'Período',
                  cardapio: quickWorkerDias.map((dia: any) => ({
                    dia: dia.dia_semana || dia.dia,
                    receitas: dia.receitas?.map((receita: any) => ({
                      receita_id: receita.receita_id?.toString() || receita.id,
                      nome: receita.nome,
                      categoria: receita.categoria,
                      custo: extractCost(receita),
                      porcoes: receita.porcoes || receita.servings || 100
                    })) || []
                  }))
                }}
              />
            </div>
          </div>
        );
      }

      // 5. Direct cardapio format
      const cardapio = (menu as any).cardapio || (menu as any).menu?.cardapio || (menu as any).menu_data?.cardapio;
      
      if (cardapio && Array.isArray(cardapio)) {
        console.log('Found direct cardapio format:', cardapio);
        return (
          <div className="min-h-screen bg-gray-100 py-8">
            <div className="container mx-auto px-4">
              <MenuDayCarousel 
                menu={{
                  clientName: menu.cliente || menu.clientName || 'Cliente',
                  weekPeriod: menu.periodo || menu.weekPeriod || 'Período',
                  cardapio: cardapio.map((dia: any) => ({
                    ...dia,
                    receitas: dia.receitas?.map((receita: any) => ({
                      ...receita,
                      custo: extractCost(receita)
                    })) || []
                  }))
                }}
              />
            </div>
          </div>
        );
      }
      
      // 6. Recipes array from saved menu
      const recipes = (menu as any).recipes;
      if (recipes && Array.isArray(recipes) && recipes.length > 0) {
        console.log('Found recipes array format:', recipes);
        return (
          <div className="min-h-screen bg-gray-100 py-8">
            <div className="container mx-auto px-4">
              <MenuDayCarousel 
                menu={{
                  clientName: menu.clientName || menu.cliente || 'Cliente',
                  weekPeriod: menu.weekPeriod || menu.periodo || 'Período',
                  recipes: recipes.map((recipe: any) => ({
                    ...recipe,
                    cost: extractCost(recipe)
                  }))
                }}
              />
            </div>
          </div>
        );
      }
      
      // 7. Fallback to old format if available
      if (menu.receitas) {
        console.log('Using old receitas format');
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
      
      console.log('❌ No recognized menu format found');
    } catch (error) {
      console.error('WeeklyMenuView menu parsing error:', error, menu);
      return (
        <div className="min-h-screen bg-gray-100 py-8">
          <div className="container mx-auto px-4 text-gray-500">
            Falha ao interpretar o cardápio recebido.
          </div>
        </div>
      );
    }
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

  // Check if we have the new cardapio format
  if ((generatedMenu as any).cardapio && Array.isArray((generatedMenu as any).cardapio)) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <MenuDayCarousel 
            menu={{
              clientName: generatedMenu.cliente || 'Cliente',
              weekPeriod: generatedMenu.periodo,
              cardapio: (generatedMenu as any).cardapio
            }}
          />
        </div>
      </div>
    );
  }

  // Fallback to old format
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