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
    const [diaAtual, setDiaAtual] = useState(0);
    
    const diasDaSemana = semanas[`Semana ${semanaAtual}`] || [];

    const irParaAnterior = () => {
      setDiaAtual((prev) => Math.max(prev - 1, 0));
    };

    const irParaProximo = () => {
      setDiaAtual((prev) => Math.min(prev + 1, diasDaSemana.length - 1));
    };

    const handleWeekChange = (newWeek: number) => {
      setSemanaAtual(newWeek);
      setDiaAtual(0); // Reset para primeiro dia da nova semana
    };
    
    console.log('📊 Usando nova estrutura por semanas:', semanas);
    console.log('📈 Total de semanas disponíveis:', totalSemanas);

    const diaAtivo = diasDaSemana[diaAtual];

    return (
      <div className="space-y-6">
        <WeekNavigator
          currentWeek={semanaAtual}
          totalWeeks={totalSemanas}
          onWeekChange={handleWeekChange}
        />
        
        <div className="text-center">
          <h3 className="text-lg font-semibold text-muted-foreground">
            Semana {semanaAtual} - {menu.clientName}
          </h3>
        </div>

        {/* Navegação de dias estilo Instagram */}
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={irParaAnterior}
            disabled={diaAtual === 0}
            className="p-2 rounded-full bg-muted disabled:opacity-40 hover:bg-muted/80 transition-colors"
          >
            ←
          </button>

          {/* Card único do dia ativo */}
          {diaAtivo && (
            <Card className="w-full max-w-2xl border shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-center">{diaAtivo.dia}</CardTitle>
                {diaAtivo.data && (
                  <p className="text-sm text-muted-foreground text-center">{diaAtivo.data}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {diaAtivo.receitas?.map((receita: any) => (
                    <div
                      key={receita.id || receita.nome}
                      className="border rounded p-3 shadow-sm bg-card"
                    >
                      <p className="font-semibold text-primary text-sm">{receita.categoria}</p>
                      <p className="text-foreground font-medium">{receita.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {Number(receita.custo_total || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
                {diaAtivo.resumo_dia && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-semibold">Resumo do Dia:</p>
                    <p className="text-sm">Receitas: {diaAtivo.resumo_dia.total_receitas}</p>
                    <p className="text-sm">Total: R$ {diaAtivo.resumo_dia.custo_total}</p>
                    <p className={`text-sm ${diaAtivo.resumo_dia.dentro_orcamento ? 'text-green-600' : 'text-red-600'}`}>
                      {diaAtivo.resumo_dia.dentro_orcamento ? '✅ Dentro do Orçamento' : '❌ Acima do Orçamento'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <button
            onClick={irParaProximo}
            disabled={diaAtual === diasDaSemana.length - 1}
            className="p-2 rounded-full bg-muted disabled:opacity-40 hover:bg-muted/80 transition-colors"
          >
            →
          </button>
        </div>

        {/* Indicadores estilo Instagram */}
        <div className="flex justify-center gap-2 mt-4">
          {diasDaSemana.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setDiaAtual(idx)}
              className={`w-2 h-2 rounded-full cursor-pointer transition-colors ${
                idx === diaAtual ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {diaAtual + 1} de {diasDaSemana.length} dias
          </p>
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
  const [diaAtual, setDiaAtual] = useState(0);

  const irParaAnterior = () => {
    setDiaAtual((prev) => Math.max(prev - 1, 0));
  };

  const irParaProximo = () => {
    setDiaAtual((prev) => Math.min(prev + 1, diasSemanaAtual.length - 1));
  };

  const handleWeekChange = (newWeek: number) => {
    setSemanaAtual(newWeek);
    setDiaAtual(0); // Reset para primeiro dia da nova semana
  };

  const diaAtivo = diasSemanaAtual[diaAtual];
  const categorias = diaAtivo ? receitasPorDia[diaAtivo] : {};

  return (
    <div className="space-y-6">
      <WeekNavigator
        currentWeek={semanaAtual}
        totalWeeks={totalSemanas}
        onWeekChange={handleWeekChange}
      />
      
      <div className="text-center">
        <h3 className="text-lg font-semibold text-muted-foreground">
          Semana {semanaAtual} - {menu.clientName}
        </h3>
      </div>

      {/* Navegação de dias estilo Instagram */}
      <div className="flex justify-center items-center gap-4">
        <button
          onClick={irParaAnterior}
          disabled={diaAtual === 0}
          className="p-2 rounded-full bg-muted disabled:opacity-40 hover:bg-muted/80 transition-colors"
        >
          ←
        </button>

        {/* Card único do dia ativo */}
        {diaAtivo && (
          <Card className="w-full max-w-2xl border shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-center">{diaAtivo}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {CATEGORIAS_FIXAS.map((cat) => {
                  const receitasArray = (categorias as any)[cat];
                  const receita = Array.isArray(receitasArray) ? receitasArray[0] : receitasArray;
                  
                  return (
                    <div
                      key={cat}
                      className="border rounded p-3 shadow-sm bg-card"
                    >
                      <p className="font-semibold text-primary text-sm">{cat}</p>
                      {receita ? (
                        <>
                          <p className="text-foreground font-medium">{receita.name}</p>
                          <p className="text-sm text-muted-foreground">
                            R$ {Number(receita.cost || 0).toFixed(2)}
                          </p>
                          {Array.isArray(receitasArray) && receitasArray.length > 1 && (
                            <p className="text-xs text-blue-600">
                              +{receitasArray.length - 1} opções
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground italic text-sm">N/A</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <button
          onClick={irParaProximo}
          disabled={diaAtual === diasSemanaAtual.length - 1}
          className="p-2 rounded-full bg-muted disabled:opacity-40 hover:bg-muted/80 transition-colors"
        >
          →
        </button>
      </div>

      {/* Indicadores estilo Instagram */}
      <div className="flex justify-center gap-2 mt-4">
        {diasSemanaAtual.map((_, idx) => (
          <div
            key={idx}
            onClick={() => setDiaAtual(idx)}
            className={`w-2 h-2 rounded-full cursor-pointer transition-colors ${
              idx === diaAtual ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          {diaAtual + 1} de {diasSemanaAtual.length} dias
        </p>
      </div>
    </div>
  );
};