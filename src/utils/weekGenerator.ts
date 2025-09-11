import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Gera a estrutura de semanas a partir de um período de datas
 * @param startDate Data de início do período
 * @param endDate Data de fim do período
 * @param incluirFDS Flag que indica se deve incluir sábados e domingos
 * @returns Estrutura de semanas com dias e espaço para receitas
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
  
  // Criar uma cópia da data final e definir para final do dia
  const endDateCopy = new Date(endDate);
  endDateCopy.setHours(23, 59, 59, 999);

  while (currentDate <= endDateCopy) {
    const diaSemana = currentDate.getDay(); // 0=Dom, 1=Seg, ...
    
    // Pular finais de semana se não incluídos
    if (!incluirFDS && (diaSemana === 0 || diaSemana === 6)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    // Formatar a data para exibição
    const diaNome = format(currentDate, 'EEEE', { locale: ptBR });
    const dataFormatada = format(currentDate, 'yyyy-MM-dd');
    
    // Adicionar o dia à semana atual
    semanaAtual.push({
      dia: diaNome, // Já vem capitalizado do date-fns com locale ptBR
      data: dataFormatada,
      receitas: [] // Será preenchido posteriormente
    });

    // Determinar se devemos fechar a semana
    const isEndOfWeek = 
      (!incluirFDS && diaSemana === 5) || // Sexta se não incluir fins de semana
      (incluirFDS && diaSemana === 0);    // Domingo se incluir fins de semana

    if (isEndOfWeek) {
      semanas[`Semana ${semanaCount}`] = semanaAtual;
      semanaCount++;
      semanaAtual = [];
    }

    // Avançar para o próximo dia
    currentDate = addDays(currentDate, 1);
  }

  // Adicionar quaisquer dias restantes como a última semana
  if (semanaAtual.length > 0) {
    semanas[`Semana ${semanaCount}`] = semanaAtual;
  }

  return semanas;
}