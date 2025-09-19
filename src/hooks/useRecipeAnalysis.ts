import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Recipe {
  nome: string;
  ingredientes: number;
}

interface CategoryAnalysis {
  nome: string;
  total_receitas: number;
  receitas_completas: Recipe[];
  receitas_problematicas: Recipe[];
}

const fetchRecipeAnalysis = async (): Promise<CategoryAnalysis[]> => {
  console.log('Fetching recipe analysis...');

  // Buscar todas as receitas com suas categorias e contar ingredientes
  const { data: receitasData, error: receitasError } = await supabase
    .from('receitas_legado')
    .select('receita_id_legado, nome_receita, categoria_descricao')
    .eq('inativa', false)
    .not('categoria_descricao', 'is', null)
    .order('categoria_descricao', { ascending: true });

  if (receitasError) {
    console.error('Error fetching recipes:', receitasError);
    throw receitasError;
  }

  if (!receitasData || receitasData.length === 0) {
    console.log('No recipes found');
    return [];
  }

  console.log(`Found ${receitasData.length} recipes`);

  // Buscar contagem de ingredientes para cada receita
  const receitaIds = receitasData.map(r => r.receita_id_legado);

  const { data: ingredientesData, error: ingredientesError } = await supabase
    .from('receita_ingredientes')
    .select('receita_id_legado')
    .in('receita_id_legado', receitaIds);

  if (ingredientesError) {
    console.error('Error fetching ingredients:', ingredientesError);
    throw ingredientesError;
  }

  // Contar ingredientes por receita
  const ingredientCount: Record<string, number> = {};
  if (ingredientesData) {
    ingredientesData.forEach(ing => {
      const id = ing.receita_id_legado;
      ingredientCount[id] = (ingredientCount[id] || 0) + 1;
    });
  }

  // Agrupar por categoria
  const categorias: Record<string, CategoryAnalysis> = {};

  receitasData.forEach(receita => {
    const categoria = receita.categoria_descricao || 'SEM CATEGORIA';
    const numIngredientes = ingredientCount[receita.receita_id_legado] || 0;
    
    if (!categorias[categoria]) {
      categorias[categoria] = {
        nome: categoria,
        total_receitas: 0,
        receitas_completas: [],
        receitas_problematicas: []
      };
    }

    categorias[categoria].total_receitas++;

    const recipeInfo: Recipe = {
      nome: receita.nome_receita,
      ingredientes: numIngredientes
    };

    if (numIngredientes >= 5) {
      categorias[categoria].receitas_completas.push(recipeInfo);
    } else {
      categorias[categoria].receitas_problematicas.push(recipeInfo);
    }
  });

  // Converter para array e ordenar
  const resultado = Object.values(categorias).sort((a, b) => {
    // Priorizar categorias principais do cardápio
    const prioridadeCategoria = (nome: string) => {
      if (nome.includes('PRATO PRINCIPAL')) return 1;
      if (nome.includes('GUARNIÇÃO')) return 2;
      if (nome.includes('SALADA')) return 3;
      if (nome.includes('BEBIDAS') || nome.includes('SUCO')) return 4;
      if (nome.includes('SOBREMESA')) return 5;
      return 6;
    };

    const prioridadeA = prioridadeCategoria(a.nome);
    const prioridadeB = prioridadeCategoria(b.nome);

    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB;
    }

    return a.nome.localeCompare(b.nome);
  });

  console.log('Recipe analysis completed:', resultado.length, 'categories');
  return resultado;
};

export const useRecipeAnalysis = () => {
  return useQuery({
    queryKey: ['recipe-analysis'],
    queryFn: fetchRecipeAnalysis,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};