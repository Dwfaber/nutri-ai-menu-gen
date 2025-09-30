// Constantes de categorias de menu para padronização em todo o sistema
export const MENU_CATEGORIES = {
  BASE: 'Base',
  PRINCIPAL_1: 'Prato Principal 1',
  PRINCIPAL_2: 'Prato Principal 2',
  GUARNICAO: 'Guarnição',
  SALADA_1: 'Salada 1',
  SALADA_2: 'Salada 2',
  SUCO_1: 'Suco 1',
  SUCO_2: 'Suco 2',
  SOBREMESA: 'Sobremesa'
} as const;

export const CATEGORY_ORDER = [
  MENU_CATEGORIES.BASE,
  MENU_CATEGORIES.PRINCIPAL_1,
  MENU_CATEGORIES.PRINCIPAL_2,
  MENU_CATEGORIES.GUARNICAO,
  MENU_CATEGORIES.SALADA_1,
  MENU_CATEGORIES.SALADA_2,
  MENU_CATEGORIES.SUCO_1,
  MENU_CATEGORIES.SUCO_2,
  MENU_CATEGORIES.SOBREMESA
] as const;

// Mapeamento de códigos do backend para categorias padronizadas
export const CATEGORY_CODE_MAPPING: Record<string, string> = {
  'BASE': MENU_CATEGORIES.BASE,
  'PP1': MENU_CATEGORIES.PRINCIPAL_1,
  'PP2': MENU_CATEGORIES.PRINCIPAL_2,
  'GUARNICAO': MENU_CATEGORIES.GUARNICAO,
  'SALADA1': MENU_CATEGORIES.SALADA_1,
  'SALADA2': MENU_CATEGORIES.SALADA_2,
  'SUCO1': MENU_CATEGORIES.SUCO_1,
  'SUCO2': MENU_CATEGORIES.SUCO_2,
  'SOBREMESA': MENU_CATEGORIES.SOBREMESA
};

// Mapeamento de nomes de categorias do backend para categorias padronizadas
export const CATEGORY_NAME_MAPPING: Record<string, string> = {
  // Categorias base
  'Base': MENU_CATEGORIES.BASE,
  'base': MENU_CATEGORIES.BASE,
  'BASE': MENU_CATEGORIES.BASE,
  
  // Pratos principais
  'Prato Principal 1': MENU_CATEGORIES.PRINCIPAL_1,
  'prato principal 1': MENU_CATEGORIES.PRINCIPAL_1,
  'PRATO PRINCIPAL 1': MENU_CATEGORIES.PRINCIPAL_1,
  'PP1': MENU_CATEGORIES.PRINCIPAL_1,
  'pp1': MENU_CATEGORIES.PRINCIPAL_1,
  
  'Prato Principal 2': MENU_CATEGORIES.PRINCIPAL_2,
  'prato principal 2': MENU_CATEGORIES.PRINCIPAL_2,
  'PRATO PRINCIPAL 2': MENU_CATEGORIES.PRINCIPAL_2,
  'PP2': MENU_CATEGORIES.PRINCIPAL_2,
  'pp2': MENU_CATEGORIES.PRINCIPAL_2,
  
  // Guarnição
  'Guarnição': MENU_CATEGORIES.GUARNICAO,
  'guarnicao': MENU_CATEGORIES.GUARNICAO,
  'GUARNICAO': MENU_CATEGORIES.GUARNICAO,
  'Guarnicao': MENU_CATEGORIES.GUARNICAO,
  
  // Saladas
  'Salada 1': MENU_CATEGORIES.SALADA_1,
  'salada 1': MENU_CATEGORIES.SALADA_1,
  'SALADA 1': MENU_CATEGORIES.SALADA_1,
  'SALADA1': MENU_CATEGORIES.SALADA_1,
  'salada1': MENU_CATEGORIES.SALADA_1,
  
  'Salada 2': MENU_CATEGORIES.SALADA_2,
  'salada 2': MENU_CATEGORIES.SALADA_2,
  'SALADA 2': MENU_CATEGORIES.SALADA_2,
  'SALADA2': MENU_CATEGORIES.SALADA_2,
  'salada2': MENU_CATEGORIES.SALADA_2,
  
  // Sucos - Variações mais comuns
  'Suco 1': MENU_CATEGORIES.SUCO_1,
  'suco 1': MENU_CATEGORIES.SUCO_1,
  'SUCO 1': MENU_CATEGORIES.SUCO_1,
  'SUCO1': MENU_CATEGORIES.SUCO_1,
  'suco1': MENU_CATEGORIES.SUCO_1,
  'Suco': MENU_CATEGORIES.SUCO_1,
  'suco': MENU_CATEGORIES.SUCO_1,
  'SUCO': MENU_CATEGORIES.SUCO_1,
  
  'Suco 2': MENU_CATEGORIES.SUCO_2,
  'suco 2': MENU_CATEGORIES.SUCO_2,
  'SUCO 2': MENU_CATEGORIES.SUCO_2,
  'SUCO2': MENU_CATEGORIES.SUCO_2,
  'suco2': MENU_CATEGORIES.SUCO_2,
  
  // Sobremesa
  'Sobremesa': MENU_CATEGORIES.SOBREMESA,
  'sobremesa': MENU_CATEGORIES.SOBREMESA,
  'SOBREMESA': MENU_CATEGORIES.SOBREMESA
};

// Função utilitária para mapear categoria
export function mapCategory(categoria?: string, codigo?: string): string {
  // Primeiro, tenta mapear por código se disponível
  if (codigo && CATEGORY_CODE_MAPPING[codigo.toUpperCase()]) {
    return CATEGORY_CODE_MAPPING[codigo.toUpperCase()];
  }
  
  // Depois, tenta mapear por nome da categoria
  if (categoria && CATEGORY_NAME_MAPPING[categoria]) {
    return CATEGORY_NAME_MAPPING[categoria];
  }
  
  // Tenta mapeamento case-insensitive para categoria
  if (categoria) {
    const lowerCat = categoria.toLowerCase();
    for (const [key, value] of Object.entries(CATEGORY_NAME_MAPPING)) {
      if (key.toLowerCase() === lowerCat) {
        return value;
      }
    }
  }
  
  // Fallback para categoria original ou "Outros"
  return categoria || 'Outros';
}

// Função para verificar se uma receita é produto base
export function isBaseProduct(name: string, codigo?: string, categoria?: string): boolean {
  const normalizedName = name.toLowerCase();
  
  // Verifica por categoria primeiro
  if (categoria && mapCategory(categoria, codigo) === MENU_CATEGORIES.BASE) {
    return true;
  }
  
  // Verifica por código
  if (codigo && ['ARROZ', 'FEIJAO', 'CAFE', 'KIT'].some(baseCode => codigo.includes(baseCode))) {
    return true;
  }
  
  // Verifica por padrões de nome para produtos base do sistema legado
  return (
    normalizedName.includes('arroz') ||
    normalizedName.includes('feijão') ||
    normalizedName.includes('feijao') ||
    normalizedName.includes('café cortesia') ||
    normalizedName.includes('cafe cortesia') ||
    normalizedName.includes('kit descartáveis') ||
    normalizedName.includes('kit descartaveis') ||
    normalizedName.includes('kit limpeza') ||
    normalizedName.includes('kit tempero') ||
    normalizedName.includes('tempero de mesa') ||
    normalizedName.includes('mini filão') ||
    normalizedName.includes('mini filao') ||
    normalizedName.includes('acompanhamento')
  );
}