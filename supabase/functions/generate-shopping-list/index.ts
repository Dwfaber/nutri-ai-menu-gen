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
      // PASSO 1: Buscar cardápio
      const { data: menuData, error: menuError } = await this.supabase
        .from('generated_menus')
        .select('*')
        .eq('id', menuId)
        .maybeSingle();

      if (menuError || !menuData) {
        throw new Error(`Cardápio não encontrado: ${menuId}`);
      }

      console.log(`📦 Cardápio encontrado: ${menuData.client_name} - ${menuData.receitas_adaptadas?.length || 0} receitas`);

      // PASSO 2: Buscar ingredientes das receitas
      const receitasAdaptadas = menuData.receitas_adaptadas || [];
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
        const itemsToInsert = listaCompras.map(item => ({
          shopping_list_id: shoppingList.id,
          product_id_legado: item.produto_base_id.toString(),
          product_name: item.nome_ingrediente,
          category: item.categoria_estimada,
          quantity: parseFloat(item.quantidade_comprar),
          unit: item.unidade,
          unit_price: parseFloat(item.preco_unitario || '0'),
          total_price: parseFloat(item.custo_total_compra),
          promocao: item.em_promocao,
          optimized: true,
          available: true
        }));

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
      custoTotal = qtdNecessaria * (precoUnitario / embalagem);
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
        preco_unitario: precoUnitario.toFixed(2),
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

// INTERFACES PARA COMPATIBILIDADE
interface PackagingOption {
  produto_id: any;
  descricao: string;
  quantidade_embalagem: number;
  preco: number;
  apenas_valor_inteiro: boolean;
  em_promocao: boolean;
  disponivel?: boolean;
  unidade: string;
}

// VALIDAÇÃO RIGOROSA CORRIGIDA
function validateIngredientData(ingredient: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validações críticas
  if (!ingredient.produto_base_id || ingredient.produto_base_id <= 0) {
    errors.push('produto_base_id inválido ou ausente');
  }
  
  if (!ingredient.quantidade_total || ingredient.quantidade_total <= 0) {
    errors.push('quantidade_total inválida ou zero');
  }
  
  if (!ingredient.unidade || ingredient.unidade.trim() === '') {
    errors.push('unidade não especificada');
  }
  
  // Validações de warning
  if (ingredient.quantidade_total > 10000) {
    warnings.push('quantidade muito alta - verificar unidade');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// CONVERSÃO DE UNIDADES EXPANDIDA
function convertUnits(quantidade: number, unidadeOrigem: string, unidadeDestino: string): number {
  const origem = unidadeOrigem?.toUpperCase() || 'GR';
  const destino = unidadeDestino?.toUpperCase() || 'GR';
  
  if (origem === destino) return quantidade;
  
  // Conversões de peso
  if (origem === 'GR' && destino === 'KG') return quantidade / 1000;
  if (origem === 'KG' && destino === 'GR') return quantidade * 1000;
  
  // Conversões de volume
  if (origem === 'ML' && destino === 'L') return quantidade / 1000;
  if (origem === 'L' && destino === 'ML') return quantidade * 1000;
  
  // Conversões especiais
  if (origem === 'UN' && destino === 'CX') return quantidade / 12; // 12 unidades por caixa
  if (origem === 'CX' && destino === 'UN') return quantidade * 12;
  if (origem === 'PCT' && destino === 'UN') return quantidade * 500; // 500g por pacote
  if (origem === 'DZ' && destino === 'UN') return quantidade * 12; // 12 unidades por dúzia
  
  console.warn(`Conversão não encontrada: ${origem} -> ${destino}`);
  return quantidade; // Sem conversão disponível
}

// Função para categorizar ingredientes automaticamente
function categorizarIngrediente(nomeIngrediente: string): string {
  const nome = nomeIngrediente.toUpperCase();
  
  // Proteínas
  if (nome.includes('FRANGO') || nome.includes('CARNE') || nome.includes('PEIXE') || 
      nome.includes('OVO') || nome.includes('LINGUIÇA') || nome.includes('SALSICHA')) {
    return 'PROTEÍNAS';
  }
  
  // Grãos e cereais
  if (nome.includes('ARROZ') || nome.includes('FEIJÃO') || nome.includes('MACARRÃO') || 
      nome.includes('FARINHA') || nome.includes('AVEIA') || nome.includes('CUSCUZ')) {
    return 'GRÃOS E CEREAIS';
  }
  
  // Vegetais
  if (nome.includes('TOMATE') || nome.includes('CEBOLA') || nome.includes('ALHO') || 
      nome.includes('CENOURA') || nome.includes('BATATA') || nome.includes('VERDURA')) {
    return 'VEGETAIS';
  }
  
  // Laticínios
  if (nome.includes('LEITE') || nome.includes('QUEIJO') || nome.includes('IOGURTE') || 
      nome.includes('REQUEIJÃO') || nome.includes('MANTEIGA')) {
    return 'LATICÍNIOS';
  }
  
  // Condimentos e temperos
  if (nome.includes('SAL') || nome.includes('AÇÚCAR') || nome.includes('ÓLEO') || 
      nome.includes('VINAGRE') || nome.includes('TEMPERO') || nome.includes('MOLHO')) {
    return 'CONDIMENTOS';
  }
  
  // Bebidas
  if (nome.includes('SUCO') || nome.includes('ÁGUA') || nome.includes('REFRIGERANTE')) {
    return 'BEBIDAS';
  }
  
  return 'OUTROS';
}

function calculateOptimalPackaging(quantidadeNecessaria: number, opcoes: PackagingOption[]): OptimizationResult {
  if (quantidadeNecessaria <= 0 || opcoes.length === 0) {
    throw new Error('Quantidade inválida ou sem opções de embalagem');
  }
  
  console.log(`Otimizando ${quantidadeNecessaria} unidades com ${opcoes.length} opções`);
  
  // Calcular eficiência (quantidade/preço) e ordenar
  const opcoesComEficiencia = opcoes
    .filter(opcao => opcao.preco > 0 && opcao.quantidade_embalagem > 0)
    .map(opcao => ({
      ...opcao,
      eficiencia: opcao.quantidade_embalagem / opcao.preco,
      preco_por_unidade: opcao.preco / opcao.quantidade_embalagem
    }))
    .sort((a, b) => {
      // Priorizar promoções
      if (a.em_promocao && !b.em_promocao) return -1;
      if (!a.em_promocao && b.em_promocao) return 1;
      // Depois menor preço por unidade
      return a.preco_por_unidade - b.preco_por_unidade;
    });
  
  let quantidadeRestante = quantidadeNecessaria;
  const opcoesSelecionadas = [];
  let custoTotal = 0;
  
  for (const opcao of opcoesComEficiencia) {
    if (quantidadeRestante <= 0) break;
    
    // Calcular quantos pacotes desta opção usar
    let quantidadePacotes = Math.floor(quantidadeRestante / opcao.quantidade_embalagem);
    
    // Se apenas valor inteiro e ainda sobra quantidade
    if (opcao.apenas_valor_inteiro && quantidadeRestante % opcao.quantidade_embalagem > 0) {
      quantidadePacotes += 1;
    }
    
    if (quantidadePacotes > 0) {
      const quantidadeTotal = quantidadePacotes * opcao.quantidade_embalagem;
      const custoOpcao = quantidadePacotes * opcao.preco;
      
      opcoesSelecionadas.push({
        produto_id: opcao.produto_id,
        descricao: opcao.descricao,
        quantidade_pacotes: quantidadePacotes,
        quantidade_total: quantidadeTotal,
        custo_total: custoOpcao,
        eficiencia: opcao.eficiencia,
        motivo_selecao: opcao.em_promocao ? 'Promoção' : 'Melhor preço'
      });
      
      quantidadeRestante -= quantidadeTotal;
      custoTotal += custoOpcao;
    }
  }
  
  // Se ainda sobra quantidade, usar a opção mais eficiente
  if (quantidadeRestante > 0 && opcoesComEficiencia.length > 0) {
    const melhorOpcao = opcoesComEficiencia[0];
    const pacotesAdicionais = Math.ceil(quantidadeRestante / melhorOpcao.quantidade_embalagem);
    
    const opcaoExistente = opcoesSelecionadas.find(o => o.produto_id === melhorOpcao.produto_id);
    if (opcaoExistente) {
      opcaoExistente.quantidade_pacotes += pacotesAdicionais;
      opcaoExistente.quantidade_total += pacotesAdicionais * melhorOpcao.quantidade_embalagem;
      opcaoExistente.custo_total += pacotesAdicionais * melhorOpcao.preco;
    } else {
      opcoesSelecionadas.push({
        produto_id: melhorOpcao.produto_id,
        descricao: melhorOpcao.descricao,
        quantidade_pacotes: pacotesAdicionais,
        quantidade_total: pacotesAdicionais * melhorOpcao.quantidade_embalagem,
        custo_total: pacotesAdicionais * melhorOpcao.preco,
        eficiencia: melhorOpcao.eficiencia,
        motivo_selecao: 'Completar quantidade necessária'
      });
    }
    
    custoTotal += pacotesAdicionais * melhorOpcao.preco;
  }
  
  const quantidadeFinal = opcoesSelecionadas.reduce((sum, o) => sum + o.quantidade_total, 0);
  const desperdicio = Math.max(0, quantidadeFinal - quantidadeNecessaria);
  const desperdicioPercentual = (desperdicio / quantidadeNecessaria) * 100;
  
  console.log(`Otimização concluída: ${opcoesSelecionadas.length} opções, desperdício: ${desperdicioPercentual.toFixed(1)}%`);
  
  return {
    opcoes_selecionadas: opcoesSelecionadas,
    quantidade_final: quantidadeFinal,
    custo_total: custoTotal,
    desperdicio,
    desperdicio_percentual: Math.round(desperdicioPercentual * 100) / 100
  };
}

interface OptimizationResult {
  opcoes_selecionadas: Array<{
    produto_id: any;
    descricao: string;
    quantidade_pacotes: number;
    quantidade_total: number;
    custo_total: number;
    eficiencia: number;
    motivo_selecao: string;
  }>;
  quantidade_final: number;
  custo_total: number;
  desperdicio: number;
  desperdicio_percentual: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
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
      supabase
        .from('generated_menus')
        .select('*')
        .eq('id', menuId)
        .maybeSingle(),
      supabase
        .from('co_solicitacao_produto_listagem')
        .select('solicitacao_id')
        .order('solicitacao_id', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const { data: menuData, error: menuError } = menuResult;
    const { data: latestSolicitacao, error: solicitacaoError } = solicitacaoResult;

    if (menuError || !menuData) {
      console.error('Erro ao buscar cardápio:', menuError);
      throw new Error(`Cardápio não encontrado: ${menuId}`);
    }

    if (solicitacaoError || !latestSolicitacao) {
      console.error('Erro ao buscar última solicitação:', solicitacaoError);
      throw new Error('Nenhuma solicitação de produtos encontrada');
    }

    console.log('Cardápio encontrado:', {
      id: menuData.id,
      client_name: menuData.client_name,
      receitas_count: menuData.receitas_adaptadas?.length || 0
    });

    // Buscar produtos do mercado
    const { data: marketProducts, error: marketError } = await supabase
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .eq('solicitacao_id', latestSolicitacao.solicitacao_id);

    if (marketError || !marketProducts) {
      console.error('Erro ao buscar produtos do mercado:', marketError);
      throw new Error('Produtos do mercado não encontrados');
    }

    console.log(`Produtos do mercado carregados: ${marketProducts.length}`);

    // Processar receitas adaptadas do cardápio
    const receitasAdaptadas = menuData.receitas_adaptadas || [];
    if (!receitasAdaptadas.length) {
      throw new Error('Nenhuma receita encontrada no cardápio');
    }

    // Extrair IDs das receitas
    const recipeIds = receitasAdaptadas
      .map((r: any) => r.receita_id_legado)
      .filter(Boolean);

    if (!recipeIds.length) {
      throw new Error('Nenhum ID de receita válido encontrado');
    }

    console.log('IDs das receitas:', recipeIds);

    // Buscar ingredientes das receitas
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('receita_ingredientes')
      .select('*, produto_base_descricao')
      .in('receita_id_legado', recipeIds);

    if (ingredientsError) {
      console.error('Erro ao buscar ingredientes:', ingredientsError);
      throw new Error('Erro ao buscar ingredientes das receitas');
    }

    console.log(`Ingredientes carregados: ${ingredients?.length || 0}`);

    // Calcular multiplicador de porções
    const servingsMultiplier = servingsPerDay;
    console.log('Multiplicador de porções:', servingsMultiplier);

    // Consolidar ingredientes por produto_base_id
    const consolidatedIngredients = new Map();
    const warnings = []; // DECLARAR warnings ANTES do uso
    const ingredientesNaoEncontrados = [];
    const itensPorCategoria = {};

    // FASE 1: CORREÇÃO DA ESTRUTURA DE DADOS - SEPARAR PROCESSAMENTO
    // Processar receitas adaptadas (estrutura diferente de ingredientes)
    for (const receitaAdaptada of receitasAdaptadas) {
      // AQUI NÃO É INGREDIENTE, É RECEITA ADAPTADA
      console.log(`[RECEITA ADAPTADA] Processando receita: ${receitaAdaptada.nome_receita || receitaAdaptada.id}`);
      
      // Verificar se existe lista de ingredientes na receita adaptada
      const adaptedIngredients = receitaAdaptada.ingredientes || [];
      
      if (!Array.isArray(adaptedIngredients)) {
        console.warn(`Receita ${receitaAdaptada.nome_receita} sem ingredientes válidos`);
        continue;
      }
      
      for (const adaptedIng of adaptedIngredients) {
        const produtoBaseId = adaptedIng.produto_base_id;
        if (!produtoBaseId) {
          console.warn('Ingrediente sem produto_base_id:', adaptedIng);
          continue;
        }
        
        // VALIDAÇÃO RIGOROSA DO INGREDIENTE ADAPTADO
        const validation = validateIngredientData({
          produto_base_id: adaptedIng.produto_base_id,
          quantidade_total: adaptedIng.quantidade,
          unidade: adaptedIng.unidade
        });
        
        if (!validation.valid) {
          console.error(`Ingrediente inválido na receita adaptada:`, validation.errors);
          // warnings agora está declarado
          continue;
        }
        
        // CÁLCULO CORRIGIDO - EVITAR DIVISÃO POR ZERO
        const baseServing = Number(adaptedIng.quantidade_refeicoes || 100);
        if (baseServing <= 0) {
          console.error(`Base serving inválido para ingrediente ${adaptedIng.nome}: ${baseServing}`);
          continue;
        }
        
        const quantidadeNecessaria = (Number(adaptedIng.quantidade || 0) * servingsMultiplier) / baseServing;
        if (quantidadeNecessaria <= 0) continue;
        
        console.log(`[RECEITA ADAPTADA] Ingrediente: ${adaptedIng.produto_base_descricao || adaptedIng.nome}`);
        console.log(`- Qtd base: ${adaptedIng.quantidade} para ${baseServing} refeições`);
        console.log(`- Qtd necessária: ${quantidadeNecessaria} ${adaptedIng.unidade}`);

        // Consolidar no mapa
        if (!consolidatedIngredients.has(produtoBaseId)) {
          consolidatedIngredients.set(produtoBaseId, {
            produto_base_id: produtoBaseId,
            nome: adaptedIng.produto_base_descricao || adaptedIng.nome || 'Ingrediente não identificado',
            quantidade_total: 0,
            unidade: adaptedIng.unidade || 'GR',
            receitas: []
          });
        }

        const existingIngredient = consolidatedIngredients.get(produtoBaseId);
        existingIngredient.quantidade_total += quantidadeNecessaria;
        existingIngredient.receitas.push(receitaAdaptada.nome_receita || 'Receita adaptada');
      }
    }

    // PROCESSAR INGREDIENTES DAS RECEITAS LEGADO (SEPARADO DAS ADAPTADAS)
    // MOVER declaração de warnings para antes do uso
    
    if (ingredients && ingredients.length > 0) {
      for (const ingredient of ingredients) {
        // VALIDAÇÃO RIGOROSA DE INGREDIENTES LEGADO
        const validation = validateIngredientData({
          produto_base_id: ingredient.produto_base_id,
          quantidade_total: ingredient.quantidade,
          unidade: ingredient.unidade
        });
        
        if (!validation.valid) {
          console.error(`Ingrediente inválido ${ingredient.produto_base_descricao}:`, validation.errors);
          // warnings foi movido para antes do uso
          continue; // Pular ingrediente inválido mas continuar processamento
        }

        const produtoBaseId = Number(ingredient.produto_base_id);

        // CÁLCULO CORRIGIDO - EVITAR DIVISÃO POR ZERO
        const baseServing = Number(ingredient.quantidade_refeicoes || 100);
        if (baseServing <= 0) {
          console.error(`Base serving inválido para ingrediente ${ingredient.produto_base_descricao}: ${baseServing}`);
          // warnings agora está declarado
          continue;
        }
        
        const quantidadeNecessaria = (Number(ingredient.quantidade || 0) * servingsMultiplier) / baseServing;
        if (quantidadeNecessaria <= 0) {
          console.warn(`Quantidade necessária zero para ${ingredient.produto_base_descricao}`);
          continue;
        }
        
        console.log(`[INGREDIENTE LEGADO] ${ingredient.produto_base_descricao || ingredient.nome}`);
        console.log(`- Qtd base: ${ingredient.quantidade} ${ingredient.unidade} para ${baseServing} refeições`);
        console.log(`- Fator multiplicador: ${(servingsMultiplier / baseServing).toFixed(3)}`);
        console.log(`- Qtd necessária: ${quantidadeNecessaria.toFixed(2)} ${ingredient.unidade}`);

        // USAR CONVERSÃO DE UNIDADES SE NECESSÁRIO
        const ingredientUnit = ingredient.unidade?.toUpperCase() || 'GR';
        let finalQuantity = quantidadeNecessaria;
        
        // Aplicar conversões se necessário para padronizar
        if (ingredientUnit !== 'GR' && ingredientUnit !== 'KG' && ingredientUnit !== 'ML' && ingredientUnit !== 'L') {
          finalQuantity = convertUnits(quantidadeNecessaria, ingredientUnit, 'GR');
          console.log(`- Conversão aplicada: ${quantidadeNecessaria} ${ingredientUnit} -> ${finalQuantity} GR`);
        }

        // Consolidar no mapa
        if (!consolidatedIngredients.has(produtoBaseId)) {
          consolidatedIngredients.set(produtoBaseId, {
            produto_base_id: produtoBaseId,
            nome: ingredient.produto_base_descricao || ingredient.nome || 'Ingrediente não identificado',
            quantidade_total: 0,
            unidade: ingredient.unidade || 'GR',
            receitas: []
          });
        }

        const existingIngredient = consolidatedIngredients.get(produtoBaseId);
        existingIngredient.quantidade_total += finalQuantity;
        existingIngredient.receitas.push(ingredient.nome || 'Receita não identificada');
      }
    }
    
    // Log warnings para monitoramento
    if (warnings.length > 0) {
      console.warn('⚠️ Avisos durante processamento de ingredientes:', warnings);
    }

    console.log(`Ingredientes consolidados: ${consolidatedIngredients.size}`);

    // Gerar itens da lista de compras
    const shoppingItems = [];
    let totalCost = 0;

    for (const [produtoBaseId, consolidatedIngredient] of consolidatedIngredients) {
      console.log(`\n--- Processando ingrediente: ${consolidatedIngredient.nome} ---`);
      console.log(`Produto Base ID: ${produtoBaseId}`);
      console.log(`Quantidade total necessária: ${consolidatedIngredient.quantidade_total} ${consolidatedIngredient.unidade}`);

      // Buscar produtos do mercado para este produto_base_id
      const productOptions = marketProducts.filter(p => 
        Number(p.produto_base_id) === Number(produtoBaseId)
      );

      if (!productOptions.length) {
        console.log(`Nenhum produto encontrado no mercado para produto_base_id: ${produtoBaseId}`);
        // Adicionar à lista de ingredientes não encontrados
        ingredientesNaoEncontrados.push({
          nome: consolidatedIngredient.nome,
          quantidade: `${consolidatedIngredient.quantidade_total} ${consolidatedIngredient.unidade}`,
          receitas: consolidatedIngredient.receitas
        });
        continue;
      }

      console.log(`Opções de produto encontradas: ${productOptions.length}`);

      // Usar primeiro produto como referência
      const firstProduct = productOptions[0];

      try {
        // Otimização usando a função de cálculo
        const packageOptions = productOptions.map(prod => ({
          produto_id: prod.produto_id,
          produto_base_id: prod.produto_base_id,
          descricao: prod.descricao,
          quantidade_embalagem: prod.produto_base_quantidade_embalagem || 1000,
          unidade: prod.unidade,
          preco: prod.preco,
          preco_compra: prod.preco_compra || prod.preco,
          promocao: prod.em_promocao_sim_nao || false,
          em_promocao: prod.em_promocao_sim_nao || false,
          apenas_valor_inteiro: prod.apenas_valor_inteiro_sim_nao || false,
          disponivel: true
        }));

        const optimizationConfig = {
          prioridade_promocao: 'media',
          tolerancia_sobra_percentual: 15,
          preferir_produtos_integrais: false,
          maximo_tipos_embalagem_por_produto: 2,
          considerar_custo_compra: false
        };

        const optimizedPackaging = calculateOptimalPackaging(
          consolidatedIngredient.quantidade_total,
          packageOptions
        );

        if (optimizedPackaging.opcoes_selecionadas && optimizedPackaging.opcoes_selecionadas.length > 0) {
          console.log(`Otimização realizada: ${optimizedPackaging.opcoes_selecionadas.length} seleções`);
          console.log(`Desperdício: ${optimizedPackaging.desperdicio_percentual}%`);
          
          for (const selection of optimizedPackaging.opcoes_selecionadas) {
            const produto = packageOptions.find(p => p.produto_id === selection.produto_id);
            const categoria = categorizarIngrediente(consolidatedIngredient.nome);
            
            const item = {
              product_id_legado: String(selection.produto_id),
              product_name: consolidatedIngredient.nome,
              category: categoria,
              quantity: selection.quantidade_pacotes,
              unit: firstProduct.unidade,
              unit_price: selection.custo_total / selection.quantidade_pacotes,
              total_price: selection.custo_total,
              available: true,
              promocao: produto?.em_promocao || false,
              optimized: true,
              quantidade_necessaria: consolidatedIngredient.quantidade_total,
              quantidade_comprar: selection.quantidade_total,
              sobra: selection.quantidade_total - consolidatedIngredient.quantidade_total,
              percentual_sobra: ((selection.quantidade_total - consolidatedIngredient.quantidade_total) / consolidatedIngredient.quantidade_total * 100).toFixed(1),
              receitas_usando: consolidatedIngredient.receitas
            };
            
            shoppingItems.push(item);
            
            // Agrupar por categoria
            if (!itensPorCategoria[categoria]) {
              itensPorCategoria[categoria] = [];
            }
            itensPorCategoria[categoria].push(item);
            
            totalCost += selection.custo_total;
          }
        } else {
          console.log('Falha na otimização, usando cálculo simples');
          
          // Calcular preço total corrigido com conversão de unidades
          let finalUnitPrice = firstProduct.preco || 0;
          let finalQuantity = consolidatedIngredient.quantidade_total;
          
          // Se o produto tem quantidade de embalagem diferente da unidade base, ajustar preço
          const packageQuantity = firstProduct.produto_base_quantidade_embalagem || 1000;
          const ingredientUnit = consolidatedIngredient.unidade?.toUpperCase() || 'GR';
          const productUnit = firstProduct.unidade?.toUpperCase() || 'GR';
          
          console.log(`Calculando preço para ${consolidatedIngredient.nome}:`);
          console.log(`- Quantidade necessária: ${consolidatedIngredient.quantidade_total} ${ingredientUnit}`);
          console.log(`- Produto: ${firstProduct.descricao}`);
          console.log(`- Preço da embalagem: R$ ${finalUnitPrice}`);
          console.log(`- Quantidade da embalagem: ${packageQuantity} ${productUnit}`);
          
          // Converter quantidade necessária para a mesma unidade da embalagem
          let quantidadeConvertida = finalQuantity;
          if (ingredientUnit === 'GR' && productUnit === 'KG') {
            quantidadeConvertida = finalQuantity / 1000; // converter gramas para kg
          } else if (ingredientUnit === 'ML' && productUnit === 'L') {
            quantidadeConvertida = finalQuantity / 1000; // converter ml para litros
          } else if (ingredientUnit === 'KG' && productUnit === 'GR') {
            quantidadeConvertida = finalQuantity * 1000; // converter kg para gramas
          } else if (ingredientUnit === 'L' && productUnit === 'ML') {
            quantidadeConvertida = finalQuantity * 1000; // converter litros para ml
          }
          
          // Calcular quantas embalagens são necessárias
          const embalagensNecessarias = quantidadeConvertida / packageQuantity;
          const totalPrice = embalagensNecessarias * finalUnitPrice;
          
          console.log(`- Quantidade convertida: ${quantidadeConvertida} ${productUnit}`);
          console.log(`- Embalagens necessárias: ${embalagensNecessarias.toFixed(4)}`);
          console.log(`- Preço total: R$ ${totalPrice.toFixed(2)}`);

          const categoria = categorizarIngrediente(consolidatedIngredient.nome);
          const quantidade_comprar = Math.ceil(embalagensNecessarias) * packageQuantity;
          
          const item = {
            product_id_legado: String(firstProduct.produto_id),
            product_name: consolidatedIngredient.nome,
            category: categoria,
            quantity: Math.ceil(embalagensNecessarias),
            unit: firstProduct.unidade,
            unit_price: finalUnitPrice,
            total_price: totalPrice,
            available: true,
            promocao: firstProduct.em_promocao_sim_nao || false,
            optimized: false,
            quantidade_necessaria: consolidatedIngredient.quantidade_total,
            quantidade_comprar: quantidade_comprar,
            sobra: quantidade_comprar - consolidatedIngredient.quantidade_total,
            percentual_sobra: ((quantidade_comprar - consolidatedIngredient.quantidade_total) / consolidatedIngredient.quantidade_total * 100).toFixed(1),
            receitas_usando: consolidatedIngredient.receitas
          };
          
          shoppingItems.push(item);
          
          // Agrupar por categoria
          if (!itensPorCategoria[categoria]) {
            itensPorCategoria[categoria] = [];
          }
          itensPorCategoria[categoria].push(item);
          
          totalCost += totalPrice;
        }
      } catch (error) {
        console.error(`Erro ao processar ingrediente ${consolidatedIngredient.nome}:`, error);
        continue;
      }
    }

    console.log(`\n=== RESUMO ===`);
    console.log(`Total de itens: ${shoppingItems.length}`);
    console.log(`Custo total: R$ ${totalCost.toFixed(2)}`);

    // Determinar status do orçamento
    const budgetStatus = totalCost <= budgetPredicted ? 'within_budget' : 'over_budget';

    // Criar lista de compras no banco
    const { data: shoppingList, error: listError } = await supabase
      .from('shopping_lists')
      .insert({
        menu_id: menuId,
        client_name: clientName,
        budget_predicted: budgetPredicted,
        cost_actual: totalCost,
        status: budgetStatus
      })
      .select('id')
      .maybeSingle();

    if (listError) {
      console.error('Erro ao criar lista de compras:', listError);
      throw new Error('Erro ao salvar lista de compras');
    }

    // Inserir itens da lista
    if (shoppingItems.length > 0) {
      const itemsToInsert = shoppingItems.map(item => ({
        ...item,
        shopping_list_id: shoppingList.id
      }));

      const { error: itemsError } = await supabase
        .from('shopping_list_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Erro ao inserir itens:', itemsError);
        throw new Error('Erro ao salvar itens da lista');
      }
    }

    // Calcular estatísticas de promoção
    const itensPromocao = shoppingItems.filter(item => item.promocao);
    const economiaPromocoes = itensPromocao.reduce((acc, item) => {
      // Estimativa de 10-15% de economia em promoções
      return acc + (item.total_price * 0.12);
    }, 0);

    const response = {
      success: true,
      shopping_list_id: shoppingList.id,
      lista_compras: {
        total_itens: shoppingItems.length,
        custo_total: totalCost.toFixed(2),
        itens_promocao: itensPromocao.length,
        economia_promocoes: economiaPromocoes.toFixed(2),
        
        itens: shoppingItems.map(item => ({
          nome_ingrediente: item.product_name,
          produto_mercado: item.product_name,
          quantidade_necessaria: item.quantidade_necessaria,
          quantidade_comprar: item.quantidade_comprar,
          custo_total_compra: item.total_price.toFixed(2),
          sobra: item.sobra.toFixed(2),
          percentual_sobra: item.percentual_sobra,
          em_promocao: item.promocao,
          receitas_usando: item.receitas_usando,
          categoria_estimada: item.category
        })),
        
        itens_por_categoria: itensPorCategoria,
        
        ingredientes_nao_encontrados: ingredientesNaoEncontrados
      },
      budget_status: budgetStatus,
      optimization_summary: {
        ingredients_processed: consolidatedIngredients.size,
        items_generated: shoppingItems.length,
        optimized_items: shoppingItems.filter(item => item.optimized).length
      }
    };

    console.log('=== LISTA DE COMPRAS GERADA COM SUCESSO ===');
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na geração da lista de compras:', error);
    
    // TRATAMENTO ROBUSTO DE ERROS COM ESTRUTURA PADRONIZADA
    const errorResponse = {
      success: false,
      error: error.message || 'Erro desconhecido',
      details: 'Erro interno na geração da lista de compras',
      timestamp: new Date().toISOString(),
      context: {
        menuId: req.body?.menuId || 'N/A',
        clientName: req.body?.clientName || 'N/A'
      }
    };

    // Log estruturado para debugging
    console.error('ERROR_DETAILS:', {
      timestamp: errorResponse.timestamp,
      error_type: error.constructor.name,
      error_message: error.message,
      stack_trace: error.stack,
      context: errorResponse.context
    });
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});