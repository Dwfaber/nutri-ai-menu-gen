import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '@supabase/supabase-js';

/**
 * Criação do cliente Supabase (ajuste se já existir em outro helper do projeto)
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Estrutura de semanas com dias
 */
export function gerarSemanas(
  startDate: Date,
  endDate: Date,
  incluirFDS: boolean = false
): Record<string, any[]> {
  const semanas: Record<string, any[]> = {};
  let currentDate = new Date(startDate);
  let semanaCount = 1;
  let semanaAtual: any[] = [];

  // Garantir que as datas estejam no início do dia
  currentDate.setHours(0, 0, 0, 0);
  
  // Copiar data final e setar pro fim do dia
  const endDateCopy = new Date(endDate);
  endDateCopy.setHours(23, 59, 59, 999);

  while (currentDate <= endDateCopy) {
    const diaSemana = currentDate.getDay(); // 0=Dom, 1=Seg

    if (!incluirFDS && (diaSemana === 0 || diaSemana === 6)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const diaNome = format(currentDate, 'EEEE', { locale: ptBR });
    const dataFormatada = format(currentDate, 'yyyy-MM-dd');

    semanaAtual.push({
      dia: diaNome,
      data: dataFormatada,
      receitas: [] // preenchidas depois
    });

    const isEndOfWeek = 
      (!incluirFDS && diaSemana === 5) || // sexta 
      (incluirFDS && diaSemana === 0);    // domingo

    if (isEndOfWeek) {
      semanas[`Semana ${semanaCount}`] = semanaAtual;
      semanaCount++;
      semanaAtual = [];
    }

    currentDate = addDays(currentDate, 1);
  }

  if (semanaAtual.length > 0) {
    semanas[`Semana ${semanaCount}`] = semanaAtual;
  }

  return semanas;
}

// ======================================
// Categorias para seleção automática
// ======================================

const CATEGORIAS_PRINCIPAIS = ["PROTEÍNA", "PRATO PRINCIPAL", "PP1", "PP2"];
const CATEGORIAS_ACOMPANHAMENTOS = ["GUARNIÇÃO", "SALADA 1", "SALADA 2", "SUCO 1", "SUCO 2", "SOBREMESA"];

/**
 * Buscar todas as receitas disponíveis no banco (pode otimizar por categoria)
 */
async function buscarReceitasDisponiveis() {
  const { data, error } = await supabase
    .from('receita_ingredientes')
    .select('receita_id_legado, categoria_descricao, nome')
    .not('categoria_descricao', 'is', null);

  if (error) {
    console.error("Erro ao buscar receitas:", error);
    return [];
  }
  return data || [];
}

/**
 * Preenche automaticamente as receitas_sugeridas da semana
 * @param semanas Estrutura gerada
 */
export async function preencherReceitasSugeridas(
  semanas: Record<string, any[]>
) {
  const receitasDisponiveis = await buscarReceitasDisponiveis();
  const receitasSugeridas: any[] = [];

  Object.values(semanas).forEach((dias: any[]) => {
    dias.forEach((dia) => {
      // selecionar dinamicamente uma de cada categoria (simples, pode evoluir com regras de variedade)
      
      // Proteína
      const proteina = receitasDisponiveis.find(r =>
        CATEGORIAS_PRINCIPAIS.includes(r.categoria_descricao?.toUpperCase())
      );

      // Guarnição
      const guarnicao = receitasDisponiveis.find(r => r.categoria_descricao?.toUpperCase() === "GUARNIÇÃO");
      // Saladas
      const salada1 = receitasDisponiveis.find(r => r.categoria_descricao?.toUpperCase() === "SALADA 1");
      const salada2 = receitasDisponiveis.find(r => r.categoria_descricao?.toUpperCase() === "SALADA 2");
      // Sucos
      const suco1 = receitasDisponiveis.find(r => r.categoria_descricao?.toUpperCase() === "SUCO 1");
      const suco2 = receitasDisponiveis.find(r => r.categoria_descricao?.toUpperCase() === "SUCO 2");
      // Sobremesa
      const sobremesa = receitasDisponiveis.find(r => r.categoria_descricao?.toUpperCase() === "SOBREMESA");

      [proteina, guarnicao, salada1, salada2, suco1, suco2, sobremesa].forEach(r => {
        if (r) {
          receitasSugeridas.push({
            id: r.receita_id_legado,
            categoria: r.categoria_descricao,
            dia: dia.dia,
            nome: r.nome
          });
        }
      });
    });
  });

  return receitasSugeridas;
}