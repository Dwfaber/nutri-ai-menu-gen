// Utility functions for converting null values to undefined for type compatibility

export function mapNullToUndefined<T extends Record<string, any>>(obj: T): T {
  const result = {} as T;
  
  Object.keys(obj).forEach(key => {
    result[key as keyof T] = obj[key] === null ? undefined : obj[key];
  });
  
  return result;
}

export function mapArrayNullToUndefined<T extends Record<string, any>>(arr: T[]): T[] {
  return arr.map(mapNullToUndefined);
}

// Specific mapping functions for common data types
export function mapProductRequest(item: any) {
  return {
    ...item,
    solicitacao_id: item.solicitacao_id ?? undefined,
    categoria_descricao: item.categoria_descricao ?? undefined,
    grupo: item.grupo ?? undefined,
    preco: item.preco ?? undefined,
    descricao: item.descricao ?? undefined,
    unidade: item.unidade ?? undefined,
    criado_em: item.criado_em ?? undefined
  };
}

export function mapMarketProduct(item: any) {
  return {
    ...item,
    solicitacao_id: item.solicitacao_id ?? undefined,
    categoria_descricao: item.categoria_descricao ?? undefined,
    grupo: item.grupo ?? undefined,
    produto_id: item.produto_id ?? undefined,
    preco: item.preco ?? undefined
  };
}

export function mapMarketIngredient(item: any) {
  return {
    ...item,
    produto_base_id: item.produto_base_id ?? 0,
    descricao: item.descricao ?? '',
    categoria_descricao: item.categoria_descricao ?? '',
    unidade: item.unidade ?? '',
    preco: item.preco ?? 0,
    produto_base_quantidade_embalagem: item.produto_base_quantidade_embalagem ?? 1,
    em_promocao_sim_nao: item.em_promocao_sim_nao ?? false
  };
}