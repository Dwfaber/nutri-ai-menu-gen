import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== SISTEMA CORRIGIDO DE LISTA DE COMPRAS =====
class ShoppingListGeneratorFixed {
  private readonly CONVERSOES_UNIDADES = {
    // Peso
    'GR': { para_kg: 0.001, tipo: 'peso' },
    'G': { para_kg: 0.001, tipo: 'peso' },
    'GRAMA': { para_kg: 0.001, tipo: 'peso' },
    'KG': { para_kg: 1, tipo: 'peso' },
    'KILO': { para_kg: 1, tipo: 'peso' },
    
    // Volume
    'ML': { para_litro: 0.001, tipo: 'volume' },
    'LT': { para_litro: 1, tipo: 'volume' },
    'L': { para_litro: 1, tipo: 'volume' },
    'LITRO': { para_litro: 1, tipo: 'volume' },
    
    // Unidades
    'UN': { valor: 1, tipo: 'unidade' },
    'UND': { valor: 1, tipo: 'unidade' },
    'UNIDADE': { valor: 1, tipo: 'unidade' },
  };

  constructor(private supabase: any) {}

  async gerarListaComprasCorrigida(menuId: string, clientName: string, budgetPredicted: number, servingsPerDay: number) {
    console.log(`🛒 === GERAÇÃO DE LISTA CORRIGIDA ===`);
    console.log(`📋 Menu ID: ${menuId}`);
    console.log(`👤 Cliente: ${clientName}`);
    console.log(`🍽️ Porções/dia: ${servingsPerDay}`);
    
    try {
      // PASSO 1: Buscar cardápio com logs detalhados
      console.log(`🔍 Buscando cardápio com ID: ${menuId}`);
      console.log(`📊 Tipo do menuId: ${typeof menuId}, length: ${menuId?.length}`);
      
      const { data: menuData, error: menuError } = await this.supabase
        .from('generated_menus')
        .select('id, client_name, receitas_adaptadas, receitas_ids, created_at')
        .eq('id', menuId)
        .maybeSingle();

      if (menuError) {
        console.error('❌ Erro na busca do cardápio:', menuError);
        throw new Error(`Erro na busca do cardápio: ${menuError.message}`);
      }

      if (!menuData) {
        console.error('❌ Cardápio não encontrado na base de dados');
        console.log('🔍 Tentando listar cardápios existentes...');
        
        // Log para debug: mostrar cardápios existentes
        const { data: existingMenus } = await this.supabase
          .from('generated_menus')
          .select('id, client_name, created_at')
          .limit(5)
          .order('created_at', { ascending: false });
          
        console.log('📋 Últimos cardápios na base:', existingMenus?.map(m => `${m.id} - ${m.client_name}`));
        throw new Error(`Cardápio não encontrado: ${menuId}`);
      }

      console.log(`✅ Cardápio encontrado: ${menuData.client_name}`);
      console.log(`📅 Criado em: ${menuData.created_at}`);
      console.log(`🍽️ Receitas adaptadas: ${menuData.receitas_adaptadas?.length || 0} receitas`);
      
      // ESTRATÉGIA EM CASCATA: receitas_adaptadas → receitas_ids → erro
      let receitasAdaptadas = menuData.receitas_adaptadas || [];

      // 🚨 fallback quando receitas_adaptadas está vazio
      if (!Array.isArray(receitasAdaptadas) || receitasAdaptadas.length === 0) {
        console.warn("⚠️ receitas_adaptadas vazio, tentando fallback com receitas_ids");

        if (Array.isArray(menuData.receitas_ids) && menuData.receitas_ids.length > 0) {
          receitasAdaptadas = menuData.receitas_ids.map((id: string) => ({
            receita_id_legado: id
          }));
          console.log(`✅ Fallback: ${receitasAdaptadas.length} receitas recuperadas via receitas_ids`);
        } else {
          console.error("❌ Nenhuma receita associada a este cardápio:", menuData.id);
          console.log('📋 Conteúdo receitas_adaptadas:', menuData.receitas_adaptadas);
          console.log('📋 Conteúdo receitas_ids:', menuData.receitas_ids);
          throw new Error(`Cardápio ${menuData.id} não possui receitas associadas`);
        }
      } else {
        console.log(`✅ Usando receitas_adaptadas: ${receitasAdaptadas.length} receitas`);
      }

      // PASSO 2: Buscar ingredientes das receitas
      const recipeIds = receitasAdaptadas
        .map((r: any) => r.receita_id_legado)
        .filter(Boolean);

      if (!recipeIds.length) {
        throw new Error('Nenhum ID de receita válido encontrado');
      }

      const { data: ingredients, error: ingredientsError } = await this.supabase
        .from('receita_ingredientes')
        .select('receita_id_legado, nome, produto_base_id, produto_base_descricao, quantidade, unidade, quantidade_refeicoes')
        .in('receita_id_legado', recipeIds)
        .order('receita_id_legado');
      
      if (ingredientsError || !ingredients) {
        throw new Error('Erro ao buscar ingredientes das receitas');
      }
      
      console.log(`📦 ${ingredients.length} ingredientes encontrados nas receitas`);
      
      // PASSO 3: Consolidar ingredientes
      const ingredientesConsolidados = this.consolidarIngredientes(ingredients, servingsPerDay);
      console.log(`🔗 ${ingredientesConsolidados.size} ingredientes únicos consolidados`);
      
      // PASSO 4: Buscar produtos do mercado
      const { data: produtosMercado, error: mercadoError } = await this.supabase
        .from('co_solicitacao_produto_listagem')
        .select('produto_base_id, descricao, preco, produto_base_quantidade_embalagem, apenas_valor_inteiro_sim_nao, em_promocao_sim_nao, unidade')
        .gt('preco', 0)
        .order('preco');
      
      if (mercadoError) {
        console.error('❌ Erro ao buscar produtos do mercado:', mercadoError);
        throw mercadoError;
      }
      
      console.log(`🛍️ ${produtosMercado?.length || 0} produtos disponíveis no mercado`);
      
      // PASSO 5: Gerar lista de compras
      const listaCompras = [];
      const ingredientesNaoEncontrados = [];
      let custoTotal = 0;
      let itensPromocao = 0;
      let economiaPromocoes = 0;
      
      for (const [produtoId, ingrediente] of ingredientesConsolidados) {
        const resultado = this.processarIngredienteParaCompra(
          ingrediente, 
          produtosMercado || []
        );
        
        if (resultado.encontrado) {
          listaCompras.push(resultado.item);
          custoTotal += parseFloat(resultado.item.custo_total_compra);
          
          if (resultado.item.em_promocao) {
            itensPromocao++;
            economiaPromocoes += parseFloat(resultado.item.economia_promocao || '0');
          }
          
          console.log(`✅ ${resultado.item.nome_ingrediente}: ${resultado.item.quantidade_comprar} ${resultado.item.unidade} = R$ ${resultado.item.custo_total_compra}`);
        } else {
          ingredientesNaoEncontrados.push({
            nome: ingrediente.nome,
            quantidade: `${ingrediente.quantidade_total.toFixed(3)} ${ingrediente.unidade_padrao}`,
            receitas: Array.from(ingrediente.receitas)
          });
          console.log(`❌ ${ingrediente.nome}: não encontrado no mercado`);
        }
      }
      
      // PASSO 6: Agrupar por categoria
      const listaAgrupada = this.agruparPorCategoria(listaCompras);
      
      // PASSO 7: Salvar no banco
      const { data: shoppingList, error: listError } = await this.supabase
        .from('shopping_lists')
        .insert({
          menu_id: menuId,
          client_name: clientName,
          budget_predicted: budgetPredicted || 0,
          cost_actual: custoTotal,
          status: 'generated'
        })
        .select()
        .single();

      if (listError || !shoppingList) {
        console.error('Erro ao salvar lista:', listError);
        throw new Error('Erro ao salvar lista de compras');
      }

      // Salvar itens
      if (listaCompras.length > 0) {
        const itemsToInsert = listaCompras.map(item => {
          console.log('🔍 Mapeando item:', item);
          return {
            shopping_list_id: shoppingList.id,
            product_id_legado: item.produto_base_id?.toString() || 'unknown',
            product_name: item.nome_ingrediente || 'Produto sem nome',
            category: item.categoria_estimada || 'DIVERSOS',
            quantity: parseFloat(item.quantidade_comprar) || 0,
            unit: item.unidade || 'UN',
            unit_price: parseFloat(item.preco_unitario) || 0,
            total_price: parseFloat(item.custo_total_compra) || 0,
            promocao: Boolean(item.em_promocao),
            optimized: true,
            available: true
          };
        });

        const { error: itemsError } = await this.supabase
          .from('shopping_list_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Erro ao salvar itens:', itemsError);
        } else {
          console.log(`💾 ${itemsToInsert.length} itens salvos no banco`);
        }
      }
      
      const resultado = {
        success: true,
        shopping_list_id: shoppingList.id,
        lista_compras: {
          total_itens: listaCompras.length,
          custo_total: custoTotal.toFixed(2),
          itens_promocao: itensPromocao,
          economia_promocoes: economiaPromocoes.toFixed(2),
          
          itens: listaCompras,
          itens_por_categoria: listaAgrupada,
          ingredientes_nao_encontrados: ingredientesNaoEncontrados,
          
          resumo_orcamento: {
            orcamento_previsto: budgetPredicted || 0,
            custo_real: custoTotal,
            diferenca: (budgetPredicted || 0) - custoTotal,
            status_orcamento: custoTotal <= (budgetPredicted || 0) ? 'dentro_limite' : 'acima_limite'
          },
          
          observacoes: {
            menu_id: menuId,
            cliente: clientName,
            porcoes_por_dia: servingsPerDay,
            data_geracao: new Date().toISOString(),
            metodo: 'consolidacao_corrigida_v2'
          }
        }
      };
      
      console.log(`✅ Lista gerada: ${listaCompras.length} itens, R$ ${custoTotal.toFixed(2)}`);
      console.log(`⚠️ ${ingredientesNaoEncontrados.length} ingredientes não encontrados`);
      
      return resultado;
      
    } catch (error) {
      console.error('❌ Erro na geração da lista:', error);
      throw error;
    }
  }

  consolidarIngredientes(ingredientesReceitas: any[], servingsPerDay: number) {
    const consolidados = new Map();
    
    for (const ingrediente of ingredientesReceitas) {
      try {
        // Validar dados básicos
        if (!ingrediente.produto_base_id || 
            !ingrediente.quantidade || 
            !ingrediente.unidade ||
            ingrediente.quantidade <= 0) {
          console.warn(`⚠️ Ingrediente inválido ignorado:`, {
            nome: ingrediente.produto_base_descricao,
            quantidade: ingrediente.quantidade,
            unidade: ingrediente.unidade,
            produto_id: ingrediente.produto_base_id
          });
          continue;
        }
        
        const produtoId = ingrediente.produto_base_id;
        const quantidadeBase = parseFloat(ingrediente.quantidade);
        const porcoeBase = parseInt(ingrediente.quantidade_refeicoes) || 100;
        const unidadeOriginal = ingrediente.unidade?.toUpperCase() || 'UN';
        
        // CALCULAR QUANTIDADE NECESSÁRIA
        const fatorEscala = servingsPerDay / porcoeBase;
        const quantidadeNecessaria = quantidadeBase * fatorEscala;
        
        // NORMALIZAR UNIDADE
        const unidadePadrao = this.normalizarUnidade(unidadeOriginal, quantidadeNecessaria);
        
        console.log(`📦 ${ingrediente.produto_base_descricao}:`);
        console.log(`  - Qtd base: ${quantidadeBase} ${unidadeOriginal} para ${porcoeBase} porções`);
        console.log(`  - Fator escala: ${fatorEscala.toFixed(3)}`);
        console.log(`  - Qtd necessária: ${quantidadeNecessaria.toFixed(3)} ${unidadeOriginal}`);
        console.log(`  - Unidade normalizada: ${unidadePadrao.quantidade.toFixed(3)} ${unidadePadrao.unidade}`);
        
        // CONSOLIDAR
        if (consolidados.has(produtoId)) {
          const existing = consolidados.get(produtoId);
          existing.quantidade_total += unidadePadrao.quantidade;
          existing.receitas.add(ingrediente.nome || 'Receita');
        } else {
          consolidados.set(produtoId, {
            produto_base_id: produtoId,
            nome: ingrediente.produto_base_descricao?.trim() || 'Ingrediente',
            quantidade_total: unidadePadrao.quantidade,
            unidade_padrao: unidadePadrao.unidade,
            receitas: new Set([ingrediente.nome || 'Receita'])
          });
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar ingrediente:`, ingrediente.produto_base_descricao, error);
      }
    }
    
    return consolidados;
  }

  normalizarUnidade(unidade: string, quantidade: number) {
    const unidadeUpper = unidade.toUpperCase();
    const conversao = this.CONVERSOES_UNIDADES[unidadeUpper];
    
    if (!conversao) {
      console.warn(`⚠️ Unidade não reconhecida: ${unidade}, usando como está`);
      return { quantidade: quantidade, unidade: unidade };
    }
    
    // Converter para unidade padrão
    if (conversao.tipo === 'peso') {
      return { 
        quantidade: quantidade * conversao.para_kg, 
        unidade: 'KG' 
      };
    } else if (conversao.tipo === 'volume') {
      return { 
        quantidade: quantidade * conversao.para_litro, 
        unidade: 'L' 
      };
    } else {
      return { 
        quantidade: quantidade, 
        unidade: 'UN' 
      };
    }
  }

  processarIngredienteParaCompra(ingrediente: any, produtosMercado: any[]) {
    // Buscar opções no mercado para este produto
    const opcoes = produtosMercado.filter(p => 
      p.produto_base_id === ingrediente.produto_base_id
    );
    
    if (opcoes.length === 0) {
      return { encontrado: false };
    }
    
    // Selecionar melhor opção (promoção ou mais barato)
    const melhorOpcao = opcoes.find(o => o.em_promocao_sim_nao) || opcoes[0];
    
    // Calcular quantidade para compra
    const qtdNecessaria = ingrediente.quantidade_total;
    const embalagem = parseFloat(melhorOpcao.produto_base_quantidade_embalagem) || 1;
    const somenteInteiro = melhorOpcao.apenas_valor_inteiro_sim_nao === true;
    const precoUnitario = parseFloat(melhorOpcao.preco);
    
    let qtdComprar, custoTotal, sobra = 0;
    
    if (somenteInteiro) {
      const embalagensPrecisas = Math.ceil(qtdNecessaria / embalagem);
      qtdComprar = embalagensPrecisas * embalagem;
      custoTotal = embalagensPrecisas * precoUnitario;
      sobra = qtdComprar - qtdNecessaria;
    } else {
      qtdComprar = qtdNecessaria;
      // Corrigido: preço unitário já é por embalagem, multiplicamos direto pela quantidade
      custoTotal = qtdNecessaria * precoUnitario;
    }
    
    // Economia em promoção (estimar 10%)
    const economiaPromocao = melhorOpcao.em_promocao_sim_nao ? custoTotal * 0.1 : 0;
    
    return {
      encontrado: true,
      item: {
        produto_base_id: ingrediente.produto_base_id,
        nome_ingrediente: ingrediente.nome,
        produto_mercado: melhorOpcao.descricao,
        quantidade_necessaria: qtdNecessaria.toFixed(3),
        quantidade_comprar: qtdComprar.toFixed(3),
        unidade: ingrediente.unidade_padrao,
        preco_unitario: (precoUnitario / embalagem).toFixed(2), // Preço por unidade individual
        custo_total_compra: custoTotal.toFixed(2),
        sobra: sobra.toFixed(3),
        percentual_sobra: qtdComprar > 0 ? ((sobra / qtdComprar) * 100).toFixed(1) : '0.0',
        em_promocao: melhorOpcao.em_promocao_sim_nao || false,
        economia_promocao: economiaPromocao.toFixed(2),
        receitas_usando: Array.from(ingrediente.receitas),
        categoria_estimada: this.estimarCategoria(ingrediente.nome)
      }
    };
  }

  agruparPorCategoria(itens: any[]) {
    const grupos = {};
    for (const item of itens) {
      const categoria = item.categoria_estimada;
      if (!grupos[categoria]) grupos[categoria] = [];
      grupos[categoria].push(item);
    }
    return grupos;
  }

  estimarCategoria(nome: string) {
    const nomeUpper = nome.toUpperCase();
    
    if (nomeUpper.includes('ARROZ') || nomeUpper.includes('FEIJAO')) return 'GRÃOS E CEREAIS';
    if (nomeUpper.includes('CARNE') || nomeUpper.includes('FRANGO')) return 'PROTEÍNAS';
    if (nomeUpper.includes('OLEO') || nomeUpper.includes('MARGARINA')) return 'ÓLEOS E GORDURAS';
    if (nomeUpper.includes('TOMATE') || nomeUpper.includes('CEBOLA') || nomeUpper.includes('PEPINO')) return 'VEGETAIS';
    if (nomeUpper.includes('SAL') || nomeUpper.includes('TEMPERO')) return 'TEMPEROS E CONDIMENTOS';
    if (nomeUpper.includes('LEITE') || nomeUpper.includes('QUEIJO')) return 'LATICÍNIOS';
    if (nomeUpper.includes('AGUA') || nomeUpper.includes('SUCO')) return 'BEBIDAS';
    
    return 'DIVERSOS';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== INICIANDO GERAÇÃO DE LISTA CORRIGIDA ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // PARSE DA REQUISIÇÃO
    const { menuId, clientName, budgetPredicted = 0, servingsPerDay = 50 } = await req.json();

    // Validação de entrada
    if (!menuId || !clientName) {
      throw new Error('menuId e clientName são obrigatórios');
    }

    console.log('🛒 Gerando lista corrigida para cardápio:', menuId);
    console.log('👤 Cliente:', clientName, '💰 Orçamento:', budgetPredicted, '🍽️ Porções/dia:', servingsPerDay);

    // USAR A NOVA CLASSE CORRIGIDA
    const generator = new ShoppingListGeneratorFixed(supabase);
    const resultado = await generator.gerarListaComprasCorrigida(menuId, clientName, budgetPredicted, servingsPerDay);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na geração da lista:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});