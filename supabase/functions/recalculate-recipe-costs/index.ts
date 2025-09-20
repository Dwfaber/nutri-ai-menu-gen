import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IngredientData {
  receita_id_legado: string;
  produto_base_id: number;
  quantidade: number;
  unidade: string;
  nome: string;
}

interface ProductData {
  produto_base_id: number;
  preco: number;
  unidade: string;
  descricao: string;
  per_capita: number;
  produto_base_quantidade_embalagem: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Iniciando recálculo de custos para todas as receitas...');

    // Buscar todas as receitas ativas
    const { data: receitas, error: receitasError } = await supabase
      .from('receitas_legado')
      .select('receita_id_legado, nome_receita, categoria_descricao')
      .eq('inativa', false)
      .order('receita_id_legado');

    if (receitasError) {
      throw new Error(`Erro ao buscar receitas: ${receitasError.message}`);
    }

    console.log(`📊 Total de receitas ativas encontradas: ${receitas?.length || 0}`);

    // Buscar todos os produtos disponíveis uma única vez
    const { data: produtos, error: produtosError } = await supabase
      .from('co_solicitacao_produto_listagem')
      .select(`
        produto_base_id,
        preco,
        unidade,
        descricao,
        per_capita,
        produto_base_quantidade_embalagem
      `)
      .gt('preco', 0)
      .order('produto_base_id');

    if (produtosError) {
      throw new Error(`Erro ao buscar produtos: ${produtosError.message}`);
    }

    console.log(`🛒 Total de produtos com preço encontrados: ${produtos?.length || 0}`);

    // Buscar todos os ingredientes uma única vez
    const { data: todosIngredientes, error: ingredientesError } = await supabase
      .from('receita_ingredientes')
      .select(`
        receita_id_legado,
        produto_base_id,
        quantidade,
        unidade,
        nome,
        receitas_legado!inner(inativa)
      `)
      .eq('receitas_legado.inativa', false)
      .not('produto_base_id', 'is', null);

    if (ingredientesError) {
      throw new Error(`Erro ao buscar ingredientes: ${ingredientesError.message}`);
    }

    console.log(`🥘 Total de ingredientes encontrados: ${todosIngredientes?.length || 0}`);

    // Agrupar ingredientes por receita
    const ingredientesPorReceita = new Map<string, IngredientData[]>();
    todosIngredientes?.forEach(ing => {
      if (!ingredientesPorReceita.has(ing.receita_id_legado)) {
        ingredientesPorReceita.set(ing.receita_id_legado, []);
      }
      ingredientesPorReceita.get(ing.receita_id_legado)!.push(ing);
    });

    // Criar mapa de produtos para busca rápida
    const produtosPorId = new Map<number, ProductData[]>();
    produtos?.forEach(produto => {
      if (!produtosPorId.has(produto.produto_base_id)) {
        produtosPorId.set(produto.produto_base_id, []);
      }
      produtosPorId.get(produto.produto_base_id)!.push(produto);
    });

    const BATCH_SIZE = 50;
    const PORCOES_PADRAO = 100; // Calcular sempre para 100 pessoas
    let processadas = 0;
    let comSucesso = 0;
    let comErro = 0;

    // Processar receitas em lotes
    for (let i = 0; i < receitas.length; i += BATCH_SIZE) {
      const loteReceitas = receitas.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(receitas.length/BATCH_SIZE)}: ${loteReceitas.length} receitas`);

      const updatePromises = loteReceitas.map(async (receita) => {
        try {
          const ingredientes = ingredientesPorReceita.get(receita.receita_id_legado) || [];
          
          if (ingredientes.length === 0) {
            console.log(`⚠️ Receita ${receita.receita_id_legado} sem ingredientes`);
            return { success: false, receita: receita.receita_id_legado, erro: 'Sem ingredientes' };
          }

          let custoTotal = 0;
          let ingredientesEncontrados = 0;

          for (const ingrediente of ingredientes) {
            const produtosDisponiveis = produtosPorId.get(ingrediente.produto_base_id) || [];
            
            if (produtosDisponiveis.length === 0) {
              continue;
            }

            // Calcular preço médio dos produtos disponíveis
            const precoMedio = produtosDisponiveis.reduce((acc, p) => acc + (p.preco || 0), 0) / produtosDisponiveis.length;
            
            // Usar o primeiro produto para informações de embalagem
            const produtoRef = produtosDisponiveis[0];
            const quantidadeEmbalagem = produtoRef.produto_base_quantidade_embalagem || 1;
            
            // Conversão simples de unidades para kg/L
            let quantidadeBase = ingrediente.quantidade;
            const unidade = ingrediente.unidade?.toLowerCase() || '';
            
            if (unidade.includes('g') && !unidade.includes('kg')) {
              quantidadeBase = quantidadeBase / 1000; // g para kg
            } else if (unidade.includes('ml') && !unidade.includes('l')) {
              quantidadeBase = quantidadeBase / 1000; // ml para L
            }

            // Calcular custo para a quantidade necessária
            const quantidadePorPorcao = quantidadeBase / (receita.porcoes || 1);
            const quantidadeTotal = quantidadePorPorcao * PORCOES_PADRAO;
            const numeroPacotes = Math.ceil(quantidadeTotal / quantidadeEmbalagem);
            const custoIngrediente = numeroPacotes * precoMedio;

            custoTotal += custoIngrediente;
            ingredientesEncontrados++;
          }

          // Só atualizar se encontrou pelo menos 80% dos ingredientes
          const percentualEncontrado = (ingredientesEncontrados / ingredientes.length) * 100;
          
          if (percentualEncontrado >= 80) {
            const { error: updateError } = await supabase
              .from('receitas_legado')
              .update({ 
                custo_total: Math.round(custoTotal * 100) / 100,
                sync_at: new Date().toISOString()
              })
              .eq('receita_id_legado', receita.receita_id_legado);

            if (updateError) {
              throw new Error(`Erro ao atualizar receita: ${updateError.message}`);
            }

            return { 
              success: true, 
              receita: receita.receita_id_legado, 
              custo: custoTotal,
              ingredientes: ingredientesEncontrados,
              total: ingredientes.length
            };
          } else {
            return { 
              success: false, 
              receita: receita.receita_id_legado, 
              erro: `Apenas ${percentualEncontrado.toFixed(1)}% dos ingredientes encontrados`
            };
          }

        } catch (error) {
          console.error(`❌ Erro ao processar receita ${receita.receita_id_legado}:`, error);
          return { success: false, receita: receita.receita_id_legado, erro: error.message };
        }
      });

      const resultados = await Promise.all(updatePromises);
      
      resultados.forEach(resultado => {
        processadas++;
        if (resultado.success) {
          comSucesso++;
          console.log(`✅ ${resultado.receita}: R$ ${resultado.custo?.toFixed(2)} (${resultado.ingredientes}/${resultado.total} ingredientes)`);
        } else {
          comErro++;
          console.log(`❌ ${resultado.receita}: ${resultado.erro}`);
        }
      });

      // Pequena pausa entre lotes para não sobrecarregar o sistema
      if (i + BATCH_SIZE < receitas.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const resultado = {
      success: true,
      message: 'Recálculo de custos concluído',
      statistics: {
        total_receitas: receitas.length,
        processadas,
        com_sucesso: comSucesso,
        com_erro: comErro,
        percentual_sucesso: Math.round((comSucesso / processadas) * 100)
      },
      timestamp: new Date().toISOString()
    };

    console.log('📊 Estatísticas finais:', resultado.statistics);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro geral no recálculo:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});