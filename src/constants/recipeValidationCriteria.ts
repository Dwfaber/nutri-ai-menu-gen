/**
 * Critérios de validação de receitas por categoria
 * Compartilhado entre frontend e edge functions
 */

export const CRITERIOS_AVALIACAO = {
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
} as const;

export type CriterioCategoria = typeof CRITERIOS_AVALIACAO[keyof typeof CRITERIOS_AVALIACAO];
