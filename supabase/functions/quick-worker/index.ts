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
    custo_maximo: 0.80,  // Aumentado para suportar sucos PRÓ MIX e outros tipos
    percentual_minimo_calculado: 30,  // Reduzido pois sucos podem ter poucos ingredientes
    ingredientes_obrigatorios: ['SUCO', 'PÓ', 'POLPA', 'FRUTA', 'CONCENTRADO', 'REFRESCO'],
    tipos_problematicos: []
  },
  'Suco 2': {
    ingredientes_minimos: 1,
    custo_minimo: 0.01,
    custo_maximo: 0.80,  // Aumentado para suportar sucos PRÓ MIX e outros tipos
    percentual_minimo_calculado: 30,  // Reduzido pois sucos podem ter poucos ingredientes
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
// SISTEMA DE SUCOS - BUSCA SIMPLIFICADA
// ========================================

// Configuração dos tipos de suco disponíveis
const TIPOS_SUCO_CONFIG = {
  'PRO_MIX': {
    nome_display: 'Suco em Pó Pró Mix',
    caracteristicas: ['Em pó', 'Diversas vitaminas', 'Fácil preparo', 'Longa validade'],
    custo_esperado: { min: 0.20, max: 0.50 },
    palavras_chave: ['PRÓ MIX', 'PRO MIX', 'PROMIX']
  },
  'VITA_SUCO': {
    nome_display: 'Vita Suco',
    caracteristicas: ['Concentrado', 'Sabor intenso', 'Boa relação custo-benefício'],
    custo_esperado: { min: 0.15, max: 0.45 },
    palavras_chave: ['VITA SUCO', 'VITASUCO', 'VITA']
  },
  'DIET': {
    nome_display: 'Suco Diet',
    caracteristicas: ['Sem açúcar', 'Para diabéticos', 'Baixa caloria'],
    custo_esperado: { min: 0.25, max: 0.60 },
    palavras_chave: ['DIET', 'LIGHT', 'ZERO']
  },
  'NATURAL': {
    nome_display: 'Suco Natural',
    caracteristicas: ['Feito com polpa', 'Mais natural', 'Maior frescor'],
    custo_esperado: { min: 0.30, max: 0.70 },
    palavras_chave: ['NATURAL', 'POLPA', 'FRUTA']
  }
};

// Sistema de fallback automático para tipos de suco sem receitas
const FALLBACK_SUCOS = {
  'PRO_MIX': 'VITA_SUCO',
  'DIET': 'VITA_SUCO',
  'NATURAL': 'VITA_SUCO',
  'VITA_SUCO': null // já é o tipo base
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
  'KIT TEMPERO DE MESA'
];

// Produtos pré-prontos que naturalmente têm menos ingredientes
const PRODUTOS_PRE_PRONTOS = [
  'ALMONDEGA',
  'ALMÔNDEGA',
  'HAMBURGUER',
  'HAMBÚRGUER',
  'NUGGET',
  'NUGGETS',
  'KIBE',
  'QUIBE',
  'SALSICHA',
  'LINGUIÇA DEFUMADA',
  'EMPANADO',
  'LASANHA PRONTA',
  'NHOQUE PRONTO',
  'RAVIOLI PRONTO',
  'CANELONE PRONTO'
];

// ========================================
// SISTEMA DE ORÇAMENTO PONDERADO
// ========================================

// Distribuição realista de custos por categoria
// Baseado em análise de custos reais de mercado
const PESOS_ORCAMENTO = {
  'Prato Principal 1': 0.35,  // 35% - Proteína principal (mais cara) - AJUSTADO para realismo de mercado
  'Prato Principal 2': 0.28,  // 28% - Proteína secundária - AJUSTADO para viabilidade
  'Guarnição': 0.13,          // 13% - Acompanhamentos quentes - REDUZIDO
  'Salada 1': 0.08,           // 8%  - Salada principal
  'Salada 2': 0.06,           // 6%  - Salada complementar - REDUZIDO
  'Sobremesa': 0.10,          // 10% - Doce/fruta - REDUZIDO
  'Suco 1': 0.00,             // 0%  - Custo fixo (pó)
  'Suco 2': 0.00,             // 0%  - Custo fixo (pó)
  'Base': 0.00                // 0%  - Custos incluídos em fixos
};
// Total: 100% distribuído entre categorias com custo variável

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
  'KIT TEMPERO DE MESA': { custo: 0.09, ordem: 13 }
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
    // FUNÇÃO AUXILIAR: DETECTAR PRODUTOS PRÉ-PRONTOS
    // ========================================

    /**
     * Detecta se receita usa produtos pré-prontos
     * (produtos que já vêm preparados e têm menos ingredientes naturalmente)
     */
    function ehReceitaComPrePronto(ingredientes: any[]): boolean {
      if (!ingredientes || ingredientes.length === 0) return false;
      
      return ingredientes.some(ing => {
        const nome = (ing.nome || '').toUpperCase();
        const descricao = (ing.produto_base_descricao || '').toUpperCase();
        
        return PRODUTOS_PRE_PRONTOS.some(prepPronto => 
          nome.includes(prepPronto.toUpperCase()) || 
          descricao.includes(prepPronto.toUpperCase())
        );
      });
    }

    // ========================================
    // FUNÇÃO DE VALIDAÇÃO COM CRITÉRIOS DE AUDITORIA
    // ========================================

    function validarReceitaComCriterios(dadosReceita, categoria) {
      const criterios = CRITERIOS_AVALIACAO[categoria];
      if (!criterios) return { valida: true, motivo: 'Categoria sem critérios definidos' };

      const { custo_por_porcao, ingredientes_total, percentual_calculado, ingredientes, ingredientes_detalhes } = dadosReceita;

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

      // 🔥 PRIORIDADE 1: Usar custo já calculado da receita
      const { data: receitaData, error: errorReceita } = await supabase
        .from('receitas_legado')
        .select('custo_total, porcoes, quantidade_refeicoes, nome_receita, categoria_descricao')
        .eq('receita_id_legado', receitaId)
        .single();
      
      if (receitaData?.custo_total && receitaData.custo_total > 0) {
        const porcoes = receitaData.porcoes || receitaData.quantidade_refeicoes || 1;
        const custoPorPorcao = receitaData.custo_total / porcoes;
        console.log(`✅ Usando custo pré-calculado: R$ ${custoPorPorcao.toFixed(2)}`);
        
        return {
          receita_id: receitaId,
          nome: receitaData.nome_receita,
          categoria: receitaData.categoria_descricao,
          custo_por_porcao: custoPorPorcao,
          custo_total: receitaData.custo_total,
          ingredientes_total: 0,
          ingredientes_com_preco: 0,
          percentual_calculado: 100,
          validacao: { valida: true, motivo: 'Custo pré-calculado validado' }
        };
      }
      
      console.log(`⚠️ Custo não encontrado, calculando em tempo real...`);

      // 🔥 FALLBACK: Calcular em tempo real apenas se não houver custo
      // 1. Buscar ingredientes da receita
      const { data: ingredientes, error: errorIngredientes } = await supabase
        .from('receita_ingredientes')
        .select('*, quantidade_refeicoes')
        .eq('receita_id_legado', receitaId);

      if (errorIngredientes || !ingredientes?.length) {
        console.log(`Receita ${receitaId}: sem ingredientes válidos`);
        return null;
      }

      const nomeReceita = ingredientes[0].nome;
      const categoria = ingredientes[0].categoria_descricao;

      // Usar quantidade_refeicoes do banco (para quantas porções a receita foi criada)
      // Fallback para 100 se não informado
      const porcoesReceita = ingredientes[0]?.quantidade_refeicoes || 100;
      console.log(`📊 Receita preparada para ${porcoesReceita} porções`);

      // 2. Detectar se receita tem AMBOS tipos de carne moída
      const temCarne1 = ingredientes.some(ing => 
        (ing.produto_base_descricao || '').includes('CARNE') && 
        (ing.produto_base_descricao || '').includes('1ª')
      );
      const temCarne2 = ingredientes.some(ing => 
        (ing.produto_base_descricao || '').includes('CARNE') && 
        (ing.produto_base_descricao || '').includes('2ª')
      );
      const temDuplicacaoCarne = temCarne1 && temCarne2;

      if (temDuplicacaoCarne) {
        console.log(`⚠️ Receita ${receitaId} (${nomeReceita}): CARNE MOÍDA duplicada detectada - removendo 1ª`);
      }

      // 3. Filtrar ingredientes problemáticos
      const ingredientesLimpos = ingredientes.filter(ing => {
        const descricao = ing.produto_base_descricao || '';
        
        // Remover CARNE MOÍDA 1ª APENAS se a receita tiver ambos tipos
        if (temDuplicacaoCarne && descricao.includes('CARNE') && descricao.includes('1ª')) {
          console.log(`  ❌ Removendo: ${descricao} (duplicação)`);
          return false;
        }
        
        // Remover ARROZ EMERGÊNCIA (produto_base_id: 38)
        if (ing.produto_base_id === 38) return false;
        
        // Ignorar ÁGUA NATURAL no cálculo
        if (descricao.toUpperCase().includes('AGUA')) return false;
        
        return true;
      });

      console.log(
        `Ingredientes: ${ingredientes.length} → ${ingredientesLimpos.length} (após filtro)\n` +
        (temDuplicacaoCarne ? `  🔧 Deduplicação aplicada: CARNE MOÍDA 1ª removida\n` : '')
      );

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

          // Produtos por unidade
          if (descricao.match(/copo|prato|talher|guardanapo|saco|embalagem/i)) {
            precosKg.push(produto.preco);
            continue;
          }

          // ========== DETECÇÃO INTELIGENTE DE EMBALAGEM ==========
          // Ignora 90g/100g que são porções (não embalagens)
          let pesoKg = 1;

          // 1. Detectar meio kg: "0,500" ou "0.500"
          const matchMeioKg = descricao.match(/0[.,]5(?:00)?\s*(?:KG|G)?/i);
          if (matchMeioKg) {
            pesoKg = 0.5;
            if (produtoId === 103) console.log(`✅ 500g detectado: ${descricao}`);
          }
          // 2. Detectar "(KG)" = 1kg
          else if (descricao.match(/\(KG\)/i)) {
            pesoKg = 1;
            if (produtoId === 103) console.log(`✅ 1kg (KG) detectado: ${descricao}`);
          }
          // 3. Número + KG explícito
          else if (descricao.match(/(\d+(?:[.,]\d+)?)\s*KG/i)) {
            const matchKg = descricao.match(/(\d+(?:[.,]\d+)?)\s*KG/i);
            pesoKg = parseFloat(matchKg[1].replace(',', '.'));
            if (produtoId === 103) console.log(`✅ ${pesoKg}kg explícito: ${descricao}`);
          }
          // 4. Gramas (IGNORANDO 90g/100g de porções)
          else {
            const matchGr = descricao.match(/(\d+(?:[.,]\d+)?)\s*G(?:R|RAMA|RS)?/gi);
            if (matchGr) {
              const valores = matchGr
                .map(g => parseFloat(g.match(/(\d+(?:[.,]\d+)?)/)[1].replace(',', '.')))
                .filter(v => v !== 90 && v !== 100); // 🔥 FILTRO CRÍTICO
              
              if (valores.length > 0) {
                pesoKg = Math.max(...valores) / 1000;
                if (produtoId === 103) console.log(`✅ Embalagem ${pesoKg * 1000}g (filtrado 90/100): ${descricao}`);
              } else if (produtoId === 103) {
                console.log(`⚠️ Apenas porções (90/100g) encontradas: ${descricao}`);
              }
            }
            // 5. Líquidos (fallback)
            else {
              const matchL = descricao.match(/(\d+(?:[.,]\d+)?)\s*L(?:T|ITRO)?/i);
              const matchMl = descricao.match(/(\d+(?:[.,]\d+)?)\s*ML/i);
              
              if (matchL) {
                pesoKg = parseFloat(matchL[1].replace(',', '.'));
              } else if (matchMl) {
                pesoKg = parseFloat(matchMl[1].replace(',', '.')) / 1000;
              }
            }
          }

          if (pesoKg <= 0) pesoKg = 1;
          
          // Calcular preço por kg ANTES de adicionar ao array
          const precoPorKg = produto.preco / pesoKg;
          
          // Log detalhado para produtos específicos (ex: produto_base_id 103)
          if (produtoId === 103) {
            console.log(`💰 [Produto 103] ${descricao} | Preço: R$ ${produto.preco.toFixed(2)} | Peso: ${pesoKg}kg | R$/kg: ${precoPorKg.toFixed(2)}`);
          }
          
          precosKg.push(precoPorKg);
        }

        if (precosKg.length > 0) {
          const media = precosKg.reduce((a, b) => a + b, 0) / precosKg.length;
          precosNormalizados.set(produtoId, media);
          
          // Log da média calculada para produtos específicos
          if (produtoId === 103) {
            console.log(`📊 [Produto 103] Média calculada: R$ ${media.toFixed(2)}/kg (${precosKg.length} preços normalizados)`);
            console.log(`   Valores normalizados: ${precosKg.map(p => 'R$ ' + p.toFixed(2)).join(', ')}`);
          }
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
        // CORREÇÃO: Molhos e líquidos cadastrados como LT quando são ML
        else if (unidadeNormalizada === 'LT' || unidadeNormalizada === 'L') {
          const nomeIng = ingrediente.produto_base_descricao?.toUpperCase() || '';
          
          // Se quantidade >= 10 LT E é molho/líquido → provavelmente é ML cadastrado errado
          const ehMolhoOuLiquido = (
            nomeIng.includes('MOLHO') || 
            nomeIng.includes('SHOYU') || nomeIng.includes('SHOYO') ||
            nomeIng.includes('VINAGRE') || 
            nomeIng.includes('AZEITE') ||
            nomeIng.includes('BARBECUE') || 
            nomeIng.includes('INGLES') ||
            nomeIng.includes('PIMENTA') || 
            nomeIng.includes('ROTY')
          );
          
          if (quantidadeNormalizada >= 10 && ehMolhoOuLiquido) {
            const qtdOriginal = quantidadeNormalizada;
            quantidadeNormalizada = quantidadeNormalizada / 1000; // Converte ML → L
            console.log(`🔧 CORREÇÃO ML→L: ${nomeIng} ${qtdOriginal} LT → ${quantidadeNormalizada} L (corrigido de ML)`);
            correcaoAplicada = `${qtdOriginal} LT → ${quantidadeNormalizada} L (era ML)`;
          }
          // Senão: valores < 10 LT são legítimos (ex: 0.5 LT de óleo)
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

        // CORREÇÃO CRÍTICA: Dividir por quantidade_refeicoes (porções da receita no banco)
        const quantidadePorPorcao = quantidadeNormalizada / porcoesReceita;
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
        porcoes: porcoesReceita,
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

    // Função CORRIGIDA para buscar sucos por tipo usando JOIN
    async function buscarSucosPorTipo(tipo: string) {
      console.log(`🧃 Buscando sucos do tipo: ${tipo}`);
      
      // Construir padrão de busca baseado no tipo
      const palavrasChave = TIPOS_SUCO_CONFIG[tipo]?.palavras_chave || [];
      if (palavrasChave.length === 0) {
        console.error(`❌ Tipo de suco inválido: ${tipo}`);
        return [];
      }

      // Query com JOIN entre receita_ingredientes e receitas_legado
      const { data: ingredientesData, error: errorIngredientes } = await supabase
        .from('receita_ingredientes')
        .select('receita_id_legado, nome, categoria_descricao')
        .in('categoria_descricao', ['Suco 1', 'Suco 2']);

      if (errorIngredientes) {
        console.error(`❌ Erro ao buscar ingredientes de sucos:`, errorIngredientes);
        return [];
      }

      // Filtrar por tipo de suco usando palavras-chave
      const ingredientesFiltrados = ingredientesData?.filter(ing => {
        const nomeUpper = (ing.nome || '').toUpperCase();
        return palavrasChave.some(palavra => nomeUpper.includes(palavra.toUpperCase()));
      }) || [];

      if (ingredientesFiltrados.length === 0) {
        console.log(`   ⚠️ Nenhum ingrediente encontrado para ${tipo}`);
        return [];
      }

      // Buscar receitas válidas correspondentes
      const receitasIds = [...new Set(ingredientesFiltrados.map(ing => ing.receita_id_legado))];
      
      const { data: receitasData, error: errorReceitas } = await supabase
        .from('receitas_legado')
        .select('receita_id_legado, nome_receita, categoria_descricao, inativa')
        .in('receita_id_legado', receitasIds)
        .eq('inativa', false);

      if (errorReceitas) {
        console.error(`❌ Erro ao buscar receitas:`, errorReceitas);
        return [];
      }

      const receitasValidas = receitasData?.map(r => ({
        receita_id_legado: r.receita_id_legado,
        nome: r.nome_receita,
        categoria_descricao: r.categoria_descricao
      })) || [];

      console.log(`   ✅ ${tipo}: ${receitasValidas.length} receitas válidas encontradas`);
      return receitasValidas;
    }

    // Função para selecionar sucos com FALLBACK automático
    async function selecionarSucosParaCardapio(tipoPrimario: string, tipoSecundario: string | null = null) {
      console.log(`🧃 Selecionando sucos: Primário=${tipoPrimario}, Secundário=${tipoSecundario || 'mesmo tipo'}`);

      // Tentar buscar tipo primário
      let suco1Opcoes = await buscarSucosPorTipo(tipoPrimario);
      let tipoEfetivo = tipoPrimario;
      
      // Se não encontrou, usar fallback
      if (suco1Opcoes.length === 0) {
        const fallbackTipo = FALLBACK_SUCOS[tipoPrimario];
        if (fallbackTipo) {
          console.log(`   ⚠️ ${tipoPrimario} não tem receitas, usando fallback: ${fallbackTipo}`);
          suco1Opcoes = await buscarSucosPorTipo(fallbackTipo);
          tipoEfetivo = fallbackTipo;
        }
      }

      if (suco1Opcoes.length === 0) {
        throw new Error(`Nenhum suco encontrado para o tipo ${tipoPrimario} (nem fallback ${FALLBACK_SUCOS[tipoPrimario] || 'N/A'})`);
      }

      // Seleção do Suco 1
      const suco1Selecionado = suco1Opcoes[Math.floor(Math.random() * suco1Opcoes.length)];

      // Seleção do Suco 2
      let suco2Selecionado;
      let tipoEfetivoSuco2 = tipoSecundario || tipoEfetivo;
      
      if (tipoSecundario && tipoSecundario !== tipoPrimario) {
        // Dois tipos diferentes
        let suco2Opcoes = await buscarSucosPorTipo(tipoSecundario);
        
        // Fallback para suco 2 também
        if (suco2Opcoes.length === 0) {
          const fallbackTipo = FALLBACK_SUCOS[tipoSecundario];
          if (fallbackTipo) {
            console.log(`   ⚠️ ${tipoSecundario} não tem receitas, usando fallback: ${fallbackTipo}`);
            suco2Opcoes = await buscarSucosPorTipo(fallbackTipo);
            tipoEfetivoSuco2 = fallbackTipo;
          }
        }
        
        if (suco2Opcoes.length > 0) {
          suco2Selecionado = suco2Opcoes[Math.floor(Math.random() * suco2Opcoes.length)];
        } else {
          suco2Selecionado = suco1Selecionado;
          tipoEfetivoSuco2 = tipoEfetivo;
        }
      } else {
        // Mesmo tipo, tentar sabor diferente
        const suco2Opcoes = suco1Opcoes.filter(suco => 
          suco.receita_id_legado !== suco1Selecionado.receita_id_legado
        );
        
        if (suco2Opcoes.length > 0) {
          suco2Selecionado = suco2Opcoes[Math.floor(Math.random() * suco2Opcoes.length)];
        } else {
          suco2Selecionado = suco1Selecionado;
        }
      }

      console.log(`   Suco 1: ${suco1Selecionado.nome} (${suco1Selecionado.receita_id_legado}) [${tipoEfetivo}]`);
      console.log(`   Suco 2: ${suco2Selecionado?.nome || suco1Selecionado.nome} (${suco2Selecionado?.receita_id_legado || suco1Selecionado.receita_id_legado}) [${tipoEfetivoSuco2}]`);

      return {
        suco1: {
          receita: suco1Selecionado,
          tipo: tipoEfetivo,
          tipo_display: TIPOS_SUCO_CONFIG[tipoEfetivo].nome_display
        },
        suco2: {
          receita: suco2Selecionado || suco1Selecionado,
          tipo: tipoEfetivoSuco2,
          tipo_display: TIPOS_SUCO_CONFIG[tipoEfetivoSuco2].nome_display
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
        budgetPerMeal = null,
        filialId = null, // ID do cliente para buscar configuração
        // NOVAS OPÇÕES DE SUCOS - Usar configuração do cliente se não especificado
        tipoSucoPrimario = null,
        tipoSucoSecundario = null,
        variarSucosPorDia = true
      } = config;
      
      // 🔥 BUSCAR CONFIGURAÇÃO DE SUCOS DO CLIENTE SE NÃO ESPECIFICADO
      let tipoSucoPrimarioFinal = tipoSucoPrimario;
      let tipoSucoSecundarioFinal = tipoSucoSecundario;
      
      if (!tipoSucoPrimarioFinal && filialId) {
        console.log('🔍 Buscando configuração de sucos do cliente...');
        const { data: clientConfig } = await supabase
          .from('contratos_corporativos')
          .select('use_pro_mix, use_pro_vita, use_suco_diet, use_suco_natural')
          .eq('filial_id_legado', filialId)
          .single();
        
        if (clientConfig) {
          // Determinar tipo primário baseado na config (prioridade)
          if (clientConfig.use_pro_mix) tipoSucoPrimarioFinal = 'PRO_MIX';
          else if (clientConfig.use_pro_vita) tipoSucoPrimarioFinal = 'VITA_SUCO';
          else if (clientConfig.use_suco_diet) tipoSucoPrimarioFinal = 'DIET';
          else if (clientConfig.use_suco_natural) tipoSucoPrimarioFinal = 'NATURAL';
          else tipoSucoPrimarioFinal = 'NATURAL'; // Fallback
          
          console.log(`✅ Tipo de suco configurado: ${tipoSucoPrimarioFinal}`, clientConfig);
        } else {
          tipoSucoPrimarioFinal = 'NATURAL'; // Fallback se não encontrar config
          console.log('⚠️ Config não encontrada, usando NATURAL como padrão');
        }
      } else if (!tipoSucoPrimarioFinal) {
        tipoSucoPrimarioFinal = 'NATURAL'; // Fallback final
      }

      const diasSemana = incluirFimSemana
        ? ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
        : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

      const cardapio = [];
      const receitasUsadas = new Set();
      const sucosUsados = new Set();
      const estatisticas = {
        total_receitas_testadas: 0,
        receitas_rejeitadas_por_criterios: 0,
        receitas_rejeitadas_por_orcamento: 0, // 🔥 NOVO
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
          console.log(`Selecionando sucos para ${nomeDia} - Tipo: ${tipoSucoPrimarioFinal}...`);
          const sucosEscolhidos = await selecionarSucosParaCardapio(tipoSucoPrimarioFinal, tipoSucoSecundarioFinal);
          
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
        // 🔥 TRACK DE PROTEÍNAS DO DIA PARA GARANTIR VARIEDADE
        const proteinasUsadasHoje = new Set();
        
        for (const categoria of CATEGORIAS_CARDAPIO) {
          // Pular categorias já cobertas
          if (['Arroz', 'Feijão', 'Suco 1', 'Suco 2'].includes(categoria)) continue;

          let receitaValida = null;
          let tentativas = 0;

          // Buscar receitas da categoria
          const receitasDisponiveis = await buscarReceitasPorCategoria(categoria);
          if (receitasDisponiveis.length === 0) {
            console.log(`${categoria}: ❌ NENHUMA RECEITA ENCONTRADA NO BANCO`);
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

            // 🔥 FILTRO DE ORÇAMENTO: Rejeitar receitas que ultrapassem limite ponderado
            if (budgetPerMeal && categoria !== 'Arroz' && categoria !== 'Feijão') {
              // Custos fixos conhecidos
              const CUSTO_ARROZ = 0.64;
              const CUSTO_FEIJAO = 0.46;
              const CUSTO_SUCOS = 0.15;  // Sucos em pó custam ~R$ 0,15 total
              const CUSTO_BASE = 0.29;   // Descartáveis, temperos, café (sem mini pilão)
              const custoFixo = CUSTO_ARROZ + CUSTO_FEIJAO + CUSTO_SUCOS + CUSTO_BASE;
              
              // Orçamento disponível para categorias dinâmicas
              const orcamentoDinamico = budgetPerMeal - custoFixo;
              
              // Usar peso específico da categoria (sistema ponderado)
              const pesoCategoria = PESOS_ORCAMENTO[categoria] || 0.10;
              const limiteBase = orcamentoDinamico * pesoCategoria;
              
              // Permitir 30% de flexibilidade para cada categoria (ajustado para realismo de custos)
              const limiteMaximo = limiteBase * 1.3;
              
              console.log(
                `💰 Orçamento ${categoria}: Peso ${(pesoCategoria * 100).toFixed(0)}% | ` +
                `Base R$ ${limiteBase.toFixed(2)} | Limite R$ ${limiteMaximo.toFixed(2)}`
              );
              
              if (receitaCalculada.custo_por_porcao > limiteMaximo) {
                console.log(
                  `${categoria}: ${receitaCalculada.nome} REJEITADA POR ORÇAMENTO - ` +
                  `R$ ${receitaCalculada.custo_por_porcao.toFixed(2)} > R$ ${limiteMaximo.toFixed(2)} (limite)`
                );
                
                // Registrar estatística
                estatisticas.receitas_rejeitadas_por_orcamento++;
                
                // Remover do pool
                const index = receitasFiltradas.findIndex(r => r.receita_id_legado === receitaSelecionada.receita_id_legado);
                if (index > -1) receitasFiltradas.splice(index, 1);
                continue;
              }
            }

            // FILTROS ADICIONAIS ESPECÍFICOS POR CATEGORIA
            
            // Sobremesas: rejeitar se muito caras
            if (categoria === 'Sobremesa' && receitaCalculada.custo_por_porcao > 2.50) {
              console.log(`${categoria}: ${receitaCalculada.nome} rejeitada por custo alto (R$ ${receitaCalculada.custo_por_porcao.toFixed(2)})`);
              continue;
            }

            // 🔥 PROTEÍNAS: GARANTIR QUE SEJAM DIFERENTES
            if (categoria.includes('Prato Principal')) {
              // Verificar se é produto pré-pronto (tem menos ingredientes naturalmente)
              const ehPrePronto = ehReceitaComPrePronto(receitaCalculada.ingredientes_detalhes || []);
              const minimoIngredientes = ehPrePronto ? 3 : 4;
              
              // Rejeitar se tem muito poucos ingredientes (receita incompleta)
              if (receitaCalculada.ingredientes_total < minimoIngredientes) {
                console.log(
                  `${categoria}: ${receitaCalculada.nome} rejeitada - poucos ingredientes ` +
                  `(${receitaCalculada.ingredientes_total}/${minimoIngredientes})${ehPrePronto ? ' [pré-pronto]' : ''}`
                );
                continue;
              }

              // Log para auditoria
              if (ehPrePronto) {
                console.log(`🍔 Produto pré-pronto detectado: mínimo ajustado para 3 ingredientes`);
              }

              // Rejeitar se custo muito baixo (falta proteína principal)
              if (receitaCalculada.custo_por_porcao < 0.80) {
                console.log(`${categoria}: ${receitaCalculada.nome} rejeitada - custo muito baixo, falta proteína principal`);
                continue;
              }
              
              // 🔥 GARANTIR PROTEÍNAS DIFERENTES NO MESMO DIA
              // Detectar tipo de proteína (frango, carne, peixe, etc)
              const nomeUpper = receitaCalculada.nome.toUpperCase();
              let tipoProteina = 'OUTRA';
              
              if (nomeUpper.includes('FRANGO') || nomeUpper.includes('GALINHA') || nomeUpper.includes('PEITO') || 
                  nomeUpper.includes('COXA') || nomeUpper.includes('SOBRECOXA') || nomeUpper.includes('ASA')) {
                tipoProteina = 'FRANGO';
              } else if (nomeUpper.includes('BOVINA') || nomeUpper.includes('CARNE') || nomeUpper.includes('BIFE') ||
                         nomeUpper.includes('ALCATRA') || nomeUpper.includes('PATINHO') || nomeUpper.includes('CUPIM') ||
                         nomeUpper.includes('COSTELA') || nomeUpper.includes('MOÍDA')) {
                tipoProteina = 'BOVINA';
              } else if (nomeUpper.includes('PEIXE') || nomeUpper.includes('TILÁPIA') || nomeUpper.includes('MERLUZA') ||
                         nomeUpper.includes('PESCADA') || nomeUpper.includes('SALMÃO')) {
                tipoProteina = 'PEIXE';
              } else if (nomeUpper.includes('PORCO') || nomeUpper.includes('SUÍNO') || nomeUpper.includes('LOMBO') ||
                         nomeUpper.includes('PERNIL') || nomeUpper.includes('BISTECA') || nomeUpper.includes('COSTELINHA')) {
                tipoProteina = 'PORCO';
              } else if (nomeUpper.includes('OVO')) {
                tipoProteina = 'OVO';
              }
              
              // Se já temos uma proteína deste tipo hoje, rejeitar
              if (proteinasUsadasHoje.has(tipoProteina)) {
                console.log(
                  `${categoria}: ${receitaCalculada.nome} REJEITADA - ` +
                  `proteína ${tipoProteina} já usada hoje (PP1 e PP2 devem ser diferentes)`
                );
                
                // Remover do pool para não tentar novamente
                const index = receitasFiltradas.findIndex(r => r.receita_id_legado === receitaSelecionada.receita_id_legado);
                if (index > -1) receitasFiltradas.splice(index, 1);
                continue;
              }
              
              // Se passou, registrar tipo de proteína
              console.log(`${categoria}: ${receitaCalculada.nome} - Tipo de proteína: ${tipoProteina}`);
            }

            // Guarnições: verificar se não é apenas tempero
            if (categoria === 'Guarnição' && receitaCalculada.custo_por_porcao < 0.10) {
              console.log(`${categoria}: ${receitaCalculada.nome} rejeitada - possivelmente apenas temperos`);
              continue;
            }

            // Se chegou até aqui, receita é válida
            receitaValida = receitaCalculada;
            receitasUsadas.add(receitaSelecionada.receita_id_legado);
            
            // 🔥 REGISTRAR TIPO DE PROTEÍNA SE FOR PRATO PRINCIPAL
            if (categoria.includes('Prato Principal')) {
              const nomeUpper = receitaCalculada.nome.toUpperCase();
              let tipoProteina = 'OUTRA';
              
              if (nomeUpper.includes('FRANGO') || nomeUpper.includes('GALINHA') || nomeUpper.includes('PEITO') || 
                  nomeUpper.includes('COXA') || nomeUpper.includes('SOBRECOXA') || nomeUpper.includes('ASA')) {
                tipoProteina = 'FRANGO';
              } else if (nomeUpper.includes('BOVINA') || nomeUpper.includes('CARNE') || nomeUpper.includes('BIFE') ||
                         nomeUpper.includes('ALCATRA') || nomeUpper.includes('PATINHO') || nomeUpper.includes('CUPIM') ||
                         nomeUpper.includes('COSTELA') || nomeUpper.includes('MOÍDA')) {
                tipoProteina = 'BOVINA';
              } else if (nomeUpper.includes('PEIXE') || nomeUpper.includes('TILÁPIA') || nomeUpper.includes('MERLUZA') ||
                         nomeUpper.includes('PESCADA') || nomeUpper.includes('SALMÃO')) {
                tipoProteina = 'PEIXE';
              } else if (nomeUpper.includes('PORCO') || nomeUpper.includes('SUÍNO') || nomeUpper.includes('LOMBO') ||
                         nomeUpper.includes('PERNIL') || nomeUpper.includes('BISTECA') || nomeUpper.includes('COSTELINHA')) {
                tipoProteina = 'PORCO';
              } else if (nomeUpper.includes('OVO')) {
                tipoProteina = 'OVO';
              }
              
              proteinasUsadasHoje.add(tipoProteina);
            }
            
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
        
        // 🔥 VALIDAÇÃO CRÍTICA: GARANTIR QUE TODAS AS CATEGORIAS FORAM GERADAS
        const categoriasObrigatorias = [
          'Prato Principal 1', 'Prato Principal 2', 
          'Guarnição', 'Salada 1', 'Salada 2', 
          'Sobremesa', 'Suco 1', 'Suco 2'
        ];
        
        const categoriasFaltando = categoriasObrigatorias.filter(cat => 
          !receitasDia.some(r => r.categoria === cat)
        );
        
        if (categoriasFaltando.length > 0) {
          console.error(`❌❌❌ FALHA CRÍTICA - CATEGORIAS FALTANDO em ${nomeDia}:`, categoriasFaltando);
          throw new Error(
            `Dia incompleto: ${nomeDia} está sem ${categoriasFaltando.join(', ')}. ` +
            `Verifique se há receitas suficientes no banco para estas categorias.`
          );
        }

        // Ordenar receitas por ordem
        receitasDia.sort((a, b) => (a.ordem || 20) - (b.ordem || 20));

        // 🔥 INFO DO DIA (não validar orçamento por dia, apenas informar)
        const diferencaOrcamentoDia = budgetPerMeal ? custoTotalDia - budgetPerMeal : 0;

        cardapio.push({
          dia: nomeDia,
          receitas: receitasDia,
          custo_total_dia: custoTotalDia,
          custo_por_porcao: custoTotalDia,
          total_receitas: receitasDia.length,
          receitas_validadas: receitasDia.filter(r => r.validacao?.valida).length,
          // Info de orçamento diário (apenas para referência, não bloqueia)
          orcamento_referencia_dia: budgetPerMeal,
          diferenca_orcamento_dia: diferencaOrcamentoDia,
          sucos_info: {
            suco1_tipo: receitasDia.find(r => r.categoria === 'Suco 1')?.tipo_suco || 'Não selecionado',
            suco2_tipo: receitasDia.find(r => r.categoria === 'Suco 2')?.tipo_suco || 'Não selecionado'
          }
        });

        // 🔥 LOG MELHORADO
        const statusInfo = budgetPerMeal 
          ? `(ref. orçamento dia: R$ ${budgetPerMeal.toFixed(2)}, diferença: R$ ${diferencaOrcamentoDia > 0 ? '+' : ''}${diferencaOrcamentoDia.toFixed(2)})` 
          : '';

        console.log(`${nomeDia}: ${receitasDia.length} receitas, R$ ${custoTotalDia.toFixed(2)} por porção ${statusInfo}`);
      }
      
      // 🔥 VALIDAÇÃO DE ORÇAMENTO TOTAL DO PERÍODO (NÃO POR DIA)
      const custoTotalPeriodo = cardapio.reduce((sum, dia) => 
        sum + (dia.custo_total_dia * porcoesPorDia), 0
      );
      
      const orcamentoTotalPeriodo = budgetPerMeal 
        ? budgetPerMeal * porcoesPorDia * cardapio.length 
        : null;
      
      const dentroOrcamentoTotal = orcamentoTotalPeriodo 
        ? custoTotalPeriodo <= orcamentoTotalPeriodo 
        : true;
      
      const diferencaOrcamentoTotal = orcamentoTotalPeriodo 
        ? custoTotalPeriodo - orcamentoTotalPeriodo 
        : 0;
      
      // 🔥 LOG DE ORÇAMENTO TOTAL
      if (budgetPerMeal) {
        console.log('\n=== VALIDAÇÃO DE ORÇAMENTO TOTAL DO PERÍODO ===');
        console.log(`Orçamento Total: R$ ${orcamentoTotalPeriodo?.toFixed(2)}`);
        console.log(`Custo Total: R$ ${custoTotalPeriodo.toFixed(2)}`);
        console.log(`Diferença: R$ ${diferencaOrcamentoTotal > 0 ? '+' : ''}${diferencaOrcamentoTotal.toFixed(2)}`);
        console.log(`Status: ${dentroOrcamentoTotal ? '✅ DENTRO DO ORÇAMENTO' : '⚠️ ACIMA DO ORÇAMENTO'}`);
        console.log('===============================================\n');
      }

      return {
        cardapio: cardapio,
        resumo: {
          dias_gerados: cardapio.length,
          porcoes_por_dia: porcoesPorDia,
          custo_medio_por_porcao: cardapio.reduce((acc, dia) => acc + dia.custo_por_porcao, 0) / cardapio.length,
          // 🔥 ORÇAMENTO TOTAL DO PERÍODO (PRINCIPAL)
          orcamento_total_periodo: orcamentoTotalPeriodo,
          custo_total_periodo: custoTotalPeriodo,
          dentro_orcamento_total: dentroOrcamentoTotal,
          diferenca_orcamento_total: diferencaOrcamentoTotal,
          // Detalhamento diário (para referência)
          detalhamento_diario: cardapio.map(d => ({
            dia: d.dia,
            custo: d.custo_total_dia,
            receitas: d.receitas.length,
            diferenca_referencia: d.diferenca_orcamento_dia
          })),
          // Info adicional
          orcamento_configurado_por_refeicao: budgetPerMeal,
          qualidade: {
            total_receitas_testadas: estatisticas.total_receitas_testadas,
            receitas_rejeitadas: estatisticas.receitas_rejeitadas_por_criterios,
            receitas_rejeitadas_por_orcamento: estatisticas.receitas_rejeitadas_por_orcamento,
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
        maxTentativasPorCategoria: requestData.max_tentativas || 25,
        budgetPerMeal: requestData.orcamento_por_refeicao || null, // 🔥 ORÇAMENTO
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
              critica: 0,
              alta: 0,
              media: 0,
              baixa: 0
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
                custo_por_porcao: 0,
                validacao: {
                  valida: false,
                  score_qualidade: 0,
                  severidade: 'critica'
                },
                problemas_detectados: [{
                  tipo: 'erro',
                  descricao: 'Erro no cálculo - receita sem dados válidos',
                  severidade: 'critica'
                }],
                ingredientes: {
                  total: 0,
                  com_preco: 0,
                  sem_preco: 0,
                  principais: []
                }
              });
              relatorioCategoria.estatisticas.problemas_por_severidade.critica++;
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
              const severidade = (resultado.validacao.severidade || 'media').toLowerCase();
              problemas.push({
                tipo: 'validacao',
                severidade: severidade,
                descricao: resultado.validacao.motivo
              });
              relatorioCategoria.estatisticas.problemas_por_severidade[severidade]++;
            }
            
            // 2. Custo fora da faixa
            if (resultado.custo_por_porcao < criterios.custo_minimo) {
              problemas.push({
                tipo: 'custo_baixo',
                severidade: 'alta',
                descricao: `Custo muito baixo: R$ ${resultado.custo_por_porcao.toFixed(2)} (mínimo R$ ${criterios.custo_minimo.toFixed(2)})`,
                possivel_causa: 'Faltam ingredientes ou preços incorretos no banco'
              });
              relatorioCategoria.estatisticas.problemas_por_severidade.alta++;
            }
            
            if (resultado.custo_por_porcao > criterios.custo_maximo) {
              problemas.push({
                tipo: 'custo_alto',
                severidade: 'media',
                descricao: `Custo muito alto: R$ ${resultado.custo_por_porcao.toFixed(2)} (máximo R$ ${criterios.custo_maximo.toFixed(2)})`,
                possivel_causa: 'Preços inflacionados, unidades incorretas ou produtos prontos caros'
              });
              relatorioCategoria.estatisticas.problemas_por_severidade.media++;
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
                  severidade: 'critica',
                  descricao: `Falta ingrediente principal esperado para ${categoria}`,
                  possivel_causa: 'Receita incompleta ou mal categorizada',
                  ingredientes_esperados: criterios.ingredientes_obrigatorios.slice(0, 10)
                });
                relatorioCategoria.estatisticas.problemas_por_severidade.critica++;
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
                  severidade: 'critica',
                  descricao: 'Receita contém apenas temperos/condimentos básicos',
                  possivel_causa: 'Receita incompleta ou erro de cadastro'
                });
                relatorioCategoria.estatisticas.problemas_por_severidade.critica++;
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
              custo_por_porcao: 0,
              validacao: {
                valida: false,
                score_qualidade: 0,
                severidade: 'critica'
              },
              problemas_detectados: [{
                tipo: 'erro',
                descricao: `Erro na auditoria: ${error.message}`,
                severidade: 'critica'
              }],
              ingredientes: {
                total: 0,
                com_preco: 0,
                sem_preco: 0,
                principais: []
              }
            });
            relatorioCategoria.estatisticas.problemas_por_severidade.critica++;
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