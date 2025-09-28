import { supabase } from "../integrations/supabase/client";

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
        tipo_suco_primario: 'PRO_MIX',
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