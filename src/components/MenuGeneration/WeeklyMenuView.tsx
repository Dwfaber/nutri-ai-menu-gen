import React, { useState } from "react";
import { GeneratedMenu } from "@/hooks/useIntegratedMenuGeneration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekNavigator } from "./WeekNavigator";

interface WeeklyMenuViewProps {
  menu: GeneratedMenu;
}

// ✅ Mapeamento entre nomes do backend e códigos da UI
const CATEGORY_MAPPING: Record<string, string> = {
  "Proteína Principal 1": "PP1",
  "Prato Principal 1": "PP1", // sinônimo
  "Proteína Principal 2": "PP2",
  "Prato Principal 2": "PP2", // sinônimo
  "Arroz Branco": "Arroz Branco",
  "Feijão": "Feijão",
  "Guarnição": "Guarnição",
  "Salada 1 (Verduras)": "Salada 1",
  "Salada 2 (Legumes)": "Salada 2",
  "Salada": "Salada 1", // fallback, se vier genérico
  "Suco 1": "Suco 1",
  "Suco 2": "Suco 2",
  "Suco": "Suco 1", // fallback, se vier genérico
  "Sobremesa": "Sobremesa",
};

// ✅ Definimos as categorias fixas que SEMPRE devem aparecer
const CATEGORIAS_FIXAS = [
  "PP1",
  "PP2", 
  "Arroz Branco",
  "Feijão",
  "Guarnição",
  "Salada 1",
  "Salada 2",
  "Suco 1",
  "Suco 2",
  "Sobremesa",
];

export const WeeklyMenuView: React.FC<WeeklyMenuViewProps> = ({ menu }) => {
  if (!menu?.recipes?.length && !menu?.menu?.semanas) {
    return <p>Nenhuma receita encontrada para este cardápio.</p>;
  }

  const [semanaAtual, setSemanaAtual] = useState(1);

  // 📊 NOVA LÓGICA: Usar estrutura de semanas do backend se disponível
  if (menu?.menu?.semanas) {
    const semanas = menu.menu.semanas;
    const totalSemanas = Object.keys(semanas).length;
    
    console.log('📊 Usando nova estrutura por semanas:', semanas);
    console.log('📈 Total de semanas disponíveis:', totalSemanas);

    return (
      <div className="space-y-6">
        <WeekNavigator
          currentWeek={semanaAtual}
          totalWeeks={totalSemanas}
          onWeekChange={setSemanaAtual}
        />
        
        {totalSemanas > 1 && (
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-muted-foreground">
              Semana {semanaAtual} - {menu.clientName}
            </h3>
          </div>
        )}
        
        {semanas[`Semana ${semanaAtual}`]?.map((dia: any) => (
          <Card key={dia.dia} className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{dia.dia}</CardTitle>
              {dia.data && (
                <p className="text-sm text-muted-foreground">{dia.data}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {dia.receitas?.map((receita: any) => (
                  <div
                    key={receita.id || receita.nome}
                    className="border rounded p-2 shadow-sm bg-card"
                  >
                    <p className="font-semibold text-foreground">{receita.categoria}</p>
                    <p className="text-foreground">{receita.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Custo: R$ {Number(receita.custo_total || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Por porção: R$ {Number(receita.custo_por_refeicao || 0).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              {dia.resumo_dia && (
                <div className="mt-4 p-3 bg-muted rounded">
                  <p className="text-sm font-semibold">Resumo do Dia:</p>
                  <p className="text-sm">Total de receitas: {dia.resumo_dia.total_receitas}</p>
                  <p className="text-sm">Custo total: R$ {dia.resumo_dia.custo_total}</p>
                  <p className="text-sm">Custo por refeição: R$ {dia.resumo_dia.custo_por_refeicao}</p>
                  <p className={`text-sm ${dia.resumo_dia.dentro_orcamento ? 'text-green-600' : 'text-red-600'}`}>
                    {dia.resumo_dia.dentro_orcamento ? '✅ Dentro do orçamento' : '❌ Acima do orçamento'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // 🔄 LÓGICA LEGADA: Para compatibilidade com estrutura antiga
  // 🔎 Agrupar receitas por dia com mapeamento de categorias
  console.log('🍽️ Total de receitas:', menu.recipes.length);
  console.log('🍽️ Primeira receita:', menu.recipes[0]);
  
  // 🔍 Debug: Mostrar todas as categorias únicas encontradas
  const categoriasEncontradas = [...new Set(menu.recipes.map(r => r.category))];
  console.log('📋 Categorias encontradas no backend:', categoriasEncontradas);
  
  const receitasPorDia = menu.recipes.reduce((acc: any, r) => {
    if (!acc[r.day]) acc[r.day] = {};
    
    // 🔧 Mapeia categoria do backend para código da UI
    const categoriaMapeada = CATEGORY_MAPPING[r.category] || r.category;
    
    // 🔍 Debug: Log do mapeamento de cada receita
    console.log(`🔄 Receita: ${r.name} | Categoria original: ${r.category} | Categoria mapeada: ${categoriaMapeada} | Dia: ${r.day}`);
    
    // 🔧 CORREÇÃO: Permitir múltiplas receitas por categoria usando arrays
    if (!acc[r.day][categoriaMapeada]) {
      acc[r.day][categoriaMapeada] = [];
    }
    
    // Adicionar receita ao array da categoria
    acc[r.day][categoriaMapeada].push(r);
    
    return acc;
  }, {});

  // Definir ordem dos dias da semana
  const DIAS_ORDEM = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira', 
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo'
  ];

  // Agrupar dias por semanas (7 dias cada)
  const diasDisponiveis = Object.keys(receitasPorDia).sort((a, b) => {
    const indexA = DIAS_ORDEM.indexOf(a);
    const indexB = DIAS_ORDEM.indexOf(b);
    return indexA - indexB;
  });

  const semanas: Record<number, string[]> = {};
  diasDisponiveis.forEach((dia, index) => {
    const numeroSemana = Math.floor(index / 7) + 1;
    if (!semanas[numeroSemana]) {
      semanas[numeroSemana] = [];
    }
    semanas[numeroSemana].push(dia);
  });

  const totalSemanas = Object.keys(semanas).length;

  // 🔍 Debug: Mostrar estrutura detalhada dos dados agrupados
  console.log('🗓️ Dias disponíveis:', diasDisponiveis);
  console.log('📊 Semanas agrupadas:', semanas);
  console.log('📈 Total de semanas:', totalSemanas);
  console.log('🏗️ Estrutura completa receitasPorDia:', receitasPorDia);
  
  // 🔍 Debug: Verificar especificamente PP1 e PP2 em cada dia
  Object.keys(receitasPorDia).forEach(dia => {
    const categoriasDoDia = Object.keys(receitasPorDia[dia]);
    console.log(`📅 ${dia} - Categorias encontradas:`, categoriasDoDia);
    if (receitasPorDia[dia]['PP1']) console.log(`  ✅ PP1: ${receitasPorDia[dia]['PP1'].length} receitas`);
    if (receitasPorDia[dia]['PP2']) console.log(`  ✅ PP2: ${receitasPorDia[dia]['PP2'].length} receitas`);
    if (!receitasPorDia[dia]['PP1']) console.log(`  ❌ PP1: Não encontrada`);
    if (!receitasPorDia[dia]['PP2']) console.log(`  ❌ PP2: Não encontrada`);
  });

  // Obter dias da semana atual
  const diasSemanaAtual = semanas[semanaAtual] || [];

  return (
    <div className="space-y-6">
      <WeekNavigator
        currentWeek={semanaAtual}
        totalWeeks={totalSemanas}
        onWeekChange={setSemanaAtual}
      />
      
      {totalSemanas > 1 && (
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-muted-foreground">
            Semana {semanaAtual} - {menu.clientName}
          </h3>
        </div>
      )}
      
      {diasSemanaAtual.map((dia) => {
        const categorias = receitasPorDia[dia];
        return (
          <Card key={dia} className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{dia}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {CATEGORIAS_FIXAS.map((cat) => {
                  const receitasArray = (categorias as any)[cat];
                  // 🔧 CORREÇÃO: Pegar a primeira receita do array
                  const receita = Array.isArray(receitasArray) ? receitasArray[0] : receitasArray;
                  
                  return (
                    <div
                      key={cat}
                      className="border rounded p-2 shadow-sm bg-card"
                    >
                      <p className="font-semibold text-foreground">{cat}</p>
                      {receita ? (
                        <>
                          <p className="text-foreground">{receita.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Custo: R$ {Number(receita.cost || 0).toFixed(2)}
                          </p>
                          {/* 🔍 Debug: Mostrar quantas receitas existem para esta categoria */}
                          {Array.isArray(receitasArray) && receitasArray.length > 1 && (
                            <p className="text-xs text-blue-600">
                              +{receitasArray.length - 1} outras opções
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground italic">Não disponível</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};