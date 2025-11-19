import { supabase } from "../integrations/supabase/client";

// Teste completo de geração de cardápio com todas as validações
export async function testMenuGenerationComplete() {
  console.log('🧪 === TESTES COMPLETOS DE GERAÇÃO DE CARDÁPIO ===\n');
  
  const testCases = [
    {
      name: 'Suco Pró Mix',
      config: { 
        action: 'generate_validated_menu',
        tipo_suco_primario: 'PRO_MIX', 
        dias: 5,
        meal_quantity: 50
      }
    },
    {
      name: 'Suco Natural',
      config: { 
        action: 'generate_validated_menu',
        tipo_suco_primario: 'NATURAL', 
        dias: 5,
        meal_quantity: 50
      }
    },
    {
      name: 'Suco Vita Suco',
      config: { 
        action: 'generate_validated_menu',
        tipo_suco_primario: 'VITA_SUCO', 
        dias: 5,
        meal_quantity: 50
      }
    },
    {
      name: '47 refeições (número quebrado)',
      config: { 
        action: 'generate_validated_menu',
        meal_quantity: 47, 
        dias: 5,
        tipo_suco_primario: 'NATURAL'
      }
    },
    {
      name: 'Orçamento total R$ 10.50/refeição',
      config: { 
        action: 'generate_validated_menu',
        dias: 5, 
        meal_quantity: 50,
        orcamento_por_refeicao: 10.50,
        tipo_suco_primario: 'NATURAL'
      }
    },
    {
      name: 'Gramatura de proteína 100g',
      config: { 
        action: 'generate_validated_menu',
        dias: 5, 
        meal_quantity: 50,
        proteina_gramas: '100',
        tipo_suco_primario: 'NATURAL'
      }
    }
  ];
  
  const results = [];
  
  for (const test of testCases) {
    console.log(`\n🧪 Testando: ${test.name}`);
    console.log('📋 Config:', JSON.stringify(test.config, null, 2));
    
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('quick-worker', {
        body: test.config
      });
      const duration = Date.now() - startTime;
      
      if (error) {
        console.error(`❌ Erro no teste ${test.name}:`, error);
        results.push({ test: test.name, success: false, error: error.message, duration });
        continue;
      }
      
      // Validações
      const validations = [];
      
      // 1. Deve ter sucesso
      if (data?.success !== true) {
        validations.push(`❌ Sem sucesso na resposta`);
      } else {
        validations.push(`✅ Sucesso confirmado`);
      }
      
      // 2. Deve ter 5 dias
      const dias = data?.cardapio?.cardapio?.length || data?.cardapio?.length || 0;
      if (dias !== 5) {
        validations.push(`❌ Deveria ter 5 dias, tem ${dias}`);
      } else {
        validations.push(`✅ 5 dias corretos`);
      }
      
      // 3. Cada dia deve ter 8 receitas (PP1, PP2, Guarnição, Salada1, Salada2, Sobremesa, Suco1, Suco2)
      const cardapioArray = data?.cardapio?.cardapio || data?.cardapio || [];
      let allDaysComplete = true;
      cardapioArray.forEach((dia: any, idx: number) => {
        const numReceitas = dia.receitas?.length || 0;
        if (numReceitas < 8) {
          validations.push(`❌ Dia ${idx + 1} tem apenas ${numReceitas} receitas (esperado: 8)`);
          allDaysComplete = false;
        }
      });
      
      if (allDaysComplete && dias === 5) {
        validations.push(`✅ Todos os dias completos (8 receitas cada)`);
      }
      
      // 4. Verificar tipo de suco se especificado
      if (test.config.tipo_suco_primario) {
        const primeiroDia = cardapioArray[0];
        const suco1 = primeiroDia?.receitas?.find((r: any) => r.categoria === 'Suco 1');
        if (suco1) {
          validations.push(`✅ Suco encontrado: ${suco1.nome} (tipo: ${suco1.tipo_suco || 'N/A'})`);
        } else {
          validations.push(`❌ Suco 1 não encontrado no cardápio`);
        }
      }
      
      // 5. Verificar orçamento total se especificado
      if (test.config.orcamento_por_refeicao) {
        const resumo = data?.cardapio?.resumo || data?.resumo;
        const custoTotal = resumo?.custo_total_periodo || 0;
        const orcamentoTotal = resumo?.orcamento_total_periodo || 0;
        const dentroOrcamento = resumo?.dentro_orcamento_total;
        
        if (dentroOrcamento !== undefined) {
          validations.push(dentroOrcamento 
            ? `✅ Dentro do orçamento (R$ ${custoTotal.toFixed(2)} / R$ ${orcamentoTotal.toFixed(2)})`
            : `⚠️ Acima do orçamento (R$ ${custoTotal.toFixed(2)} / R$ ${orcamentoTotal.toFixed(2)})`
          );
        }
      }
      
      // 6. Verificar proteínas diferentes
      let proteinasDiferentes = true;
      cardapioArray.forEach((dia: any, idx: number) => {
        const pp1 = dia.receitas?.find((r: any) => r.categoria === 'Prato Principal 1');
        const pp2 = dia.receitas?.find((r: any) => r.categoria === 'Prato Principal 2');
        
        if (pp1 && pp2) {
          // Extrair tipo de proteína (frango, carne, peixe, etc)
          const proteina1 = (pp1.nome || '').toUpperCase();
          const proteina2 = (pp2.nome || '').toUpperCase();
          
          // Se tiverem o mesmo nome, são iguais
          if (proteina1 === proteina2) {
            validations.push(`❌ Dia ${idx + 1}: Proteínas iguais (${pp1.nome})`);
            proteinasDiferentes = false;
          }
        } else {
          if (!pp1) validations.push(`❌ Dia ${idx + 1}: PP1 faltando`);
          if (!pp2) validations.push(`❌ Dia ${idx + 1}: PP2 faltando`);
          proteinasDiferentes = false;
        }
      });
      
      if (proteinasDiferentes && dias === 5) {
        validations.push(`✅ Todos os dias têm proteínas diferentes`);
      }
      
      console.log(`\n📊 Validações (${test.name}):`);
      validations.forEach(v => console.log(`  ${v}`));
      console.log(`⏱️ Tempo de execução: ${duration}ms`);
      
      results.push({ 
        test: test.name, 
        success: validations.filter(v => v.startsWith('✅')).length >= 4,
        validations,
        duration,
        data
      });
      
    } catch (error) {
      console.error(`❌ Exceção no teste ${test.name}:`, error);
      results.push({ test: test.name, success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  console.log('\n\n📈 === RESUMO DOS TESTES ===');
  console.log(`Total de testes: ${results.length}`);
  console.log(`Sucesso: ${results.filter(r => r.success).length}`);
  console.log(`Falhas: ${results.filter(r => !r.success).length}`);
  
  const successRate = (results.filter(r => r.success).length / results.length) * 100;
  console.log(`Taxa de sucesso: ${successRate.toFixed(1)}%`);
  
  return { results, successRate };
}

// Teste rápido básico
export async function testMenuGeneration() {
  try {
    console.log('🧪 Testando geração de cardápio...');
    
    const { data, error } = await supabase.functions.invoke('quick-worker', {
      body: {
        action: 'generate_validated_menu',
        dias: 5,
        meal_quantity: 50,
        proteina_gramas: '90',
        incluir_fim_semana: false,
        incluir_arroz_integral: false,
        max_tentativas: 10,
        tipo_suco_primario: 'NATURAL',
        tipo_suco_secundario: null,
        variar_sucos_por_dia: true
      }
    });

    if (error) {
      console.error('❌ Erro no teste:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Teste realizado:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
