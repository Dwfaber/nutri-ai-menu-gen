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
        
        {/* Indicadores visuais de navegação */}
        <div className="flex justify-center mb-4">
          <div className="flex space-x-2">
            {semanas[`Semana ${semanaAtual}`]?.map((_, index) => (
              <div
                key={index}
                className="w-2 h-2 rounded-full bg-primary/30"
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground ml-3">
            {semanas[`Semana ${semanaAtual}`]?.length || 0} dias
          </p>
        </div>
        
        <div className="overflow-x-auto snap-x snap-mandatory">
          <div className="flex space-x-4 pb-4 snap-start" style={{ minWidth: 'max-content' }}>
            {semanas[`Semana ${semanaAtual}`]?.map((dia: any) => (
              <Card key={dia.dia} className="border shadow-sm flex-shrink-0 w-80 hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">{dia.dia}</CardTitle>
                  {dia.data && (
                    <p className="text-sm text-muted-foreground">{dia.data}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {dia.receitas?.map((receita: any) => (
                      <div
                        key={receita.id || receita.nome}
                        className="border rounded p-2 shadow-sm bg-card text-xs"
                      >
                        <p className="font-semibold text-foreground">{receita.categoria}</p>
                        <p className="text-foreground truncate">{receita.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          R$ {Number(receita.custo_total || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {dia.resumo_dia && (
                    <div className="mt-3 p-2 bg-muted rounded">
                      <p className="text-xs font-semibold">Resumo:</p>
                      <p className="text-xs">Receitas: {dia.resumo_dia.total_receitas}</p>
                      <p className="text-xs">Total: R$ {dia.resumo_dia.custo_total}</p>
                      <p className={`text-xs ${dia.resumo_dia.dentro_orcamento ? 'text-green-600' : 'text-red-600'}`}>
                        {dia.resumo_dia.dentro_orcamento ? '✅ OK' : '❌ Alto'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
      
      {/* Indicadores visuais de navegação */}
      <div className="flex justify-center mb-4">
        <div className="flex space-x-2">
          {diasSemanaAtual.map((_, index) => (
            <div
              key={index}
              className="w-2 h-2 rounded-full bg-primary/30"
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground ml-3">
          {diasSemanaAtual.length} dias
        </p>
      </div>
      
      <div className="overflow-x-auto snap-x snap-mandatory">
        <div className="flex space-x-4 pb-4 snap-start" style={{ minWidth: 'max-content' }}>
          {diasSemanaAtual.map((dia) => {
            const categorias = receitasPorDia[dia];
            return (
              <Card key={dia} className="border shadow-sm flex-shrink-0 w-80 hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">{dia}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIAS_FIXAS.map((cat) => {
                      const receitasArray = (categorias as any)[cat];
                      // 🔧 CORREÇÃO: Pegar a primeira receita do array
                      const receita = Array.isArray(receitasArray) ? receitasArray[0] : receitasArray;
                      
                      return (
                        <div
                          key={cat}
                          className="border rounded p-2 shadow-sm bg-card text-xs"
                        >
                          <p className="font-semibold text-foreground">{cat}</p>
                          {receita ? (
                            <>
                              <p className="text-foreground truncate">{receita.name}</p>
                              <p className="text-xs text-muted-foreground">
                                R$ {Number(receita.cost || 0).toFixed(2)}
                              </p>
                              {/* 🔍 Debug: Mostrar quantas receitas existem para esta categoria */}
                              {Array.isArray(receitasArray) && receitasArray.length > 1 && (
                                <p className="text-xs text-blue-600">
                                  +{receitasArray.length - 1} opções
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-muted-foreground italic">N/A</p>
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
      </div>
    </div>
  );
};