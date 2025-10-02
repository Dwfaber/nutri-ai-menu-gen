import { supabase } from "../integrations/supabase/client";

export async function testRecipeCalculation(recipeName: string, servings: number = 100) {
  try {
    console.log(`🧪 Testando cálculo da receita: ${recipeName} para ${servings} pessoas...`);
    
    // Buscar a receita pelo nome
    const { data: recipe, error: recipeError } = await supabase
      .from('receitas_legado')
      .select('receita_id_legado, nome_receita, categoria_descricao, ingredientes')
      .ilike('nome_receita', `%${recipeName}%`)
      .limit(1)
      .single();

    if (recipeError || !recipe) {
      console.error('❌ Receita não encontrada:', recipeError);
      return { success: false, error: 'Receita não encontrada' };
    }

    console.log('✅ Receita encontrada:', recipe.receita_id_legado, recipe.nome_receita);

    // Buscar ingredientes detalhados
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('receita_ingredientes')
      .select('*')
      .eq('receita_id_legado', recipe.receita_id_legado);

    if (ingredientsError) {
      console.error('❌ Erro ao buscar ingredientes:', ingredientsError);
      return { success: false, error: ingredientsError.message };
    }

    console.log(`📋 Ingredientes encontrados: ${ingredients?.length || 0}`);

    // Calcular custo via Edge Function
    const { data: costData, error: costError } = await supabase.functions.invoke('swift-processor', {
      body: {
        action: 'calculate_recipe_cost',
        receita_id: recipe.receita_id_legado,
        meal_quantity: servings
      }
    });

    if (costError) {
      console.error('❌ Erro no cálculo:', costError);
      return { success: false, error: costError.message };
    }

    console.log('✅ Cálculo concluído:', {
      receita: recipe.nome_receita,
      porcoes: servings,
      custo_total: costData?.custo_total,
      custo_por_porcao: costData?.custo_por_refeicao,
      ingredientes_calculados: costData?.ingredientes?.length || 0
    });

    return { 
      success: true, 
      recipe: recipe.nome_receita,
      data: costData 
    };
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
