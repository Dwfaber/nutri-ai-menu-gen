import { supabase } from "@/integrations/supabase/client";

export async function testMenuGeneration() {
  try {
    console.log('🧪 Testando geração de cardápio...');
    
    const { data, error } = await supabase.functions.invoke('quick-worker', {
      body: {
        action: 'generate_validated_menu',
        client_id: 'test',
        filial_id: 8,
        meal_quantity: 50,
        periodDays: 3,
        include_weekends: false,
        protein_config: {
          protein_grams_pp1: 100,
          protein_grams_pp2: 100
        }
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