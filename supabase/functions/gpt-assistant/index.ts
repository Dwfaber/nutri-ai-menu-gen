
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

    const body = await req.json();
    const { action, clientId, budget, restrictions, preferences, menuId, command, client_data, week_period, market_products, enhanced_cost_data } = body;

    console.log(`GPT Assistant action: ${action}`);

    if (action === 'generateMenu' || action === 'generate_menu') {
      // Handle new payload structure
      const actualClientId = clientId || client_data?.id;
      const actualBudget = budget || client_data?.max_cost_per_meal || 10;
      const actualRestrictions = restrictions || client_data?.dietary_restrictions || [];
      const actualPreferences = preferences || client_data?.preferences || [];
      
      return await generateMenuWithAssistant(supabaseClient, actualClientId, actualBudget, actualRestrictions, actualPreferences);
    } else if (action === 'editMenu' || action === 'edit_menu') {
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

    // Get available products from the digital market
    const { data: marketProducts } = await supabaseClient
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .order('categoria_descricao', { ascending: true })
      .limit(50); // Limit to avoid token overflow

    // Get available recipes
    const { data: recipes } = await supabaseClient
      .from('receitas_legado')
      .select('*')
      .limit(10);

    // Process market data by category
    const productsByCategory = marketProducts?.reduce((acc: any, product: any) => {
      const category = product.categoria_descricao || 'Outros';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        id: product.produto_id,
        nome: product.descricao,
        preco: product.preco || 0,
        preco_compra: product.preco_compra || 0,
        per_capita: product.per_capita || 0,
        unidade: product.unidade || 'kg',
        grupo: product.grupo || 'Geral',
        promocao: product.promocao || false,
        em_promocao: product.em_promocao || false,
        disponivel: true
      });
      return acc;
    }, {});

    const totalFuncionarios = clientData?.total_funcionarios || 100;
    const budgetPerPerson = budget || 0;

    const prompt = `
Como nutricionista corporativo especializado, crie um cardápio semanal para:

**Cliente:** ${clientData?.nome_empresa || 'Empresa'}
**Funcionários:** ${totalFuncionarios}
**Orçamento por refeição:** R$ ${budgetPerPerson.toFixed(2)}
**Restrições:** ${restrictions.join(', ') || 'Nenhuma'}
**Preferências:** ${preferences || 'Não especificadas'}

**Produtos Disponíveis no Mercado Digital:**
${Object.entries(productsByCategory || {}).map(([category, products]: [string, any]) => 
  `\n**${category}:**\n${products.slice(0, 5).map((p: any) => 
    `- ${p.nome} (${p.unidade}) - R$ ${(p.preco || 0).toFixed(2)} - Per capita: ${p.per_capita} ${p.promocao ? '(PROMOÇÃO)' : ''}`
  ).join('\n')}`
).join('\n')}

**Receitas Base Disponíveis:**
${recipes?.slice(0, 5).map(r => `- ${r.nome_receita} (${r.categoria_receita}) - Porções: ${r.porcoes}`).join('\n') || 'Nenhuma receita cadastrada'}

INSTRUÇÕES IMPORTANTES:
1. Use APENAS produtos da lista acima
2. Calcule custos usando per capita × ${totalFuncionarios} funcionários
3. Considere produtos em promoção para otimizar orçamento
4. Atenda às restrições alimentares especificadas
5. Crie 5 pratos variados para a semana

Retorne em JSON com esta estrutura:
{
  "items": [
    {
      "id": "1",
      "name": "Nome do Prato",
      "category": "protein|carb|vegetable|beverage",
      "ingredients": [
        {
          "produto_id": 123,
          "nome": "Ingrediente",
          "quantidade": 0.5,
          "unidade": "kg",
          "preco_unitario": 10.00,
          "custo_total": 5.00
        }
      ],
      "nutritionalInfo": {
        "calories": 450,
        "protein": 35,
        "carbs": 25,
        "fat": 12
      },
      "cost": 12.50,
      "servings": ${totalFuncionarios},
      "restrictions": ["gluten-free"],
      "description": "Descrição do prato"
    }
  ],
  "summary": {
    "total_cost": 62.50,
    "average_cost_per_person": 12.50,
    "within_budget": true,
    "promotions_used": 2
  }
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
            content: `Você é um nutricionista corporativo especializado em criar cardápios balanceados usando dados reais do mercado. Sempre retorne JSON válido com custos calculados usando per capita × número de funcionários.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      }),
    });

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    // Try to parse JSON response
    let menuItems;
    let summary;
    try {
      const jsonMatch = assistantResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        menuItems = parsedResponse.items || [];
        summary = parsedResponse.summary || {};
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      // Fallback: create structured menu from available products
      menuItems = createFallbackMenu(marketProducts || [], budget, restrictions, totalFuncionarios);
      summary = {
        total_cost: menuItems.reduce((sum: number, item: any) => sum + (item.cost || 0), 0),
        average_cost_per_person: budget,
        within_budget: true,
        promotions_used: 0
      };
    }

    // Create menu object
    const menu = {
      id: Date.now().toString(),
      clientId,
      name: `Cardápio ${clientData?.nome_empresa || 'Empresa'} - ${new Date().toLocaleDateString()}`,
      week: new Date().toISOString().split('T')[0],
      items: menuItems,
      summary,
      totalCost: summary.total_cost || 0,
      createdAt: new Date().toISOString(),
      versions: {
        nutritionist: menuItems,
        kitchen: menuItems.map((item: any) => ({ 
          ...item, 
          name: `${item.name} (Tempo: ${item.prepTime || 20}min)`,
          instructions: item.instructions || 'Seguir receita padrão'
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

function createFallbackMenu(products: any[], budget: number, restrictions: string[], totalFuncionarios: number) {
  const filteredProducts = products.filter(p => p.preco > 0 && p.per_capita > 0);
  
  return filteredProducts.slice(0, 5).map((product, index) => ({
    id: (index + 1).toString(),
    name: product.descricao || 'Prato Especial',
    category: getCategoryType(product.categoria_descricao),
    ingredients: [{
      produto_id: product.produto_id,
      nome: product.descricao,
      quantidade: product.per_capita * totalFuncionarios,
      unidade: product.unidade,
      preco_unitario: product.preco,
      custo_total: product.per_capita * totalFuncionarios * product.preco
    }],
    nutritionalInfo: { calories: 400, protein: 25, carbs: 30, fat: 15 },
    cost: product.per_capita * totalFuncionarios * product.preco,
    servings: totalFuncionarios,
    restrictions: restrictions.includes('vegan') ? ['vegan'] : [],
    description: `Prato preparado com ${product.descricao}`
  }));
}

function getCategoryType(categoria: string) {
  const categoryMap: { [key: string]: string } = {
    'Carnes': 'protein',
    'Gêneros': 'carb',
    'Hortifruti': 'vegetable',
    'Padaria': 'carb',
    'Cantina': 'beverage'
  };
  return categoryMap[categoria] || 'protein';
}
