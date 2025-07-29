
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
    console.log(`Generating menu for client ${clientId} with budget ${budget}`);
    
    // Validate OpenAI API Key
    if (!openAIApiKey) {
      console.error('OpenAI API Key not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'OpenAI API Key not configured. Please set OPENAI_API_KEY in Supabase secrets.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
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
    const { data: receitasLegado } = await supabaseClient
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
Você é um nutricionista corporativo especializado. Crie um cardápio COMPLETO E BALANCEADO para a semana.

**Cliente:** ${clientData?.nome_empresa || 'Empresa'}
**Funcionários:** ${totalFuncionarios}
**Orçamento por refeição:** R$ ${budgetPerPerson.toFixed(2)}
**Restrições:** ${restrictions.join(', ') || 'Nenhuma'}
**Preferências:** ${preferences || 'Não especificadas'}

**Produtos Disponíveis:**
${Object.entries(productsByCategory || {}).map(([category, products]: [string, any]) => 
  `\n**${category}:**\n${products.slice(0, 5).map((p: any) => 
    `- ${p.nome} (${p.unidade}) - R$ ${(p.preco || 0).toFixed(2)} ${p.promocao ? '(PROMOÇÃO)' : ''}`
  ).join('\n')}`
).join('\n')}

**CRIE UM CARDÁPIO COMPLETO:** 20 receitas balanceadas (4 por dia × 5 dias)

**REGRAS OBRIGATÓRIAS:**
1. Para CADA DIA (Segunda a Sexta), inclua EXATAMENTE:
   - 1 Proteína Principal (category: "protein")
   - 1 Salada/Verdura (category: "vegetable") 
   - 1 Acompanhamento (category: "carb")
   - 1 Sobremesa/Fruta (category: "fruit")

2. CUSTO: R$ 3,00 a R$ 8,00 por receita
3. VARIEDADE: Receitas diferentes a cada dia
4. QUALIDADE: Use produtos da lista disponível

**Retorne EXATAMENTE este formato JSON:**
{
  "items": [
    {
      "id": "1",
      "name": "Frango Grelhado",
      "category": "protein",
      "cost": 6.50,
      "servings": ${totalFuncionarios},
      "day": "Segunda",
      "nutritionalInfo": {"calories": 350, "protein": 30, "carbs": 5, "fat": 15},
      "ingredients": [{"nome": "Peito de frango", "quantidade": 200, "unidade": "g"}],
      "description": "Frango temperado e grelhado"
    },
    {
      "id": "2", 
      "name": "Salada Mista",
      "category": "vegetable",
      "cost": 3.20,
      "servings": ${totalFuncionarios},
      "day": "Segunda",
      "nutritionalInfo": {"calories": 50, "protein": 2, "carbs": 8, "fat": 1},
      "ingredients": [{"nome": "Alface", "quantidade": 100, "unidade": "g"}],
      "description": "Salada fresca com verduras"
    }
  ],
  "summary": {
    "total_cost": 120.00,
    "average_cost_per_person": 6.00,
    "within_budget": true,
    "total_recipes": 20
  }
}

**CRÍTICO:** Gere TODAS as 20 receitas (4 categorias × 5 dias) com custos realistas!
    `;

    console.log('Making OpenAI API request...');
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

    console.log('OpenAI response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('OpenAI response received, processing...');
    
    // Validate OpenAI response structure
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('Invalid OpenAI response structure:', data);
      throw new Error('Invalid response from OpenAI API');
    }
    
    if (!data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.error('Missing content in OpenAI response:', data.choices[0]);
      throw new Error('No content received from OpenAI API');
    }
    
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

    // Convert menuItems to recipes format expected by frontend
    const recipes = menuItems.map((item: any, index: number) => ({
      id: `recipe_${index + 1}`,
      name: item.name || `Receita ${index + 1}`,
      description: item.description || 'Prato nutritivo e saboroso',
      category: item.category || 'Principal',
      costPerServing: item.cost || 0,
      prepTime: item.prepTime || 30,
      difficulty: item.difficulty || 'Médio',
      nutritionalInfo: {
        calories: item.nutritionalInfo?.calories || 450,
        protein: item.nutritionalInfo?.protein || 25,
        carbs: item.nutritionalInfo?.carbs || 45,
        fat: item.nutritionalInfo?.fat || 15,
        fiber: item.nutritionalInfo?.fiber || 8
      },
      ingredients: item.ingredients || [
        { name: 'Ingrediente principal', quantity: 200, unit: 'g' },
        { name: 'Temperos', quantity: 10, unit: 'g' }
      ],
      instructions: item.instructions || 'Seguir receita padrão'
    }));

    // Create menu object in the format expected by frontend
    const menu = {
      id: Date.now().toString(),
      total_cost: summary.total_cost || 0,
      cost_per_meal: summary.average_cost_per_person || 0,
      within_budget: summary.within_budget || true,
      recipes: recipes,
      summary: {
        total_recipes: recipes.length,
        total_cost: summary.total_cost || 0,
        average_cost_per_meal: summary.average_cost_per_person || 0,
        within_budget: summary.within_budget || true,
        promotions_used: summary.promotions_used || 0
      },
      // Three specialized versions for different audiences
      versions: {
        nutritionist: recipes.map(recipe => ({
          ...recipe,
          detailedCost: {
            totalCost: recipe.costPerServing * (recipe.servings || totalFuncionarios),
            costBreakdown: recipe.ingredients?.map((ing: any, idx: number) => ({
              ingredient: ing.name,
              cost: (recipe.costPerServing || 0) * 0.15 * (idx + 1), // Distribute cost among ingredients
              percentage: Math.round((100 / (recipe.ingredients?.length || 1)) * 100) / 100
            })) || [],
            profitMargin: Math.round(((recipe.costPerServing || 0) * 0.2) * 100) / 100
          },
          nutritionalAnalysis: {
            isBalanced: recipe.nutritionalInfo.protein >= 20 && recipe.nutritionalInfo.carbs <= 60,
            recommendations: [
              recipe.nutritionalInfo.protein < 20 ? "Aumentar proteína" : "Proteína adequada",
              recipe.nutritionalInfo.fiber < 5 ? "Adicionar fibras" : "Fibras adequadas"
            ].filter(Boolean),
            dietaryCompliance: recipe.restrictions || []
          },
          costPerServing: recipe.costPerServing,
          allergens: recipe.allergens || [],
          substitutions: recipe.substitutions || []
        })),
        kitchen: recipes.map(recipe => ({
          ...recipe,
          preparationSteps: [
            { step: 1, instruction: "Preparar todos os ingredientes", timeMinutes: 5, equipment: ["Facas", "Tábuas"] },
            { step: 2, instruction: recipe.instructions || "Seguir receita padrão", timeMinutes: (recipe.prepTime || 30) - 10, equipment: ["Fogão", "Panelas"] },
            { step: 3, instruction: "Finalizar preparo e temperar", timeMinutes: 5, equipment: ["Temperos"] }
          ],
          ingredientsInGrams: recipe.ingredients?.map((ing: any, idx: number) => ({
            name: ing.name,
            weightInGrams: Math.round(ing.quantity * (ing.unit === 'g' ? 1 : ing.unit === 'kg' ? 1000 : 100)),
            produto_base_id: 1000 + idx, // Placeholder - will be mapped properly
            preparation: idx % 3 === 0 ? "picado" : idx % 3 === 1 ? "cortado em cubos" : "inteiro"
          })) || [],
          cookingTips: [
            "Manter ingredientes frescos até o momento do preparo",
            "Seguir ordem de adição dos ingredientes",
            "Controlar temperatura durante todo o processo"
          ],
          yieldInformation: {
            expectedYield: recipe.servings || totalFuncionarios,
            servingSize: "200g por porção",
            wastePercentage: 5
          },
          difficulty: recipe.difficulty,
          servings: recipe.servings || totalFuncionarios
        })),
        client: recipes.map(recipe => ({
          id: recipe.id,
          name: recipe.name,
          description: recipe.description || "Prato nutritivo e saboroso, preparado com ingredientes frescos",
          category: recipe.category,
          nutritionalHighlights: {
            calories: recipe.nutritionalInfo.calories,
            healthBenefits: [
              recipe.nutritionalInfo.protein >= 25 ? "Rico em proteínas" : "Fonte de proteínas",
              recipe.nutritionalInfo.fiber >= 8 ? "Rico em fibras" : "Fonte de fibras",
              "Balanceado nutricionalmente"
            ]
          },
          allergenInfo: recipe.restrictions || [],
          isVegetarian: !recipe.category?.includes('protein') || recipe.category === 'vegetable',
          isVegan: recipe.category === 'vegetable',
          isGlutenFree: !recipe.restrictions?.includes('gluten')
        }))
      },
      marketConnection: {
        totalProductsBase: marketProducts?.length || 0,
        connectedIngredients: Math.round((marketProducts?.length || 0) * 0.8), // Estimate 80% connection
        missingConnections: ["Temperos especiais", "Ervas frescas"] // Common missing items
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

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error in editMenu:', errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    // Validate response structure for edit menu
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('Invalid OpenAI response structure in editMenu:', data);
      throw new Error('Invalid response from OpenAI API');
    }
    
    if (!data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.error('Missing content in OpenAI response for editMenu:', data.choices[0]);
      throw new Error('No content received from OpenAI API');
    }
    
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
