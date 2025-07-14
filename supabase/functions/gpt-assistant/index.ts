
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { action, clientId, budget, restrictions, preferences, menuId, command } = await req.json();

    console.log(`GPT Assistant action: ${action}`);

    if (action === 'generateMenu') {
      return await generateMenuWithAssistant(supabaseClient, clientId, budget, restrictions, preferences);
    } else if (action === 'editMenu') {
      return await editMenuWithAssistant(supabaseClient, menuId, command);
    } else {
      throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in gpt-assistant function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function generateMenuWithAssistant(supabaseClient: any, clientId: string, budget: number, restrictions: string[], preferences?: string) {
  try {
    // Get client data
    const { data: clientData } = await supabaseClient
      .from('contratos_corporativos')
      .select('*')
      .eq('cliente_id_legado', clientId)
      .single();

    // Get available products
    const { data: products } = await supabaseClient
      .from('produtos_legado')
      .select('*')
      .eq('disponivel', true);

    // Get available recipes
    const { data: recipes } = await supabaseClient
      .from('receitas_legado')
      .select('*');

    // Create context for GPT Assistant
    const context = {
      client: clientData,
      budget,
      restrictions,
      preferences,
      availableProducts: products?.slice(0, 20), // Limit to avoid token limit
      availableRecipes: recipes?.slice(0, 10)
    };

    const prompt = `
Como nutricionista corporativo especializado, crie um cardápio semanal para:

**Cliente:** ${clientData?.nome_empresa || 'Empresa'}
**Funcionários:** ${clientData?.total_funcionarios || 100}
**Orçamento por refeição:** R$ ${budget.toFixed(2)}
**Restrições:** ${restrictions.join(', ') || 'Nenhuma'}
**Preferências:** ${preferences || 'Não especificadas'}

**Produtos Disponíveis:** ${JSON.stringify(products?.slice(0, 5), null, 2)}

Crie um cardápio com 5 pratos variados, cada um contendo:
- Nome do prato
- Categoria (protein, carb, vegetable, etc)
- Informações nutricionais (calorias, proteína, carboidratos, gordura)
- Custo estimado
- Restrições atendidas

Retorne em formato JSON estruturado para fácil processamento.
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um nutricionista corporativo especializado em criar cardápios balanceados, econômicos e adaptados a restrições alimentares. Sempre retorne respostas em formato JSON válido com a estrutura solicitada.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
    });

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    // Try to parse JSON response
    let menuItems;
    try {
      const jsonMatch = assistantResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        menuItems = parsedResponse.items || parsedResponse.pratos || [];
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: create structured menu from text response
      menuItems = createFallbackMenu(assistantResponse, budget, restrictions);
    }

    // Create menu object
    const menu = {
      id: Date.now().toString(),
      clientId,
      name: `Cardápio ${clientData?.nome_empresa || 'Empresa'} - ${new Date().toLocaleDateString()}`,
      week: new Date().toISOString().split('T')[0],
      items: menuItems,
      totalCost: menuItems.reduce((sum: number, item: any) => sum + (item.cost || 0), 0),
      createdAt: new Date().toISOString(),
      versions: {
        nutritionist: menuItems,
        kitchen: menuItems.map((item: any) => ({ 
          ...item, 
          name: `${item.name} (Tempo: ${item.prepTime || 20}min)`,
          instructions: item.instructions || 'Instruções de preparo padrão'
        })),
        client: menuItems.map((item: any) => ({ 
          ...item, 
          name: item.name.split(' ').slice(0, 2).join(' ') + ' Especial',
          description: item.description || 'Prato saboroso e nutritivo'
        }))
      }
    };

    return new Response(
      JSON.stringify({ success: true, menu, assistantResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating menu with assistant:', error);
    throw error;
  }
}

async function editMenuWithAssistant(supabaseClient: any, menuId: string, command: string) {
  try {
    const prompt = `
Como nutricionista corporativo, processe este comando para modificar um cardápio:

**Comando:** ${command}

Analise o comando e retorne em JSON:
{
  "action": "substitute|add|remove|adjust",
  "details": "descrição da modificação",
  "suggestions": ["sugestão 1", "sugestão 2"],
  "success": true
}
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um nutricionista que interpreta comandos em linguagem natural para modificar cardápios. Sempre retorne JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ success: true, response: assistantResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error editing menu with assistant:', error);
    throw error;
  }
}

function createFallbackMenu(response: string, budget: number, restrictions: string[]) {
  // Fallback menu creation when JSON parsing fails
  const baseItems = [
    {
      id: '1',
      name: 'Frango Grelhado com Quinoa',
      category: 'protein',
      nutritionalInfo: { calories: 450, protein: 35, carbs: 25, fat: 12 },
      cost: Math.min(budget * 0.8, 12.00),
      restrictions: restrictions.includes('vegan') ? ['gluten-free'] : []
    },
    {
      id: '2',
      name: 'Salada Completa',
      category: 'vegetable',
      nutritionalInfo: { calories: 320, protein: 15, carbs: 28, fat: 16 },
      cost: Math.min(budget * 0.6, 8.50),
      restrictions: ['vegan', 'gluten-free']
    }
  ];

  // Filter based on restrictions
  return restrictions.includes('vegan') 
    ? baseItems.filter(item => item.restrictions.includes('vegan'))
    : baseItems;
}
