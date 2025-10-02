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

    // Calcular custo via Edge Function (quick-worker)
    console.log('📞 Chamando quick-worker para calcular custo...');
    const { data: costData, error: costError } = await supabase.functions.invoke('quick-worker', {
      body: {
        action: 'calcular_receita',
        receita_id: recipe.receita_id_legado,
        porcoes: servings
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
      custo_por_porcao: costData?.custo_por_porcao,
      ingredientes_calculados: costData?.ingredientes?.length || 0,
      validacao: costData?.validacao,
      aprovado: costData?.aprovado
    });

    // Log detalhado de cada ingrediente
    if (costData?.ingredientes && Array.isArray(costData.ingredientes)) {
      console.log('\n📊 Detalhamento por ingrediente:');
      costData.ingredientes.forEach((ing: any, idx: number) => {
        console.log(`\n${idx + 1}. ${ing.nome || ing.produto_base_descricao}`);
        console.log(`   • Quantidade: ${ing.quantidade} ${ing.unidade}`);
        console.log(`   • Preço unitário: R$ ${ing.preco_unitario?.toFixed(4)}`);
        console.log(`   • Custo ingrediente: R$ ${ing.custo_ingrediente?.toFixed(2)}`);
        console.log(`   • Custo por porção: R$ ${ing.custo_por_porcao?.toFixed(4)}`);
        if (ing.correcao_aplicada) {
          console.log(`   ⚠️ Correção aplicada: ${ing.correcao_aplicada}`);
        }
      });
    }

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
