import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// ========================================
// CRITÉRIOS DE AUDITORIA INTEGRADOS
// Importados de constante compartilhada
// ========================================

// NOTE: Em produção, isso seria importado de src/constants/recipeValidationCriteria.ts
// Como Deno edge functions não podem importar do src/ diretamente, mantemos cópia aqui
const CRITERIOS_AVALIACAO = {
  'Prato Principal 1': {
    ingredientes_minimos: 4,
    custo_minimo: 0.80,
    custo_maximo: 5.00,
    ingredientes_obrigatorios: [
      'CARNE', 'FRANGO', 'PEIXE', 'PROTEÍNA', 'BIFE', 'FILÉ', 'COSTELA',
      'COSTELINHA', 'ACÉM', 'LAGARTO', 'CUPIM', 'RABADA', 'ALCATRA',
      'COXÃO', 'PERNIL', 'BISTECA', 'TULIPA', 'LOMBO', 'PEITO', 'COXA',
      'SOBRECOXA', 'COXINHA', 'ASA', 'MEDALHÃO', 'MERLUZA', 'TILÁPIA',
      'TOSCANA', 'CALABRESA', 'BACON', 'LINGUIÇA', 'SALSICHA',
      'ROCAMBOLE', 'ESPETINHO', 'FEIJOADA', 'ISCA', 'ISCAS', 'TIRAS',
      'ALMÔNDEGAS', 'ALMONDEGAS', 'HAMBÚRGUER', 'HAMBURGUER', 'NUGGET', 'OVO'
    ],
    tipos_problematicos: ['SAL', 'TEMPERO', 'ÁGUA']
  },
  'Prato Principal 2': {
    ingredientes_minimos: 4,
    custo_minimo: 0.80,
    custo_maximo: 5.00,
    ingredientes_obrigatorios: [
      'CARNE', 'FRANGO', 'PEIXE', 'PROTEÍNA', 'BIFE', 'FILÉ', 'COSTELA',
      'COSTELINHA', 'ACÉM', 'LAGARTO', 'CUPIM', 'RABADA', 'ALCATRA',
      'PERNIL', 'BISTECA', 'TULIPA', 'LOMBO', 'PEITO', 'COXA',
      'SOBRECOXA', 'COXINHA', 'ASA', 'MEDALHÃO', 'MERLUZA', 'TILÁPIA',
      'TOSCANA', 'CALABRESA', 'BACON', 'LINGUIÇA', 'SALSICHA',
      'ROCAMBOLE', 'ESPETINHO', 'FEIJOADA', 'ISCA', 'ISCAS', 'TIRAS',
      'CARNE MOÍDA', 'MOÍDA', 'ALMÔNDEGAS', 'ALMONDEGAS', 'HAMBÚRGUER',
      'HAMBURGUER', 'NUGGET', 'OVO', 'RAVIOLI', 'LASANHA', 'CANELONE',
      'RONDELLI', 'NHOQUE', 'PANQUECA', 'PASTEL', 'TORTA', 'EMPADÃO'
    ],
    tipos_problematicos: ['SAL', 'TEMPERO', 'ÁGUA']
  },
  'Guarnição': {
    ingredientes_minimos: 3,
    custo_minimo: 0.10,
    custo_maximo: 2.00,
    ingredientes_obrigatorios: [
      'BATATA', 'CENOURA', 'ABOBRINHA', 'FARINHA', 'ARROZ', 
      'MACARRÃO', 'MANDIOCA', 'COUVE', 'REPOLHO', 'MILHO',
      'CHUCHU', 'BRÓCOLIS', 'VAGEM', 'POLENTA', 'FAROFA',
      'PURÊ', 'CREME', 'GRATINADO', 'REFOGADO', 'NHOQUE'
    ],
    tipos_problematicos: ['CARNE', 'FRANGO', 'PEIXE', 'PORCO']
  },
  'Salada 1': {
    ingredientes_minimos: 1,
    custo_minimo: 0.02,
    custo_maximo: 1.50,
    ingredientes_obrigatorios: [
      'REPOLHO', 'ACELGA', 'ALFACE', 'COUVE', 'ALMEIRÃO', 'CHICÓRIA',
      'ESCAROLA', 'RÚCULA', 'RUCULA', 'AGRIÃO', 'FOLHA', 'VERDURA'
    ],
    tipos_problematicos: []
  },
  'Salada 2': {
    ingredientes_minimos: 2,
    custo_minimo: 0.02,
    custo_maximo: 2.00,
    ingredientes_obrigatorios: [
      'CENOURA', 'TOMATE', 'BATATA', 'PEPINO', 'ABOBRINHA',
      'MILHO', 'CHUCHU', 'BETERRABA', 'VAGEM', 'BRÓCOLIS',
      'RABANETE', 'VINAGRETE', 'MAIONESE', 'TABULE', 'BERINJELA'
    ],
    tipos_problematicos: []
  },
  'Sobremesa': {
    ingredientes_minimos: 2,
    custo_minimo: 0.05,
    custo_maximo: 15.00,
    ingredientes_obrigatorios: [
      'AÇÚCAR', 'LEITE', 'FARINHA', 'CHOCOLATE', 'FRUTA', 'OVO', 'MANTEIGA',
      'CREME', 'ABACAXI', 'MORANGO', 'PAPAIA', 'UVA', 'COCO', 'AMENDOIM',
      'BANANA', 'LARANJA', 'PAVÊ', 'PAVE', 'MOUSSE', 'PUDIM', 'BRIGADEIRO',
      'GELATINA', 'FLAN', 'SAGU', 'CANJICA', 'BOLO', 'ARROZ DOCE', 'DOCE'
    ],
    tipos_problematicos: []
  },
  'Suco 1': {
    ingredientes_minimos: 1,
    custo_minimo: 0.01,
    custo_maximo: 0.10,
    percentual_minimo_calculado: 40,
    ingredientes_obrigatorios: ['SUCO', 'PÓ', 'POLPA', 'FRUTA', 'CONCENTRADO', 'REFRESCO'],
    tipos_problematicos: []
  },
  'Suco 2': {
    ingredientes_minimos: 1,
    custo_minimo: 0.01,
    custo_maximo: 0.10,
    percentual_minimo_calculado: 40,
    ingredientes_obrigatorios: ['SUCO', 'PÓ', 'POLPA', 'FRUTA', 'CONCENTRADO', 'REFRESCO'],
    tipos_problematicos: []
  },
  'Desjejum': {
    ingredientes_minimos: 2,
    custo_minimo: 0.15,
    custo_maximo: 4.00,
    ingredientes_obrigatorios: [
      'PÃO', 'PÃES', 'TORRADA', 'BISCOITO', 'CEREAL', 'AVEIA', 'GRANOLA',
      'TAPIOCA', 'CUSCUZ', 'FLOCOS', 'OVO', 'OVOS', 'PRESUNTO', 'MORTADELA',
      'QUEIJO', 'REQUEIJÃO', 'LEITE', 'IOGURTE', 'COALHADA', 'MANTEIGA',
      'MARGARINA', 'CAFÉ', 'CHÁ', 'CHOCOLATE', 'ACHOCOLATADO', 'BANANA',
      'MAMÃO', 'LARANJA', 'MAÇÃ', 'FRUTAS', 'MEL', 'GELEIA', 'DOCE',
      'AÇÚCAR', 'MINGAU', 'PANQUECA', 'VITAMINA'
    ],
    tipos_problematicos: ['CORANTE', 'CONSERVANTE', 'ADITIVO']
  },
  'Bebidas': {
    ingredientes_minimos: 1,
    custo_minimo: 0.02,
    custo_maximo: 2.00,
    ingredientes_obrigatorios: [
      'ÁGUA', 'LEITE', 'SUCO', 'NÉCTAR', 'CAFÉ', 'CHÁ', 'CHOCOLATE',
      'ACHOCOLATADO', 'REFRIGERANTE', 'SODA', 'LIMONADA', 'LARANJADA',
      'ÁGUA DE COCO', 'TANG', 'FRESH', 'PÓ', 'CONCENTRADO', 'VITAMINA'
    ],
    tipos_problematicos: ['MUITO AÇÚCAR', 'EXCESSO CORANTE']
  },
  'Base': {
    ingredientes_minimos: 1,
    custo_minimo: 0.05,
    custo_maximo: 1.50,
    ingredientes_obrigatorios: [
      'MOLHO', 'CALDO', 'FUNDO', 'EXTRATO', 'CONCENTRADO', 'PASTA', 'PURÊ',
      'CREME', 'SOFRITO', 'REFOGADO', 'CEBOLA', 'ALHO', 'TEMPERO VERDE',
      'CHEIRO VERDE', 'CONSERVA', 'PICKLE', 'ANTEPASTO', 'MASSA', 'FARINHA'
    ],
    tipos_problematicos: []
  }
};

// ========================================
// SISTEMA DE SUCOS DISCRIMINADO POR TIPO
// ========================================

const TIPOS_SUCO_CONFIG = {
  'PRO_MIX': {
    nome_display: 'Pro Mix',
    categorias_busca: ['Suco 1', 'Suco 2'],
    filtro_nome: 'PRÓ MIX',
    custo_esperado: { min: 0.060, max: 0.090 },
    caracteristicas: 'Suco concentrado em pó, múltiplos sabores'
  },
  'VITA_SUCO': {
    nome_display: 'Vita Suco',
    categorias_busca: ['Suco 1', 'Suco 2'],
    filtro_nome: 'VITA SUCO',
    custo_esperado: { min: 0.010, max: 0.060 },
    caracteristicas: 'Suco em pó premium com vitaminas'
  },
  'NATURAL': {
    nome_display: 'Natural',
    categorias_busca: ['Bebidas'],
    filtro_categoria: 'Bebidas',
    custo_esperado: { min: 0.250, max: 0.800 },
    caracteristicas: 'Sucos naturais com frutas frescas'
  },
  'DIET': {
    nome_display: 'Diet',
    categorias_busca: ['Suco Diet'],
    filtro_categoria: 'Suco Diet',
    custo_esperado: { min: 0.015, max: 0.040 },
    caracteristicas: 'Sucos sem açúcar com adoçantes'
  }
};

// ========================================
// CONFIGURAÇÕES DO CARDÁPIO
// ========================================

const CATEGORIAS_CARDAPIO = [
  'Arroz',
  'Feijão',
  'Prato Principal 1',
  'Prato Principal 2',
  'Guarnição',
  'Salada 1',
  'Salada 2',
  'Suco 1',
  'Suco 2',
  'Sobremesa'
];

// Categorias Base sempre obrigatórias
const CATEGORIAS_BASE_FIXAS = [
  'CAFÉ CORTESIA',
  'KIT DESCARTÁVEIS',
  'KIT LIMPEZA',
  'KIT TEMPERO DE MESA',
  'MINI PILÃO PARA ACOMPANHAMENTO'
];

// Opções de arroz
const OPCOES_ARROZ = [
  { nome: 'ARROZ', custo: 0.64, sempre: true },
  { nome: 'ARROZ INTEGRAL', custo: 0.67, apenas_quando_solicitado: true }
];

// Opções de feijão
const OPCOES_FEIJAO = [
  { nome: 'FEIJÃO (SÓ CARIOCA)', custo: 0.46 },
  { nome: 'FEIJÃO MIX (CARIOCA + BANDINHA)', custo: 0.43 },
  { nome: 'FEIJÃO MIX (CARIOCA + BANDINHA) 50%', custo: 0.35 },
  { nome: 'FEIJÃO MIX COM CALABRESA (CARIOCA + BANDINHA)', custo: 0.60 },
  { nome: 'FEIJÃO MIX COM CALABRESA (CARIOCA + BANDINHA) 50%', custo: 0.58 }
];

// Receitas Base com custos fixos
const RECEITAS_FIXAS_BASE = {
  'CAFÉ CORTESIA': { custo: 0.12, ordem: 10 },
  'KIT DESCARTÁVEIS': { custo: 0.16, ordem: 11 },
  'KIT LIMPEZA': { custo: 0.05, ordem: 12 },
  'KIT TEMPERO DE MESA': { custo: 0.09, ordem: 13 },
  'MINI PILÃO PARA ACOMPANHAMENTO': { custo: 0.06, ordem: 14 }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Received request:', requestData);

    // ========================================
    // FUNÇÃO DE VALIDAÇÃO COM CRITÉRIOS DE AUDITORIA
    // ========================================

    function validarReceitaComCriterios(dadosReceita, categoria) {
      const criterios = CRITERIOS_AVALIACAO[categoria];
      if (!criterios) return { valida: true, motivo: 'Categoria sem critérios definidos' };

      const { custo_por_porcao, ingredientes_total, percentual_calculado, ingredientes } = dadosReceita;

      // 1. Verificar número mínimo de ingredientes
      if (ingredientes_total < criterios.ingredientes_minimos) {
        return {
          valida: false,
          motivo: `Poucos ingredientes: ${ingredientes_total}/${criterios.ingredientes_minimos} mínimo`,
          severidade: 'ALTA'
        };
      }

      // 2. Verificar faixa de custo
      if (custo_por_porcao < criterios.custo_minimo) {
        return {
          valida: false,
          motivo: `Custo muito baixo: R$ ${custo_por_porcao.toFixed(2)} (mínimo R$ ${criterios.custo_minimo.toFixed(2)})`,
          severidade: 'ALTA'
        };
      }

      if (custo_por_porcao > criterios.custo_maximo) {
        return {
          valida: false,
          motivo: `Custo muito alto: R$ ${custo_por_porcao.toFixed(2)} (máximo R$ ${criterios.custo_maximo.toFixed(2)})`,
          severidade: 'MEDIA'
        };
      }

      // 3. Verificar percentual de ingredientes calculados (com correção para sucos)
      const percentualMinimo = criterios.percentual_minimo_calculado || 60; // Reduzido de 70% para 60%
      if (percentual_calculado < percentualMinimo) {
        return {
          valida: false,
          motivo: `Muitos ingredientes sem preço: ${percentual_calculado.toFixed(1)}% calculado (mínimo ${percentualMinimo}%)`,
          severidade: 'MEDIA'
        };
      }

      // 4. Verificar ingredientes obrigatórios (relaxado para warning)
      if (criterios.ingredientes_obrigatorios.length > 0) {
        const temIngredienteObrigatorio = ingredientes?.some(ing =>
          criterios.ingredientes_obrigatorios.some(obrig =>
            ing.nome.toUpperCase().includes(obrig.toUpperCase())
          )
        );

        if (!temIngredienteObrigatorio) {
          // Apenas warning, não bloqueia mais
          console.log(`⚠️ Recomendado: Adicionar ingrediente principal para ${categoria}`);
        }
      }

      // 5. Verificar ingredientes problemáticos
      if (criterios.tipos_problematicos.length > 0 && ingredientes_detalhes) {
        const apenasIngredientesProblematicos = ingredientes_detalhes.every(ing =>
          criterios.tipos_problematicos.some(prob =>
            ing.nome.toUpperCase().includes(prob.toUpperCase())
          )
        );

        if (apenasIngredientesProblematicos) {
          return {
            valida: false,
            motivo: 'Receita contém apenas temperos/condimentos básicos',
            severidade: 'ALTA'
          };
        }
      }

      return { valida: true, motivo: 'Receita atende aos critérios de qualidade' };
    }

    // ========================================
    // FUNÇÃO MELHORADA DE CÁLCULO DE CUSTO
    // ========================================

    async function calcularCustoReceita(receitaId, porcoes = 100) {
      console.log(`Calculando custo da receita ${receitaId} para ${porcoes} porções`);

      // 1. Buscar ingredientes da receita
      const { data: ingredientes, error: errorIngredientes } = await supabase
        .from('receita_ingredientes')
        .select('*')
        .eq('receita_id_legado', receitaId);

      if (errorIngredientes || !ingredientes?.length) {
        console.log(`Receita ${receitaId}: sem ingredientes válidos`);
        return null;
      }

      const nomeReceita = ingredientes[0].nome;
      const categoria = ingredientes[0].categoria_descricao;

      // 2. Filtrar ingredientes problemáticos
      const ingredientesLimpos = ingredientes.filter(ing => {
        const descricao = ing.produto_base_descricao || '';
        // Remover carne de 1ª e arroz emergência
        if (descricao.includes('CARNE') && descricao.includes('1ª')) return false;
        if (ing.produto_base_id === 38) return false;
        // Ignorar AGUA NATURAL no cálculo de percentual
        if (descricao.toUpperCase().includes('AGUA')) return false;
        return true;
      });

      console.log(`Ingredientes: ${ingredientes.length} → ${ingredientesLimpos.length} (após filtro)`);

      // 3. Buscar preços (incluindo quantidade de embalagem)
      const produtoIds = [...new Set(ingredientesLimpos.map(ing => ing.produto_base_id))];
      const { data: precos, error: errorPrecos } = await supabase
        .from('co_solicitacao_produto_listagem')
        .select('produto_base_id, preco, descricao, produto_base_quantidade_embalagem')
        .in('produto_base_id', produtoIds)
        .gt('preco', 0);

      if (errorPrecos || !precos?.length) {
        console.error(`Erro ao buscar preços para receita ${receitaId}`);
        return null;
      }
      
      // Guardar referência aos preços detalhados para usar depois
      const precosDetalhados = precos;

      // 4. Calcular preços médios normalizados
      const precosNormalizados = new Map();
      for (const produtoId of produtoIds) {
        const precosDesteProduto = precos.filter(p => p.produto_base_id === produtoId);
        if (precosDesteProduto.length === 0) continue;

        const precosKg = [];
        for (const produto of precosDesteProduto) {
          const descricao = produto.descricao || '';
          let pesoKg = 1;

          // Produtos por unidade
          if (descricao.match(/copo|prato|talher|guardanapo|saco|embalagem/i)) {
            precosKg.push(produto.preco);
            continue;
          }

          // Extrair peso da descrição
          const matchKg = descricao.match(/(\d+(?:[.,]\d+)?)\s*KG/i);
          const matchGr = descricao.match(/(\d+(?:[.,]\d+)?)\s*G(?:R|RAMA)?(?:\s|$|-)(?!\s*\()/i);
          const matchMl = descricao.match(/(\d+(?:[.,]\d+)?)\s*ML/i);
          const matchL = descricao.match(/(\d+(?:[.,]\d+)?(?:\.\d+)?)\s*L(?:T|ITRO)?(?:S)?(?:\s|$)/i);

          if (matchKg) {
            pesoKg = parseFloat(matchKg[1].replace(',', '.'));
          } else if (matchGr) {
            let gramas = parseFloat(matchGr[1].replace(',', '.'));
            if (gramas < 1) gramas = gramas * 1000;
            pesoKg = gramas / 1000;
          } else if (matchL) {
            pesoKg = parseFloat(matchL[1].replace(',', '.'));
          } else if (matchMl) {
            pesoKg = parseFloat(matchMl[1].replace(',', '.')) / 1000;
          }

          if (pesoKg <= 0) pesoKg = 1;
          precosKg.push(produto.preco / pesoKg);
        }

        if (precosKg.length > 0) {
          const media = precosKg.reduce((a, b) => a + b, 0) / precosKg.length;
          precosNormalizados.set(produtoId, media);
        }
      }

      // 5. Calcular custo total
      let custoTotal = 0;
      let ingredientesComPreco = 0;
      const ingredientesDetalhados = [];

      for (const ingrediente of ingredientesLimpos) {
        const precoMedio = precosNormalizados.get(ingrediente.produto_base_id);
        
        // Pular ingredientes sem preço (ex: água)
        if (!precoMedio || precoMedio <= 0) {
          console.log(`⚠️ Ingrediente ${ingrediente.produto_base_descricao} sem preço válido - atribuindo custo R$ 0.00`);
          ingredientesDetalhados.push({
            nome: ingrediente.produto_base_descricao,
            produto_base_id: ingrediente.produto_base_id,
            quantidade: ingrediente.quantidade,
            unidade: ingrediente.unidade,
            preco_unitario: 0,
            custo_ingrediente: 0,
            custo_por_porcao: 0,
            correcao_aplicada: 'Sem preço disponível'
          });
          continue;
        }

        let quantidadeNormalizada = ingrediente.quantidade;
        let unidadeNormalizada = ingrediente.unidade;
        let correcaoAplicada = null;

        // CORREÇÃO ÓLEO DE SOJA (produto_base_id = 246)
        if (ingrediente.produto_base_id === 246 && unidadeNormalizada === 'UND') {
          console.log(`Correção ÓLEO DE SOJA: ${ingrediente.quantidade} UND → ${ingrediente.quantidade} ML`);
          quantidadeNormalizada = ingrediente.quantidade;
          unidadeNormalizada = 'ML';
          correcaoAplicada = 'UND → ML';
        }
        // CORREÇÃO VITA SUCO UVA (produto_base_id = 325)
        else if (ingrediente.produto_base_id === 325) {
          const custoCorretoTotal = (165 / 250) * 8.90; // R$ 5,87
          const custoCorretoPorPorcao = custoCorretoTotal / 100; // R$ 0,0587
          quantidadeNormalizada = custoCorretoPorPorcao / precoMedio;
          console.log(`Correção VITA SUCO UVA: custo ajustado para R$ ${custoCorretoPorPorcao.toFixed(4)}`);
          correcaoAplicada = 'Custo fixo ajustado';
        }
        // CORREÇÃO AUTOMÁTICA EXISTENTE
        else if (unidadeNormalizada === 'LT' && (quantidadeNormalizada === 500 || quantidadeNormalizada === 400)) {
          console.log(`Correção automática: ${ingrediente.produto_base_descricao} ${quantidadeNormalizada} LT → ${quantidadeNormalizada} ML`);
          unidadeNormalizada = 'ML';
          correcaoAplicada = 'LT → ML';
        }

        // Converter para kg/L
        if (unidadeNormalizada === 'G' || unidadeNormalizada === 'GR') {
          quantidadeNormalizada = ingrediente.quantidade / 1000;
        } else if (unidadeNormalizada === 'ML') {
          quantidadeNormalizada = quantidadeNormalizada / 1000;
        } else if (unidadeNormalizada === 'UND') {
          const nomeIng = ingrediente.produto_base_descricao?.toUpperCase() || '';
          
          // Buscar quantidade de embalagem do produto
          const produtoInfo = precosDetalhados.find(p => p.produto_base_id === ingrediente.produto_base_id);
          const qtdEmbalagem = produtoInfo?.produto_base_quantidade_embalagem || 1;
          
          const ehDescartavel = nomeIng.includes('COPO') || 
                                nomeIng.includes('TAMPA') || 
                                nomeIng.includes('GUARDANAPO') || 
                                nomeIng.includes('TALHER') || 
                                nomeIng.includes('PRATO') ||
                                nomeIng.includes('SACO') ||
                                nomeIng.includes('EMBALAGEM');
          
          if (ehDescartavel) {
            // Para descartáveis: quantidade é para 100 porções
            // Se receita pede 100 unidades, é 1 por porção
            // Preço médio já está por unidade individual
            quantidadeNormalizada = ingrediente.quantidade / 100;
            console.log(`CORREÇÃO DESCARTÁVEL: ${nomeIng} ${ingrediente.quantidade} UND para 100 porções → ${quantidadeNormalizada.toFixed(2)} UND por porção`);
          } else if (qtdEmbalagem > 1) {
            // Produto vendido em embalagem múltipla (ex: PAÇOCA C/ 100 UN)
            // Receita pede unidades individuais, mas preço é da embalagem completa
            // Exemplo: 40 paçocas ÷ 100 paçocas/embalagem = 0.4 embalagens para 100 porções
            quantidadeNormalizada = ingrediente.quantidade / qtdEmbalagem;
            console.log(`CORREÇÃO EMBALAGEM MÚLTIPLA: ${nomeIng} ${ingrediente.quantidade} UND (embalagem: ${qtdEmbalagem}) → ${(quantidadeNormalizada / 100).toFixed(4)} embalagens por porção`);
            correcaoAplicada = `Embalagem múltipla (${qtdEmbalagem} un)`;
          } else {
            // Outros produtos UND: quantidade direta
            quantidadeNormalizada = ingrediente.quantidade / 100;
          }
        } else if (unidadeNormalizada === 'FD') {
          // Fardo = ignorar por enquanto (produto problemático)
          console.log(`⚠️ PRODUTO EM FARDO IGNORADO: ${ingrediente.produto_base_descricao}`);
          continue;
        } else if (unidadeNormalizada === 'PCT' || unidadeNormalizada === 'PT' || unidadeNormalizada === 'MÇ') {
          // Pacote/Pote/Maço = 1 unidade para 100 porções
          quantidadeNormalizada = ingrediente.quantidade / 100;
          console.log(`CORREÇÃO ${unidadeNormalizada}: ${ingrediente.quantidade} → ${quantidadeNormalizada} por porção`);
        }

        // CORREÇÃO CRÍTICA: Dividir por porções ANTES de calcular custo
        const quantidadePorPorcao = quantidadeNormalizada / porcoes;
        const custoPorPorcao = quantidadePorPorcao * precoMedio;
        const custoIngrediente = custoPorPorcao; // Já é o custo por porção
        
        custoTotal += custoIngrediente;
        ingredientesComPreco++;

        // Logging detalhado
        console.log(`  ${ingrediente.produto_base_descricao}:`);
        console.log(`    Qtd total: ${quantidadeNormalizada.toFixed(4)} kg | Por porção: ${quantidadePorPorcao.toFixed(4)} kg`);
        console.log(`    Preço/kg: R$ ${precoMedio.toFixed(4)} | Custo ingrediente/porção: R$ ${custoPorPorcao.toFixed(4)}`);

        ingredientesDetalhados.push({
          nome: ingrediente.produto_base_descricao,
          produto_base_id: ingrediente.produto_base_id,
          quantidade: ingrediente.quantidade,
          unidade: ingrediente.unidade,
          preco_unitario: precoMedio,
          custo_ingrediente: custoIngrediente,
          custo_por_porcao: custoPorPorcao,
          correcao_aplicada: correcaoAplicada
        });
      }

      const percentualCalculado = (ingredientesComPreco / ingredientesLimpos.length) * 100;
      const custoPorPorcaoFinal = custoTotal; // custoTotal já é a soma dos custos por porção

      const resultado = {
        receita_id: receitaId,
        nome: nomeReceita,
        categoria: categoria,
        custo_total: custoTotal,
        custo_por_porcao: custoPorPorcaoFinal,
        porcoes: porcoes,
        ingredientes_total: ingredientesLimpos.length,
        ingredientes_originais: ingredientes.length,
        ingredientes_com_preco: ingredientesComPreco,
        percentual_calculado: percentualCalculado,
        ingredientes_removidos: ingredientes.length - ingredientesLimpos.length,
        ingredientes: ingredientesDetalhados
      };

      // NOVA VALIDAÇÃO COM CRITÉRIOS DE AUDITORIA
      const validacao = validarReceitaComCriterios(resultado, categoria);
      resultado.validacao = validacao;

      console.log(`${nomeReceita}: R$ ${resultado.custo_por_porcao.toFixed(2)} por porção - ${validacao.valida ? 'VÁLIDA' : `REJEITADA: ${validacao.motivo}`}`);

      return resultado;
    }

    // ========================================
    // SISTEMA DE SUCOS INTEGRADO
    // ========================================

    // Função para buscar sucos por tipo específico
    async function buscarSucosPorTipo(tipoSuco) {
      const config = TIPOS_SUCO_CONFIG[tipoSuco];
      if (!config) {
        throw new Error(`Tipo de suco inválido: ${tipoSuco}`);
      }

      console.log(`Buscando sucos do tipo: ${config.nome_display}`);
      
      let query = supabase
        .from('receita_ingredientes')
        .select('receita_id_legado, nome, categoria_descricao')
        .in('categoria_descricao', config.categorias_busca);

      // Aplicar filtro específico por nome se necessário
      if (config.filtro_nome) {
        // Para Pro Mix e Vita Suco, filtrar pelo nome
        const { data: receitas, error } = await query;
        
        if (error) {
          console.error(`Erro ao buscar receitas ${config.nome_display}:`, error);
          return [];
        }

        // Filtrar por nome e remover duplicatas
        const receitasFiltradas = receitas?.filter(receita => 
          receita.nome.toUpperCase().includes(config.filtro_nome)
        ) || [];

        const receitasUnicas = new Map();
        receitasFiltradas.forEach(receita => {
          if (!receitasUnicas.has(receita.receita_id_legado)) {
            receitasUnicas.set(receita.receita_id_legado, receita);
          }
        });

        return Array.from(receitasUnicas.values());
      } else {
        // Para Natural e Diet, usar apenas categoria
        const { data: receitas, error } = await query;
        
        if (error) {
          console.error(`Erro ao buscar receitas ${config.nome_display}:`, error);
          return [];
        }

        // Remover duplicatas
        const receitasUnicas = new Map();
        receitas?.forEach(receita => {
          if (!receitasUnicas.has(receita.receita_id_legado)) {
            receitasUnicas.set(receita.receita_id_legado, receita);
          }
        });

        return Array.from(receitasUnicas.values());
      }
    }

    // Função para selecionar sucos para cardápio baseado na escolha do usuário
    async function selecionarSucosParaCardapio(tipoEscolhido, tipoSecundario = null) {
      console.log(`Selecionando sucos: Primário=${tipoEscolhido}, Secundário=${tipoSecundario || 'mesmo tipo'}`);

      const suco1Opcoes = await buscarSucosPorTipo(tipoEscolhido);
      
      if (suco1Opcoes.length === 0) {
        throw new Error(`Nenhuma receita encontrada para ${TIPOS_SUCO_CONFIG[tipoEscolhido].nome_display}`);
      }

      // Seleção do Suco 1
      const suco1Selecionado = suco1Opcoes[Math.floor(Math.random() * suco1Opcoes.length)];

      // Seleção do Suco 2
      let suco2Selecionado;
      
      if (tipoSecundario && tipoSecundario !== tipoEscolhido) {
        // Caso especial: Diet + outro tipo
        const suco2Opcoes = await buscarSucosPorTipo(tipoSecundario);
        if (suco2Opcoes.length > 0) {
          suco2Selecionado = suco2Opcoes[Math.floor(Math.random() * suco2Opcoes.length)];
        }
      } else {
        // Caso normal: mesmo tipo, sabor diferente
        const suco2Opcoes = suco1Opcoes.filter(suco => 
          suco.receita_id_legado !== suco1Selecionado.receita_id_legado
        );
        
        if (suco2Opcoes.length > 0) {
          suco2Selecionado = suco2Opcoes[Math.floor(Math.random() * suco2Opcoes.length)];
        } else {
          // Se só tem 1 sabor, repetir
          suco2Selecionado = suco1Selecionado;
        }
      }

      return {
        suco1: {
          receita: suco1Selecionado,
          tipo: tipoEscolhido,
          tipo_display: TIPOS_SUCO_CONFIG[tipoEscolhido].nome_display
        },
        suco2: {
          receita: suco2Selecionado || suco1Selecionado,
          tipo: tipoSecundario || tipoEscolhido,
          tipo_display: TIPOS_SUCO_CONFIG[tipoSecundario || tipoEscolhido].nome_display
        }
      };
    }

    // ========================================
    // FUNÇÃO MELHORADA PARA BUSCAR RECEITAS
    // ========================================

    async function buscarReceitasPorCategoria(categoria) {
      // 1) Tentativa direta na tabela de receitas (preferível)
      const { data: receitasDiretas, error: erroDireto } = await supabase
        .from('receitas_legado')
        .select('receita_id_legado, nome_receita, categoria_descricao')
        .eq('categoria_descricao', categoria)
        .eq('inativa', false)
        .order('receita_id_legado');

      if (erroDireto) {
        console.error(`Erro ao buscar receitas da categoria ${categoria} (direto):`, erroDireto);
      }

      let receitas: any[] = receitasDiretas ?? [];

      // 2) Fallback: quando a categoria está somente em receita_ingredientes (ex.: "Suco 1")
      if (!receitas?.length) {
        const { data: ingRows, error: erroIng } = await supabase
          .from('receita_ingredientes')
          .select('receita_id_legado, categoria_descricao')
          .eq('categoria_descricao', categoria);

        if (erroIng) {
          console.error(`Erro ao buscar ingredientes por categoria ${categoria}:`, erroIng);
          return [];
        }

        const ids = Array.from(new Set((ingRows || []).map((r: any) => r.receita_id_legado).filter(Boolean)));

        if (ids.length) {
          const { data: receitasPorIds, error: erroIds } = await supabase
            .from('receitas_legado')
            .select('receita_id_legado, nome_receita, categoria_descricao')
            .in('receita_id_legado', ids)
            .eq('inativa', false);

          if (erroIds) {
            console.error(`Erro ao buscar receitas por IDs (${categoria}):`, erroIds);
            return [];
          }

          receitas = receitasPorIds ?? [];
        }
      }

      // Remover duplicatas (caso existam)
      const receitasUnicas = new Map();
      receitas?.forEach((receita: any) => {
        if (!receitasUnicas.has(receita.receita_id_legado)) {
          receitasUnicas.set(receita.receita_id_legado, {
            receita_id_legado: receita.receita_id_legado,
            nome: receita.nome_receita,
            categoria_descricao: receita.categoria_descricao ?? categoria
          });
        }
      });

      return Array.from(receitasUnicas.values());
    }

    // ========================================
    // FUNÇÃO PRINCIPAL MELHORADA DE GERAÇÃO DE CARDÁPIO COM SUCOS INTELIGENTES
    // ========================================

    async function gerarCardapioValidado(config) {
      const {
        dias = 5,
        porcoesPorDia = 50,
        proteinaGramas = '90',
        incluirFimSemana = false,
        incluirArrozIntegral = false,
        maxTentativasPorCategoria = 10,
        // NOVAS OPÇÕES DE SUCOS
        tipoSucoPrimario = 'PRO_MIX',
        tipoSucoSecundario = null,
        variarSucosPorDia = true
      } = config;

      const diasSemana = incluirFimSemana
        ? ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
        : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

      const cardapio = [];
      const receitasUsadas = new Set();
      const sucosUsados = new Set();
      const estatisticas = {
        total_receitas_testadas: 0,
        receitas_rejeitadas_por_criterios: 0,
        motivos_rejeicao: {},
        sucos_selecionados: {
          tipo_primario: tipoSucoPrimario,
          tipo_secundario: tipoSucoSecundario,
          variar_por_dia: variarSucosPorDia
        }
      };

      let indiceFeijao = 0;

      for (let dia = 0; dia < Math.min(dias, diasSemana.length); dia++) {
        const nomeDia = diasSemana[dia];
        const receitasDia = [];
        let custoTotalDia = 0;

        console.log(`\n=== GERANDO ${nomeDia} COM VALIDAÇÃO E SUCOS INTELIGENTES ===`);

        // 1. Arroz
        const opcaoArroz = incluirArrozIntegral && Math.random() > 0.7
          ? OPCOES_ARROZ.find(a => a.nome === 'ARROZ INTEGRAL')
          : OPCOES_ARROZ.find(a => a.nome === 'ARROZ');

        if (opcaoArroz) {
          receitasDia.push({
            categoria: 'Arroz',
            receita_id: `arroz_${opcaoArroz.nome.toLowerCase().replace(/\s+/g, '_')}`,
            nome: opcaoArroz.nome,
            custo_por_porcao: opcaoArroz.custo,
            custo_total_dia: opcaoArroz.custo * porcoesPorDia,
            validacao: { valida: true, motivo: 'Receita fixa validada' },
            ordem: 1
          });
          custoTotalDia += opcaoArroz.custo;
        }

        // 2. Feijão
        const opcaoFeijao = OPCOES_FEIJAO[indiceFeijao % OPCOES_FEIJAO.length];
        indiceFeijao++;

        receitasDia.push({
          categoria: 'Feijão',
          receita_id: `feijao_${opcaoFeijao.nome.toLowerCase().replace(/\s+/g, '_')}`,
          nome: opcaoFeijao.nome,
          custo_por_porcao: opcaoFeijao.custo,
          custo_total_dia: opcaoFeijao.custo * porcoesPorDia,
          validacao: { valida: true, motivo: 'Receita fixa validada' },
          ordem: 2
        });
        custoTotalDia += opcaoFeijao.custo;

        // 3. Receitas Base fixas
        for (const nomeBase of CATEGORIAS_BASE_FIXAS) {
          if (RECEITAS_FIXAS_BASE[nomeBase]) {
            const receitaBase = RECEITAS_FIXAS_BASE[nomeBase];
            receitasDia.push({
              categoria: 'Base',
              receita_id: `base_${nomeBase.toLowerCase().replace(/\s+/g, '_')}`,
              nome: nomeBase,
              custo_por_porcao: receitaBase.custo,
              custo_total_dia: receitaBase.custo * porcoesPorDia,
              validacao: { valida: true, motivo: 'Receita base obrigatória' },
              ordem: receitaBase.ordem
            });
            custoTotalDia += receitaBase.custo;
          }
        }

        // 4. SUCOS INTELIGENTES COM VALIDAÇÃO
        try {
          console.log(`Selecionando sucos para ${nomeDia}...`);
          const sucosEscolhidos = await selecionarSucosParaCardapio(tipoSucoPrimario, tipoSucoSecundario);
          
          // Processar Suco 1
          if (sucosEscolhidos.suco1?.receita) {
            const suco1 = sucosEscolhidos.suco1.receita;
            const dadosSuco1 = await calcularCustoReceita(suco1.receita_id_legado, porcoesPorDia);
            
            if (dadosSuco1 && dadosSuco1.validacao?.valida) {
              receitasDia.push({
                categoria: 'Suco 1',
                receita_id: suco1.receita_id_legado,
                nome: suco1.nome,
                custo_por_porcao: dadosSuco1.custo_por_porcao,
                custo_total_dia: dadosSuco1.custo_por_porcao * porcoesPorDia,
                validacao: dadosSuco1.validacao,
                tipo_suco: sucosEscolhidos.suco1.tipo_display,
                percentual_calculado: dadosSuco1.percentual_calculado,
                ordem: 8
              });
              custoTotalDia += dadosSuco1.custo_por_porcao;
              sucosUsados.add(suco1.receita_id_legado);
              console.log(`Suco 1: ✅ ${suco1.nome} (${sucosEscolhidos.suco1.tipo_display}) - R$ ${dadosSuco1.custo_por_porcao.toFixed(3)}`);
            } else {
              console.log(`Suco 1: ❌ ${suco1.nome} rejeitado - ${dadosSuco1?.validacao?.motivo || 'erro no cálculo'}`);
            }
          }

          // Processar Suco 2
          if (sucosEscolhidos.suco2?.receita) {
            const suco2 = sucosEscolhidos.suco2.receita;
            const dadosSuco2 = await calcularCustoReceita(suco2.receita_id_legado, porcoesPorDia);
            
            if (dadosSuco2 && dadosSuco2.validacao?.valida) {
              receitasDia.push({
                categoria: 'Suco 2',
                receita_id: suco2.receita_id_legado,
                nome: suco2.nome,
                custo_por_porcao: dadosSuco2.custo_por_porcao,
                custo_total_dia: dadosSuco2.custo_por_porcao * porcoesPorDia,
                validacao: dadosSuco2.validacao,
                tipo_suco: sucosEscolhidos.suco2.tipo_display,
                percentual_calculado: dadosSuco2.percentual_calculado,
                ordem: 9
              });
              custoTotalDia += dadosSuco2.custo_por_porcao;
              sucosUsados.add(suco2.receita_id_legado);
              console.log(`Suco 2: ✅ ${suco2.nome} (${sucosEscolhidos.suco2.tipo_display}) - R$ ${dadosSuco2.custo_por_porcao.toFixed(3)}`);
            } else {
              console.log(`Suco 2: ❌ ${suco2.nome} rejeitado - ${dadosSuco2?.validacao?.motivo || 'erro no cálculo'}`);
            }
          }
        } catch (error) {
          console.error(`Erro na seleção de sucos para ${nomeDia}:`, error);
        }

        // 5. OUTRAS CATEGORIAS COM VALIDAÇÃO RIGOROSA (exceto sucos já processados)
        for (const categoria of CATEGORIAS_CARDAPIO) {
          // Pular categorias já cobertas
          if (['Arroz', 'Feijão', 'Suco 1', 'Suco 2'].includes(categoria)) continue;

          let receitaValida = null;
          let tentativas = 0;

          // Buscar receitas da categoria
          const receitasDisponiveis = await buscarReceitasPorCategoria(categoria);
          if (receitasDisponiveis.length === 0) {
            console.log(`${categoria}: Nenhuma receita encontrada no banco`);
            continue;
          }

          // Filtrar receitas já usadas
          const receitasNaoUsadas = receitasDisponiveis.filter(r => 
            !receitasUsadas.has(r.receita_id_legado)
          );
          const pool = receitasNaoUsadas.length > 0 ? receitasNaoUsadas : receitasDisponiveis;

          // Para proteínas, filtrar por gramatura se especificada
          let receitasFiltradas = pool;
          if (categoria.includes('Prato Principal') && proteinaGramas) {
            const comGramatura = pool.filter(r => 
              r.nome.toUpperCase().includes(`${proteinaGramas}G`)
            );
            if (comGramatura.length > 0) {
              receitasFiltradas = comGramatura;
            }
          }

          // Tentar encontrar receita válida
          while (tentativas < Math.min(maxTentativasPorCategoria, receitasFiltradas.length)) {
            const receitaSelecionada = receitasFiltradas[Math.floor(Math.random() * receitasFiltradas.length)];
            const receitaCalculada = await calcularCustoReceita(receitaSelecionada.receita_id_legado, porcoesPorDia);
            
            estatisticas.total_receitas_testadas++;
            tentativas++;

            if (!receitaCalculada) {
              console.log(`${categoria}: Erro no cálculo da receita ${receitaSelecionada.nome}`);
              continue;
            }

            // VALIDAÇÃO RIGOROSA COM CRITÉRIOS DE AUDITORIA
            if (!receitaCalculada.validacao.valida) {
              console.log(`${categoria}: ${receitaCalculada.nome} REJEITADA - ${receitaCalculada.validacao.motivo}`);
              
              estatisticas.receitas_rejeitadas_por_criterios++;
              const motivo = receitaCalculada.validacao.motivo;
              estatisticas.motivos_rejeicao[motivo] = (estatisticas.motivos_rejeicao[motivo] || 0) + 1;
              
              // Remover receita do pool para não tentar novamente
              const index = receitasFiltradas.findIndex(r => r.receita_id_legado === receitaSelecionada.receita_id_legado);
              if (index > -1) receitasFiltradas.splice(index, 1);
              continue;
            }

            // FILTROS ADICIONAIS ESPECÍFICOS POR CATEGORIA
            
            // Sobremesas: rejeitar se muito caras
            if (categoria === 'Sobremesa' && receitaCalculada.custo_por_porcao > 2.50) {
              console.log(`${categoria}: ${receitaCalculada.nome} rejeitada por custo alto (R$ ${receitaCalculada.custo_por_porcao.toFixed(2)})`);
              continue;
            }

            // Proteínas: verificações específicas de qualidade
            if (categoria.includes('Prato Principal')) {
              // Rejeitar se tem muito poucos ingredientes (receita incompleta)
              if (receitaCalculada.ingredientes_total < 4) {
                console.log(`${categoria}: ${receitaCalculada.nome} rejeitada - poucos ingredientes (${receitaCalculada.ingredientes_total})`);
                continue;
              }

              // Rejeitar se custo muito baixo (falta proteína principal)
              if (receitaCalculada.custo_por_porcao < 0.80) {
                console.log(`${categoria}: ${receitaCalculada.nome} rejeitada - custo muito baixo, falta proteína principal`);
                continue;
              }
            }

            // Guarnições: verificar se não é apenas tempero
            if (categoria === 'Guarnição' && receitaCalculada.custo_por_porcao < 0.10) {
              console.log(`${categoria}: ${receitaCalculada.nome} rejeitada - possivelmente apenas temperos`);
              continue;
            }

            // Se chegou até aqui, receita é válida
            receitaValida = receitaCalculada;
            receitasUsadas.add(receitaSelecionada.receita_id_legado);
            break;
          }

          // Adicionar receita válida ao cardápio
          if (receitaValida) {
            receitasDia.push({
              categoria: categoria,
              receita_id: receitaValida.receita_id,
              nome: receitaValida.nome,
              custo_por_porcao: receitaValida.custo_por_porcao,
              custo_total_dia: receitaValida.custo_por_porcao * porcoesPorDia,
              ingredientes_calculados: `${receitaValida.ingredientes_com_preco}/${receitaValida.ingredientes_total}`,
              percentual_calculado: receitaValida.percentual_calculado,
              validacao: receitaValida.validacao,
              ordem: 20
            });
            custoTotalDia += receitaValida.custo_por_porcao;

            console.log(`${categoria}: ✅ ${receitaValida.nome} - R$ ${receitaValida.custo_por_porcao.toFixed(2)} (${receitaValida.percentual_calculado.toFixed(1)}% calculado)`);
          } else {
            console.log(`${categoria}: ❌ Nenhuma receita válida encontrada após ${tentativas} tentativas`);
          }
        }

        // Ordenar receitas por ordem
        receitasDia.sort((a, b) => (a.ordem || 20) - (b.ordem || 20));

        cardapio.push({
          dia: nomeDia,
          receitas: receitasDia,
          custo_total_dia: custoTotalDia,
          custo_por_porcao: custoTotalDia,
          total_receitas: receitasDia.length,
          receitas_validadas: receitasDia.filter(r => r.validacao?.valida).length,
          sucos_info: {
            suco1_tipo: receitasDia.find(r => r.categoria === 'Suco 1')?.tipo_suco || 'Não selecionado',
            suco2_tipo: receitasDia.find(r => r.categoria === 'Suco 2')?.tipo_suco || 'Não selecionado'
          }
        });

        console.log(`${nomeDia}: ${receitasDia.length} receitas, R$ ${custoTotalDia.toFixed(2)} por porção`);
      }

      return {
        cardapio: cardapio,
        resumo: {
          dias_gerados: cardapio.length,
          porcoes_por_dia: porcoesPorDia,
          custo_medio_por_porcao: cardapio.reduce((acc, dia) => acc + dia.custo_por_porcao, 0) / cardapio.length,
          custo_total_periodo: cardapio.reduce((acc, dia) => acc + dia.custo_por_porcao * porcoesPorDia, 0),
          qualidade: {
            total_receitas_testadas: estatisticas.total_receitas_testadas,
            receitas_rejeitadas: estatisticas.receitas_rejeitadas_por_criterios,
            taxa_aprovacao: ((estatisticas.total_receitas_testadas - estatisticas.receitas_rejeitadas_por_criterios) / estatisticas.total_receitas_testadas * 100).toFixed(1),
            motivos_rejeicao: estatisticas.motivos_rejeicao
          },
          sucos_configuracao: estatisticas.sucos_selecionados,
          sucos_unicos_utilizados: sucosUsados.size
        }
      };
    }

    // ========================================
    // HANDLERS DAS AÇÕES
    // ========================================

    if (requestData.action === 'generate_validated_menu') {
      console.log('Gerando cardápio com validação rigorosa e sucos inteligentes...');
      
      const config = {
        dias: requestData.dias || 5,
        porcoesPorDia: requestData.meal_quantity || 50,
        proteinaGramas: requestData.proteina_gramas || '90',
        incluirFimSemana: requestData.incluir_fim_semana || false,
        incluirArrozIntegral: requestData.incluir_arroz_integral || false,
        maxTentativasPorCategoria: requestData.max_tentativas || 10,
        // NOVAS CONFIGURAÇÕES DE SUCOS
        tipoSucoPrimario: requestData.tipo_suco_primario || 'PRO_MIX',
        tipoSucoSecundario: requestData.tipo_suco_secundario || null,
        variarSucosPorDia: requestData.variar_sucos_por_dia !== false
      };

      const resultado = await gerarCardapioValidado(config);

      return new Response(JSON.stringify({
        success: true,
        cardapio_semanal: {
          dias: resultado.cardapio.map(dia => ({
            dia_semana: dia.dia,
            receitas: dia.receitas.map(receita => ({
              categoria: receita.categoria,
              nome: receita.nome,
              custo_por_refeicao: receita.custo_por_porcao,
              receita_id: receita.receita_id,
              validacao_status: receita.validacao?.valida ? 'APROVADA' : 'REJEITADA',
              validacao_motivo: receita.validacao?.motivo,
              ingredientes_info: receita.ingredientes_calculados,
              percentual_calculado: receita.percentual_calculado,
              tipo_suco: receita.tipo_suco || null
            })),
            sucos_do_dia: dia.sucos_info
          })),
          custo_medio: resultado.resumo.custo_medio_por_porcao,
          total_refeicoes: resultado.resumo.porcoes_por_dia * resultado.resumo.dias_gerados,
          qualidade_cardapio: resultado.resumo.qualidade,
          configuracao_sucos: resultado.resumo.sucos_configuracao
        },
        data: resultado
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // NOVAS AÇÕES DE SUCOS INTEGRADAS

    if (requestData.action === 'listar_tipos_suco') {
      const tipos = {};
      
      for (const [tipo, config] of Object.entries(TIPOS_SUCO_CONFIG)) {
        try {
          const receitas = await buscarSucosPorTipo(tipo);
          
          tipos[tipo] = {
            nome_display: config.nome_display,
            total_receitas: receitas.length,
            caracteristicas: config.caracteristicas,
            custo_esperado: `R$ ${config.custo_esperado.min.toFixed(3)} - R$ ${config.custo_esperado.max.toFixed(3)}`,
            sabores_exemplo: receitas.slice(0, 5).map(r => {
              const nome = r.nome.toUpperCase();
              if (nome.includes('ABACAXI')) return 'Abacaxi';
              if (nome.includes('LARANJA')) return 'Laranja';
              if (nome.includes('LIMÃO')) return 'Limão';
              if (nome.includes('UVA')) return 'Uva';
              if (nome.includes('MANGA')) return 'Manga';
              return 'Outros';
            }),
            categorias_fonte: config.categorias_busca
          };
        } catch (error) {
          tipos[tipo] = {
            nome_display: config.nome_display,
            erro: error.message,
            total_receitas: 0
          };
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        tipos_disponiveis: tipos,
        opcoes_selecao: [
          {
            codigo: 'PRO_MIX',
            nome: 'Pro Mix',
            descricao: 'Sucos concentrados tradicionais'
          },
          {
            codigo: 'VITA_SUCO', 
            nome: 'Vita Suco',
            descricao: 'Sucos premium com vitaminas'
          },
          {
            codigo: 'NATURAL',
            nome: 'Natural',
            descricao: 'Sucos naturais com frutas frescas'
          },
          {
            codigo: 'DIET',
            nome: 'Diet',
            descricao: 'Sucos sem açúcar'
          }
        ],
        combinacoes_permitidas: [
          'PRO_MIX + PRO_MIX (mesmo tipo)',
          'VITA_SUCO + VITA_SUCO (mesmo tipo)',
          'NATURAL + NATURAL (mesmo tipo)', 
          'DIET + qualquer outro tipo',
          'qualquer tipo + DIET'
        ]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (requestData.action === 'selecionar_sucos') {
      const { tipo_primario, tipo_secundario } = requestData;
      
      if (!tipo_primario || !TIPOS_SUCO_CONFIG[tipo_primario]) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Tipo primário inválido',
          tipos_validos: Object.keys(TIPOS_SUCO_CONFIG)
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const sucosEscolhidos = await selecionarSucosParaCardapio(tipo_primario, tipo_secundario);
        
        return new Response(JSON.stringify({
          success: true,
          selecao: sucosEscolhidos,
          resumo: {
            suco1: `${sucosEscolhidos.suco1.tipo_display}: ${sucosEscolhidos.suco1.receita.nome}`,
            suco2: `${sucosEscolhidos.suco2.tipo_display}: ${sucosEscolhidos.suco2.receita.nome}`,
            coerencia: tipo_secundario ? 'Tipos diferentes (Diet + outro)' : 'Mesmo tipo, sabores diferentes'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (requestData.action === 'calcular_receita') {
      const { receita_id, porcoes = 100 } = requestData;
      
      if (!receita_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'receita_id é obrigatório'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const resultado = await calcularCustoReceita(receita_id, porcoes);
      
      return new Response(JSON.stringify({
        success: true,
        data: resultado
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (requestData.action === 'gerar_cardapio_simples') {
      // Manter compatibilidade com versão anterior (sem validação rigorosa)
      const resultado = await gerarCardapioValidado(requestData);
      
      return new Response(JSON.stringify({
        success: true,
        data: resultado
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (requestData.action === 'listar_categorias') {
      const resultado = {};
      
      for (const categoria of CATEGORIAS_CARDAPIO) {
        const receitas = await buscarReceitasPorCategoria(categoria);
        resultado[categoria] = {
          total_receitas: receitas.length,
          criterios_validacao: CRITERIOS_AVALIACAO[categoria] || null,
          receitas_exemplo: receitas.slice(0, 5)
        };
      }

      return new Response(JSON.stringify({
        success: true,
        data: resultado,
        criterios_disponiveis: Object.keys(CRITERIOS_AVALIACAO),
        tipos_suco_disponiveis: Object.keys(TIPOS_SUCO_CONFIG)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (requestData.action === 'validar_receita') {
      const { receita_id } = requestData;
      
      if (!receita_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'receita_id é obrigatório'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const receitaCalculada = await calcularCustoReceita(receita_id, 100);
      
      if (!receitaCalculada) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Não foi possível calcular a receita'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        receita: {
          id: receita_id,
          nome: receitaCalculada.nome,
          categoria: receitaCalculada.categoria,
          custo_por_porcao: receitaCalculada.custo_por_porcao,
          validacao: receitaCalculada.validacao,
          ingredientes: {
            total: receitaCalculada.ingredientes_total,
            com_preco: receitaCalculada.ingredientes_com_preco,
            percentual: receitaCalculada.percentual_calculado
          },
          criterios_aplicados: CRITERIOS_AVALIACAO[receitaCalculada.categoria] || null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (requestData.action === 'debug_receita') {
      const { receita_id } = requestData;
      
      if (!receita_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'receita_id é obrigatório'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: ingredientes } = await supabase
        .from('receita_ingredientes')
        .select('*')
        .eq('receita_id_legado', receita_id);

      const debug = [
        `Receita ${receita_id}: ${ingredientes?.length || 0} ingredientes encontrados`
      ];

      return new Response(JSON.stringify({
        success: true,
        debug_logs: debug,
        ingredientes: ingredientes?.slice(0, 5) || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ========================================
    // AUDITORIA COMPLETA DE CATEGORIAS E RECEITAS
    // ========================================
    if (requestData.action === 'auditar_categorias') {
      const { 
        categorias = null, // null = todas, ou array: ['Sobremesa', 'Prato Principal 1']
        limite_receitas = 50, // quantas receitas testar por categoria
        incluir_calculos_detalhados = true,
        apenas_problematicas = false
      } = requestData;
      
      console.log('🔍 Iniciando auditoria de categorias...');
      
      const categoriasParaAuditar = categorias || Object.keys(CRITERIOS_AVALIACAO);
      const relatorioGeral = {
        data_auditoria: new Date().toISOString(),
        categorias_auditadas: [],
        resumo_geral: {
          total_receitas_testadas: 0,
          receitas_validas: 0,
          receitas_problematicas: 0,
          problemas_por_tipo: {}
        }
      };
      
      for (const categoria of categoriasParaAuditar) {
        console.log(`\n📂 Auditando categoria: ${categoria}`);
        
        const criterios = CRITERIOS_AVALIACAO[categoria];
        if (!criterios) {
          console.log(`⚠️ Categoria ${categoria} não possui critérios definidos`);
          continue;
        }
        
        // Buscar receitas da categoria
        const receitasCategoria = await buscarReceitasPorCategoria(categoria);
        const receitasParaTestar = receitasCategoria.slice(0, limite_receitas);
        
        const relatorioCategoria = {
          categoria: categoria,
          criterios_validacao: criterios,
          total_receitas_disponiveis: receitasCategoria.length,
          receitas_testadas: receitasParaTestar.length,
          receitas_validas: [],
          receitas_problematicas: [],
          termos_extraidos: {
            ingredientes_principais: new Set(),
            palavras_chave: new Set()
          },
          estatisticas: {
            custo_minimo: Infinity,
            custo_maximo: 0,
            custo_medio: 0,
            problemas_por_severidade: {
              CRITICA: 0,
              ALTA: 0,
              MEDIA: 0
            }
          }
        };
        
        // Auditar cada receita
        for (const receita of receitasParaTestar) {
          try {
            const resultado = await calcularCustoReceita(receita.receita_id_legado, 100);
            
            if (!resultado) {
              relatorioCategoria.receitas_problematicas.push({
                receita_id: receita.receita_id_legado,
                nome: receita.nome,
                problema: 'Erro no cálculo - receita sem dados válidos',
                severidade: 'CRITICA'
              });
              relatorioCategoria.estatisticas.problemas_por_severidade.CRITICA++;
              continue;
            }
            
            // Extrair termos
            resultado.ingredientes?.forEach(ing => {
              const palavras = ing.nome.toUpperCase().split(/[\s\-\/]+/);
              palavras.forEach(p => {
                if (p.length > 3) relatorioCategoria.termos_extraidos.palavras_chave.add(p);
              });
              
              // Ingredientes principais
              criterios.ingredientes_obrigatorios?.forEach(obrig => {
                if (ing.nome.toUpperCase().includes(obrig)) {
                  relatorioCategoria.termos_extraidos.ingredientes_principais.add(obrig);
                }
              });
            });
            
            // Atualizar estatísticas de custo
            if (resultado.custo_por_porcao < relatorioCategoria.estatisticas.custo_minimo) {
              relatorioCategoria.estatisticas.custo_minimo = resultado.custo_por_porcao;
            }
            if (resultado.custo_por_porcao > relatorioCategoria.estatisticas.custo_maximo) {
              relatorioCategoria.estatisticas.custo_maximo = resultado.custo_por_porcao;
            }
            
            // Montar relatório detalhado da receita
            const receitaAuditada = {
              receita_id: receita.receita_id_legado,
              nome: resultado.nome,
              custo_por_porcao: resultado.custo_por_porcao,
              validacao: resultado.validacao,
              ingredientes: {
                total: resultado.ingredientes_total,
                com_preco: resultado.ingredientes_com_preco,
                percentual: resultado.percentual_calculado
              },
              problemas_detectados: []
            };
            
            // Adicionar cálculos detalhados se solicitado
            if (incluir_calculos_detalhados) {
              receitaAuditada.calculos_detalhados = resultado.ingredientes?.map(ing => ({
                ingrediente: ing.nome,
                quantidade: ing.quantidade,
                unidade: ing.unidade,
                tem_preco: ing.tem_preco,
                produto_base_id: ing.produto_base_id
              }));
            }
            
            // Análise de problemas específicos
            const problemas = [];
            
            // 1. Validação básica
            if (!resultado.validacao.valida) {
              problemas.push({
                tipo: 'validacao',
                severidade: resultado.validacao.severidade || 'MEDIA',
                descricao: resultado.validacao.motivo
              });
              relatorioCategoria.estatisticas.problemas_por_severidade[resultado.validacao.severidade || 'MEDIA']++;
            }
            
            // 2. Custo fora da faixa
            if (resultado.custo_por_porcao < criterios.custo_minimo) {
              problemas.push({
                tipo: 'custo_baixo',
                severidade: 'ALTA',
                descricao: `Custo muito baixo: R$ ${resultado.custo_por_porcao.toFixed(2)} (mínimo R$ ${criterios.custo_minimo.toFixed(2)})`,
                possivel_causa: 'Faltam ingredientes ou preços incorretos no banco'
              });
              relatorioCategoria.estatisticas.problemas_por_severidade.ALTA++;
            }
            
            if (resultado.custo_por_porcao > criterios.custo_maximo) {
              problemas.push({
                tipo: 'custo_alto',
                severidade: 'MEDIA',
                descricao: `Custo muito alto: R$ ${resultado.custo_por_porcao.toFixed(2)} (máximo R$ ${criterios.custo_maximo.toFixed(2)})`,
                possivel_causa: 'Preços inflacionados, unidades incorretas ou produtos prontos caros'
              });
              relatorioCategoria.estatisticas.problemas_por_severidade.MEDIA++;
            }
            
            // 3. Poucos ingredientes com preço
            if (resultado.percentual_calculado < 70) {
              problemas.push({
                tipo: 'preco_incompleto',
                severidade: 'MEDIA',
                descricao: `Apenas ${resultado.percentual_calculado.toFixed(1)}% dos ingredientes têm preço`,
                possivel_causa: 'Faltam preços no banco de dados para alguns ingredientes'
              });
            }
            
            // 4. Falta ingrediente obrigatório
            if (criterios.ingredientes_obrigatorios.length > 0) {
              const temObrigatorio = resultado.ingredientes?.some(ing =>
                criterios.ingredientes_obrigatorios.some(obrig =>
                  ing.nome.toUpperCase().includes(obrig)
                )
              );
              
              if (!temObrigatorio) {
                problemas.push({
                  tipo: 'ingrediente_faltando',
                  severidade: 'CRITICA',
                  descricao: `Falta ingrediente principal esperado para ${categoria}`,
                  possivel_causa: 'Receita incompleta ou mal categorizada',
                  ingredientes_esperados: criterios.ingredientes_obrigatorios.slice(0, 10)
                });
                relatorioCategoria.estatisticas.problemas_por_severidade.CRITICA++;
              }
            }
            
            // 5. Apenas temperos básicos
            if (criterios.tipos_problematicos.length > 0) {
              const apenasProblematicos = resultado.ingredientes?.every(ing =>
                criterios.tipos_problematicos.some(prob =>
                  ing.nome.toUpperCase().includes(prob)
                )
              );
              
              if (apenasProblematicos) {
                problemas.push({
                  tipo: 'apenas_temperos',
                  severidade: 'CRITICA',
                  descricao: 'Receita contém apenas temperos/condimentos básicos',
                  possivel_causa: 'Receita incompleta ou erro de cadastro'
                });
                relatorioCategoria.estatisticas.problemas_por_severidade.CRITICA++;
              }
            }
            
            receitaAuditada.problemas_detectados = problemas;
            
            // Classificar receita
            if (problemas.length === 0 && resultado.validacao.valida) {
              relatorioCategoria.receitas_validas.push(receitaAuditada);
            } else {
              relatorioCategoria.receitas_problematicas.push(receitaAuditada);
            }
            
          } catch (error) {
            relatorioCategoria.receitas_problematicas.push({
              receita_id: receita.receita_id_legado,
              nome: receita.nome,
              problema: `Erro na auditoria: ${error.message}`,
              severidade: 'CRITICA'
            });
            relatorioCategoria.estatisticas.problemas_por_severidade.CRITICA++;
          }
        }
        
        // Calcular custo médio
        const totalCustos = [...relatorioCategoria.receitas_validas, ...relatorioCategoria.receitas_problematicas]
          .reduce((acc, r) => acc + (r.custo_por_porcao || 0), 0);
        relatorioCategoria.estatisticas.custo_medio = totalCustos / receitasParaTestar.length;
        
        // Converter Sets para Arrays
        relatorioCategoria.termos_extraidos.ingredientes_principais = 
          Array.from(relatorioCategoria.termos_extraidos.ingredientes_principais);
        relatorioCategoria.termos_extraidos.palavras_chave = 
          Array.from(relatorioCategoria.termos_extraidos.palavras_chave).slice(0, 50); // Top 50
        
        // Filtrar se apenas problemáticas
        if (apenas_problematicas) {
          delete relatorioCategoria.receitas_validas;
        }
        
        relatorioGeral.categorias_auditadas.push(relatorioCategoria);
        relatorioGeral.resumo_geral.total_receitas_testadas += receitasParaTestar.length;
        relatorioGeral.resumo_geral.receitas_validas += relatorioCategoria.receitas_validas?.length || 0;
        relatorioGeral.resumo_geral.receitas_problematicas += relatorioCategoria.receitas_problematicas.length;
        
        // Agregar problemas por tipo
        relatorioCategoria.receitas_problematicas.forEach(r => {
          r.problemas_detectados?.forEach(p => {
            relatorioGeral.resumo_geral.problemas_por_tipo[p.tipo] = 
              (relatorioGeral.resumo_geral.problemas_por_tipo[p.tipo] || 0) + 1;
          });
        });
        
        console.log(`✅ ${categoria}: ${relatorioCategoria.receitas_validas?.length || 0} válidas, ${relatorioCategoria.receitas_problematicas.length} problemáticas`);
      }
      
      console.log('\n📊 Auditoria concluída!');
      
      return new Response(JSON.stringify({
        success: true,
        auditoria: relatorioGeral
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Status padrão
    return new Response(JSON.stringify({
      success: true,
      message: 'Gerador de Cardápio com Sistema de Sucos Integrado - Versão Final',
      actions: [
        'generate_validated_menu',
        'calcular_receita',
        'auditar_categorias',
        'gerar_cardapio_simples',
        'listar_categorias',
        'validar_receita',
        'debug_receita',
        'listar_tipos_suco',
        'selecionar_sucos'
      ],
      melhorias: [
        '🆕 SISTEMA DE SUCOS INTELIGENTE: 4 tipos diferentes (Pro Mix, Vita Suco, Natural, Diet)',
        '🆕 Seleção automática de sucos por tipo no cardápio',
        '🆕 Validação específica de sucos com faixas de custo adequadas',
        '🆕 Configuração flexível: tipo_suco_primario e tipo_suco_secundario',
        '🆕 Suporte a combinações especiais (Diet + qualquer outro tipo)',
        '🆕 Relatório de tipos de sucos utilizados por dia',
        '🆕 Estatísticas de sucos únicos utilizados no período',
        'NOVA: Validação rigorosa com critérios de auditoria',
        'NOVA: Rejeição automática de receitas problemáticas',
        'NOVA: Estatísticas de qualidade do cardápio',
        'NOVA: Correção automática do óleo de soja (produto_base_id 246)',
        'NOVA: Correção específica Vita Suco Uva (produto_base_id 325)',
        'NOVA: Percentual reduzido para sucos (40% em vez de 70%)',
        'NOVA: Suporte a 11 categorias (incluindo Desjejum, Bebidas, Base)',
        'NOVA: Filtros específicos por categoria',
        'NOVA: Relatório de motivos de rejeição'
      ],
      categorias_suportadas: Object.keys(CRITERIOS_AVALIACAO),
      tipos_suco_disponiveis: Object.keys(TIPOS_SUCO_CONFIG),
      total_categorias: Object.keys(CRITERIOS_AVALIACAO).length,
      configuracao_sucos: {
        tipos_disponiveis: TIPOS_SUCO_CONFIG,
        parametros_cardapio: {
          tipo_suco_primario: 'Tipo principal de suco (PRO_MIX, VITA_SUCO, NATURAL, DIET)',
          tipo_suco_secundario: 'Tipo secundário opcional (para variedade)',
          variar_sucos_por_dia: 'Se deve variar sabores entre os dias'
        },
        exemplos_uso: {
          so_pro_mix: '{"tipo_suco_primario": "PRO_MIX"}',
          mix_tipos: '{"tipo_suco_primario": "PRO_MIX", "tipo_suco_secundario": "VITA_SUCO"}',
          diet_plus: '{"tipo_suco_primario": "DIET", "tipo_suco_secundario": "NATURAL"}'
        }
      },
      faixas_custo_sucos: {
        PRO_MIX: 'R$ 0,060 - 0,090',
        VITA_SUCO: 'R$ 0,010 - 0,060',
        NATURAL: 'R$ 0,250 - 0,800',
        DIET: 'R$ 0,015 - 0,040'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na calculadora integrada:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    // ========================================
    // NOVA FUNCIONALIDADE: AUDITORIA DE RECEITAS
    // ========================================
    if (action === 'audit_recipe_problems') {
      const { receita_id, log_to_swift = true } = requestData;

      if (!receita_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'receita_id é obrigatório'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        console.log(`🔍 Iniciando auditoria da receita ${receita_id}`);

        // Usar a função existente de cálculo de custo
        const custoData = await calcularCustoReceita(receita_id, 100);

        if (!custoData || !custoData.sucesso) {
          const problemaReceita = {
            receita_id,
            nome: 'Receita não encontrada',
            categoria: 'Não definido',
            problemas: [
              {
                tipo: 'availability',
                severidade: 'CRITICA',
                mensagem: 'Receita não encontrada ou sem dados válidos'
              }
            ],
            custo_calculado: 0,
            ingredientes_total: 0,
            percentual_calculado: 0
          };

          // Log para swift-processor se solicitado
          if (log_to_swift) {
            await supabase.functions.invoke('swift-processor', {
              body: {
                event_type: 'recipe_audit_failed',
                entity_type: 'receita',
                entity_id: receita_id,
                action: 'audit_validation',
                severity: 'critical',
                status: 'error',
                metadata: problemaReceita
              }
            });
          }

          return new Response(JSON.stringify({
            success: true,
            resultado: problemaReceita
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { resultado } = custoData;
        const problemas = [];

        // Aplicar critérios de validação
        const validacao = validarReceitaComCriterios(resultado, resultado.categoria);
        
        if (!validacao.valida) {
          problemas.push({
            tipo: 'validation',
            severidade: validacao.severidade || 'MEDIA',
            mensagem: validacao.motivo
          });
        }

        // Verificações adicionais de auditoria
        if (resultado.ingredientes_total < 2) {
          problemas.push({
            tipo: 'ingredients',
            severidade: 'ALTA',
            mensagem: `Muito poucos ingredientes (${resultado.ingredientes_total})`
          });
        }

        if (resultado.percentual_calculado < 40) {
          problemas.push({
            tipo: 'cost',
            severidade: 'MEDIA',
            mensagem: `Muitos ingredientes sem preço (${resultado.percentual_calculado.toFixed(1)}% calculado)`
          });
        }

        if (resultado.custo_por_porcao < 0.05) {
          problemas.push({
            tipo: 'cost',
            severidade: 'ALTA',
            mensagem: `Custo suspeito muito baixo: R$ ${resultado.custo_por_porcao.toFixed(3)}`
          });
        }

        if (resultado.custo_por_porcao > 10.00) {
          problemas.push({
            tipo: 'cost',
            severidade: 'MEDIA',
            mensagem: `Custo muito alto: R$ ${resultado.custo_por_porcao.toFixed(2)}`
          });
        }

        // Verificar categorias específicas
        if (resultado.categoria?.includes('Prato Principal')) {
          const temProteina = resultado.ingredientes_detalhes?.some(ing => {
            const desc = ing.nome?.toUpperCase() || '';
            return desc.includes('CARNE') || desc.includes('FRANGO') || desc.includes('PEIXE') || 
                   desc.includes('PROTEÍNA') || desc.includes('BIFE') || desc.includes('OVO');
          });
          
          if (!temProteina) {
            problemas.push({
              tipo: 'validation',
              severidade: 'CRITICA',
              mensagem: 'Prato principal sem proteína identificada'
            });
          }
        }

        const resultadoAuditoria = {
          receita_id,
          nome: resultado.nome,
          categoria: resultado.categoria,
          problemas,
          custo_calculado: resultado.custo_por_porcao,
          ingredientes_total: resultado.ingredientes_total,
          percentual_calculado: resultado.percentual_calculado,
          tem_problemas: problemas.length > 0
        };

        // Log para swift-processor apenas se há problemas
        if (problemas.length > 0 && log_to_swift) {
          const severidadeGeral = problemas.some(p => p.severidade === 'CRITICA') ? 'critical' :
                                  problemas.some(p => p.severidade === 'ALTA') ? 'error' :
                                  problemas.some(p => p.severidade === 'MEDIA') ? 'warn' : 'info';

          await supabase.functions.invoke('swift-processor', {
            body: {
              event_type: 'recipe_audit_failed',
              entity_type: 'receita',
              entity_id: receita_id,
              action: 'audit_validation',
              severity: severidadeGeral,
              status: 'error',
              metadata: {
                nome_receita: resultado.nome,
                categoria: resultado.categoria,
                total_problems: problemas.length,
                problems_summary: problemas,
                custo_calculado: resultado.custo_por_porcao,
                ingredientes_total: resultado.ingredientes_total,
                percentual_calculado: resultado.percentual_calculado,
                critical_issues: problemas.filter(p => p.severidade === 'CRITICA').length,
                high_priority_issues: problemas.filter(p => p.severidade === 'ALTA').length
              }
            }
          });
        }

        console.log(`✅ Auditoria concluída: ${resultado.nome} - ${problemas.length} problemas encontrados`);

        return new Response(JSON.stringify({
          success: true,
          resultado: resultadoAuditoria
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('❌ Erro na auditoria da receita:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Ação não reconhecida'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});