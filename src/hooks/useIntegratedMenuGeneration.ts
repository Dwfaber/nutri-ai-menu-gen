import { useState, useCallback } from "react";
import { generateMenu, MenuResult } from "@/utils/costCalculations";

export interface SimpleMenuFormData {
  period: { start: string; end: string };
  mealsPerDay: number;
  estimatedMeals?: number;
  budgetPerMeal?: number;
  preferences?: string[];
  juiceConfig?: any;
  proteinGrams?: string;
  diasUteis?: boolean; // se true → 5 dias, senão → 7
}

export interface GeneratedMenu {
  id: string;
  clientId: string;
  period: string;
  costPerMeal: number;
  totalRecipes: number;
  mealsPerDay: number;
  recipes: any[];
  createdAt: string;
  menu: MenuResult | null;
  warnings: string[];
}

interface UseIntegratedMenuGenerationReturn {
  generatedMenu: GeneratedMenu | null;
  error: string | null;
  generateMenuWithFormData: (formData: SimpleMenuFormData) => Promise<GeneratedMenu | null>;
  clearGeneratedMenu: () => void;
  clearMenuExplicitly: () => void;
  approveMenu: (menuId: string, approverName: string) => Promise<boolean>;
  rejectMenu: (menuId: string, reason: string) => Promise<boolean>;
  deleteGeneratedMenu: (menuId: string) => Promise<boolean>;
  violations: string[];
  validateMenu: (menu: GeneratedMenu) => string[];
}

export function useIntegratedMenuGeneration(): UseIntegratedMenuGenerationReturn {
  const [generatedMenu, setGeneratedMenu] = useState<GeneratedMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<string[]>([]);

  // ---------------------------------
  // Helpers fictícios: loadSavedMenus, approveMenu, rejectMenu, delete
  // (você ajusta se tiver persistência real no Supabase)
  const loadSavedMenus = async () => {};
  const approveMenu = async (menuId: string, approver: string) => true;
  const rejectMenu = async (menuId: string, reason: string) => true;
  const deleteGeneratedMenu = async (menuId: string) => true;

  const clearGeneratedMenu = () => setGeneratedMenu(null);

  const generateMenuWithFormData = useCallback(
    async (formData: SimpleMenuFormData) => {
      try {
        const periodLabel = `${formData.period.start} - ${formData.period.end}`;
        const periodDays = formData.diasUteis ? 5 : 7;

        const menu = await generateMenu({
          cliente: "default", // aqui você conecta com o cliente selecionado no app
          periodo_dias: periodDays,
          refeicoes_por_dia: formData.mealsPerDay,
          orcamento_por_refeicao: formData.budgetPerMeal || 0,
          receitas_fixas: [],
          receitas_sugeridas: formData.preferences || [],
        });

        if (menu) {
          const mappedMenu: GeneratedMenu = {
            id: crypto.randomUUID(),
            clientId: menu.cliente,
            period: periodLabel,
            costPerMeal: menu.resumo_custos.custo_por_refeicao,
            totalRecipes:
              (menu.receitas.fixas?.length || 0) +
              (menu.receitas.principais?.length || 0) +
              (menu.receitas.acompanhamentos?.length || 0),
            mealsPerDay: formData.mealsPerDay,
            recipes: [
              ...(menu.receitas.fixas || []),
              ...(menu.receitas.principais || []),
              ...(menu.receitas.acompanhamentos || []),
            ],
            createdAt: new Date().toISOString(),
            menu,
            warnings: menu.avisos || [],
          };

          setGeneratedMenu(mappedMenu);
          await loadSavedMenus();
          return mappedMenu;
        }
        return null;
      } catch (err) {
        console.error("Erro ao gerar menu integrado:", err);
        setError(err instanceof Error ? err.message : "Erro desconhecido");
        return null;
      }
    },
    []
  );

  const validateMenu = (menu: GeneratedMenu): string[] => {
    const issues: string[] = [];
    if (!menu.recipes || menu.recipes.length === 0) {
      issues.push("Cardápio não possui receitas.");
    }
    // outras validações nutricionais ou de regras podem entrar aqui
    setViolations(issues);
    return issues;
  };

  return {
    generatedMenu,
    error,
    violations,
    generateMenuWithFormData,
    clearGeneratedMenu,
    clearMenuExplicitly: () => clearGeneratedMenu(),
    approveMenu,
    rejectMenu,
    deleteGeneratedMenu,
    validateMenu,
  };
}