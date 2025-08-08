
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
      .from('contratos_corporativos_v2')
      .select('*')
      .eq('cliente_id_legado', clientId)
      .single();

    // Get daily costs for the client's filiais
    const { data: dailyCosts } = await supabaseClient
      .from('custos_filiais')
      .select('*')
      .eq('cliente_id_legado', parseInt(clientId))
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`Found ${dailyCosts?.length || 0} cost records for client ${clientId}`);

    // Get available products from the digital market
    const { data: marketProducts } = await supabaseClient
      .from('co_solicitacao_produto_listagem')
      .select('*')
      .order('categoria_descricao', { ascending: true })
      .limit(50); // Limit to avoid token overflow

    // Get available recipes with ingredients
    const { data: receitasLegado } = await supabaseClient
      .from('receitas_legado')
      .select(`
        receita_id_legado,
        nome_receita,
        categoria_descricao,
        porcoes,
        custo_total,
        tempo_preparo,
        modo_preparo,
        inativa
      `)
      .eq('inativa', false)
      .order('categoria_descricao')
      .limit(50);

    // Get recipe ingredients
    const { data: receitaIngredientes } = await supabaseClient
      .from('receita_ingredientes')
      .select(`
        receita_id_legado,
        produto_base_id,
        quantidade,
        unidade,
        notas
      `)
      .in('receita_id_legado', receitasLegado?.map(r => r.receita_id_legado) || []);

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

    // Calculate daily costs for adaptation
    const dailyCostConstraints = dailyCosts?.length > 0 ? {
      segunda: dailyCosts[0]?.RefCustoSegunda || budgetPerPerson,
      terca: dailyCosts[0]?.RefCustoTerca || budgetPerPerson,
      quarta: dailyCosts[0]?.RefCustoQuarta || budgetPerPerson,
      quinta: dailyCosts[0]?.RefCustoQuinta || budgetPerPerson,
      sexta: dailyCosts[0]?.RefCustoSexta || budgetPerPerson,
      custo_medio_semanal: dailyCosts[0]?.custo_medio_semanal || budgetPerPerson,
      porcentagem_limite: dailyCosts[0]?.PorcentagemLimiteAcimaMedia || 10,
      usar_media_validacao: dailyCosts[0]?.QtdeRefeicoesUsarMediaValidarSimNao || false
    } : {
      segunda: budgetPerPerson,
      terca: budgetPerPerson,
      quarta: budgetPerPerson,
      quinta: budgetPerPerson,
      sexta: budgetPerPerson,
      custo_medio_semanal: budgetPerPerson,
      porcentagem_limite: 10,
      usar_media_validacao: false
    };

    // Get receitas legado data to include in prompt
    const receitasFormatted = receitasLegado?.map(receita => ({
      id: receita.receita_id_legado,
      nome: receita.nome_receita,
      categoria: receita.categoria_descricao || 'Principal',
      tempo_preparo: receita.tempo_preparo || 30,
      porcoes: receita.porcoes || 1,
      custo_total: receita.custo_total || 0,
      modo_preparo: receita.modo_preparo,
      ativo: !receita.inativa
    })) || [];

    const prompt = `
Você é um nutricionista corporativo especializado. Crie um cardápio COMPLETO E BALANCEADO para a semana usando dados reais do sistema.

**Cliente:** ${clientData?.nome_empresa || 'Empresa'}
**Funcionários:** ${totalFuncionarios}
**Orçamento por refeição:** R$ ${budgetPerPerson.toFixed(2)}
**Restrições:** ${restrictions.join(', ') || 'Nenhuma'}
**Preferências:** ${preferences || 'Não especificadas'}

**CUSTOS DIÁRIOS ESPECÍFICOS POR DIA DA SEMANA:**
- Segunda-feira: R$ ${dailyCostConstraints.segunda.toFixed(2)} por refeição
- Terça-feira: R$ ${dailyCostConstraints.terca.toFixed(2)} por refeição
- Quarta-feira: R$ ${dailyCostConstraints.quarta.toFixed(2)} por refeição
- Quinta-feira: R$ ${dailyCostConstraints.quinta.toFixed(2)} por refeição
- Sexta-feira: R$ ${dailyCostConstraints.sexta.toFixed(2)} por refeição
- Custo médio semanal: R$ ${dailyCostConstraints.custo_medio_semanal.toFixed(2)}
- Tolerância máxima: ${dailyCostConstraints.porcentagem_limite}% acima da média
- Validação por média: ${dailyCostConstraints.usar_media_validacao ? 'SIM' : 'NÃO'}

**RECEITAS LEGADO DISPONÍVEIS (${receitasFormatted.length} receitas validadas):**
${receitasFormatted.map(r => `- ID: ${r.id} | ${r.nome} | Categoria: ${r.categoria} | Porções: ${r.porcoes} | Custo: R$${(r.custo_total || 0).toFixed(2)} | Tempo: ${r.tempo_preparo}min`).join('\n')}

**INGREDIENTES DAS RECEITAS LEGADO:**
${receitaIngredientes?.slice(0, 30).map(ing => `Receita ${ing.receita_id_legado}: ${ing.quantidade || 0}${ing.unidade || 'un'} - Produto Base ID: ${ing.produto_base_id}`).join('\n') || 'Sem ingredientes detalhados'}

**INSTRUÇÕES ESPECIAIS - SISTEMA DE ADAPTAÇÃO POR CUSTO DIÁRIO:**
1. **PRIMEIRO:** Para CADA DIA, use adapt_recipe_to_daily_cost() para adaptar receitas legado ao custo específico do dia
2. **SEGUNDO:** Use validate_daily_budget() para validar se o cardápio do dia cabe no orçamento
3. **TERCEIRO:** UTILIZE EXCLUSIVAMENTE receitas legado! Selecione das ${receitasFormatted.length} receitas disponíveis e adapte para ${totalFuncionarios} funcionários
4. **QUARTO:** Use get_produtos_carnes() para buscar proteínas complementares
5. **QUINTO:** Use get_produtos_hortifruti() para buscar frutas/vegetais frescos
6. **SEXTO:** Use get_produtos_generos() para buscar grãos/carboidratos
7. **SÉTIMO:** Use get_promotional_products() para identificar promoções
8. **OITAVO:** Use calculate_real_costs() para calcular custos exatos finais

**PROCESSO OBRIGATÓRIO - ADAPTAÇÃO POR CUSTO DIÁRIO:**
1. Para CADA DIA da semana (Segunda a Sexta):
   - Use adapt_recipe_to_daily_cost() para adaptar receitas ao custo específico do dia
   - Valide com validate_daily_budget() se o cardápio cabe no orçamento diário
   - Se exceder, reduza porções ou substitua ingredientes mais baratos
   - Se sobrar orçamento, melhore qualidade dos ingredientes

2. Para CADA receita do cardápio:
   - OBRIGATÓRIO: Use APENAS receitas legado da lista (${receitasFormatted.length} disponíveis)
   - Adapte receita selecionada com adapt_recipe_to_daily_cost()
   - Ajuste porções de porcoes_originais para ${totalFuncionarios} pessoas
   - Use ingredientes originais com produto_base_id corretos

**ADAPTAÇÃO INTELIGENTE DE RECEITAS:**
- Receita adaptada = receita_original × fator_adaptacao_custo × fator_funcionarios
- Fator custo = custo_alvo_dia ÷ custo_original_receita
- Fator funcionários = ${totalFuncionarios} ÷ porcoes_originais
- Limite: Não reduzir abaixo de 30% nem aumentar acima de 200% das quantidades originais
- SEMPRE mantenha proporções nutricionais e sabor original

**CRIE UM CARDÁPIO COMPLETO:** 20 receitas balanceadas (4 por dia × 5 dias)

**REGRAS OBRIGATÓRIAS:**
1. Para CADA DIA (Segunda a Sexta), inclua EXATAMENTE:
   - 1 Proteína Principal (category: "protein")
   - 1 Salada/Verdura (category: "vegetable") 
   - 1 Acompanhamento (category: "carb")
   - 1 Sobremesa/Fruta (category: "fruit")

2. CUSTO: R$ 3,00 a R$ 8,00 por receita
3. VARIEDADE: Receitas diferentes a cada dia
4. QUALIDADE: Use APENAS produtos validados com produtos_base_id corretos

**Retorne EXATAMENTE este formato JSON ENRIQUECIDO COM ADAPTAÇÃO POR CUSTO DIÁRIO:**
{
  "items": [
    {
      "id": "1",
      "name": "Frango Grelhado",
      "category": "protein",
      "cost": 6.50,
      "servings": ${totalFuncionarios},
      "day": "Segunda",
      "custo_alvo_dia": ${dailyCostConstraints.segunda.toFixed(2)},
      "custo_dentro_limite": true,
      "fator_adaptacao": 0.85,
      "nutritionalInfo": {"calories": 350, "protein": 30, "carbs": 5, "fat": 15},
      "ingredients": [{"nome": "Peito de frango", "produto_base_id": 123, "quantidade": 200, "unidade": "g", "quantidade_adaptada": 170}],
      "description": "Frango temperado e grelhado",
      "receita_id_legado": "12345",
      "nome_receita_original": "Frango Grelhado Original",
      "categoria_original": "Proteína",
      "porcoes_originais": 10,
      "modo_preparo": "Tempere e grelhe por 15min",
      "tempo_preparo": 30,
      "adaptacao_porcoes": "De 10 para ${totalFuncionarios} porções",
      "custo_original": 7.65,
      "economia_obtida": 1.15
    }
  ],
  "daily_breakdown": {
    "segunda": {"custo_alvo": ${dailyCostConstraints.segunda.toFixed(2)}, "custo_real": 0, "receitas": [], "status": "OK"},
    "terca": {"custo_alvo": ${dailyCostConstraints.terca.toFixed(2)}, "custo_real": 0, "receitas": [], "status": "OK"},
    "quarta": {"custo_alvo": ${dailyCostConstraints.quarta.toFixed(2)}, "custo_real": 0, "receitas": [], "status": "OK"},
    "quinta": {"custo_alvo": ${dailyCostConstraints.quinta.toFixed(2)}, "custo_real": 0, "receitas": [], "status": "OK"},
    "sexta": {"custo_alvo": ${dailyCostConstraints.sexta.toFixed(2)}, "custo_real": 0, "receitas": [], "status": "OK"}
  },
  "summary": {
    "total_cost": 120.00,
    "average_cost_per_person": 6.00,
    "within_budget": true,
    "total_recipes": 20,
    "receitas_legado_utilizadas": 20,
    "receitas_adaptadas": 20,
    "receitas_novas_criadas": 0,
    "products_validated": true,
    "promotions_used": 5,
    "economia_total_adaptacao": 15.60,
    "dias_dentro_orcamento": 5,
    "adaptacao_media_percentual": 12.5
  }
}

**CRÍTICO - RECEITAS LEGADO OBRIGATÓRIAS:** 
- Use EXCLUSIVAMENTE as ${receitasFormatted.length} receitas legado da lista acima
- NUNCA crie receitas novas - apenas adapte as existentes
- Cada item deve ter receita_id_legado válido da lista
- Mantenha ingredientes originais, adapte apenas quantidades para ${totalFuncionarios} pessoas
- Use as funções para validar custos reais!
    `;

    // Define function tools for precise database queries
    const functions = [
      {
        name: "get_produtos_carnes",
        description: "Busca produtos de carne disponíveis (proteínas)",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Limite de resultados (padrão: 20)"
            }
          }
        }
      },
      {
        name: "get_produtos_hortifruti",
        description: "Busca produtos de hortifruti (frutas e vegetais)",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Limite de resultados (padrão: 20)"
            }
          }
        }
      },
      {
        name: "get_produtos_generos",
        description: "Busca produtos de gêneros (arroz, feijão, grãos, óleos)",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Limite de resultados (padrão: 20)"
            }
          }
        }
      },
      {
        name: "get_produtos_frios",
        description: "Busca produtos frios (laticínios, queijos, embutidos)",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Limite de resultados (padrão: 10)"
            }
          }
        }
      },
      {
        name: "get_promotional_products",
        description: "Busca produtos em promoção disponíveis",
        parameters: {
          type: "object",
          properties: {
            categoria: {
              type: "string",
              description: "Categoria do produto (opcional)"
            }
          }
        }
      },
      {
        name: "calculate_real_costs",
        description: "Calcula custos reais baseado em produtos_base e quantidades",
        parameters: {
          type: "object",
          properties: {
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  produto_base_id: { type: "number" },
                  quantidade: { type: "number" },
                  unidade: { type: "string" }
                }
              }
            },
            total_funcionarios: { type: "number" }
          },
          required: ["ingredients", "total_funcionarios"]
        }
      },
      {
        name: "validate_recipe_ingredients",
        description: "Valida se ingredientes existem na base de produtos",
        parameters: {
          type: "object",
          properties: {
            ingredient_names: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["ingredient_names"]
        }
      },
      {
        name: "adapt_recipe_to_daily_cost",
        description: "Adapta receita existente para caber no custo diário específico",
        parameters: {
          type: "object",
          properties: {
            receita_id: { type: "string", description: "ID da receita legado" },
            custo_alvo: { type: "number", description: "Custo alvo por refeição" },
            total_funcionarios: { type: "number", description: "Total de funcionários" },
            dia_semana: { type: "string", description: "Dia da semana (segunda, terca, etc.)" }
          },
          required: ["receita_id", "custo_alvo", "total_funcionarios", "dia_semana"]
        }
      },
      {
        name: "validate_daily_budget",
        description: "Valida se cardápio do dia cabe no orçamento específico",
        parameters: {
          type: "object",
          properties: {
            receitas_dia: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  receita_id: { type: "string" },
                  custo_estimado: { type: "number" }
                }
              }
            },
            custo_dia: { type: "number" },
            tolerancia_percentual: { type: "number" },
            dia_semana: { type: "string" }
          },
          required: ["receitas_dia", "custo_dia", "dia_semana"]
        }
      }
    ];

    console.log('Making OpenAI API request with function calling...');
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
            content: `Você é um nutricionista corporativo especializado com acesso a funções para consultar dados reais do sistema. 
            Use as funções disponíveis para:
            1. Buscar carnes e proteínas (get_produtos_carnes)
            2. Buscar frutas e vegetais (get_produtos_hortifruti)  
            3. Buscar arroz, feijão e grãos (get_produtos_generos)
            4. Buscar laticínios e queijos (get_produtos_frios)
            5. Identificar promoções (get_promotional_products)
            6. Calcular custos precisos (calculate_real_costs)
            7. Validar ingredientes (validate_recipe_ingredients)
            
            SEMPRE use dados reais das funções em vez de estimativas. Retorne JSON válido com produtos_base_id corretos.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: functions.map(func => ({
          type: "function",
          function: func
        })),
        tool_choice: "auto",
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
    
    // Handle function calls if present
    if (data.choices[0]?.message?.tool_calls) {
      console.log('Processing function calls...');
      
      const messages = [
        {
          role: 'system',
          content: `Você é um nutricionista corporativo especializado com acesso a funções para consultar dados reais do sistema.`
        },
        {
          role: 'user',
          content: prompt
        },
        data.choices[0].message
      ];

      // Process each function call
      for (const toolCall of data.choices[0].message.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing function: ${functionName} with args:`, functionArgs);
        
        let functionResult;
        try {
          switch (functionName) {
            case 'get_produtos_carnes':
              functionResult = await executeFunctionGetProdutosCarnes(supabaseClient, functionArgs);
              break;
            case 'get_produtos_hortifruti':
              functionResult = await executeFunctionGetProdutosHortifruti(supabaseClient, functionArgs);
              break;
            case 'get_produtos_generos':
              functionResult = await executeFunctionGetProdutosGeneros(supabaseClient, functionArgs);
              break;
            case 'get_produtos_frios':
              functionResult = await executeFunctionGetProdutosFrios(supabaseClient, functionArgs);
              break;
            case 'get_promotional_products':
              functionResult = await executeFunctionGetPromotionalProducts(supabaseClient, functionArgs);
              break;
            case 'calculate_real_costs':
              functionResult = await executeFunctionCalculateRealCosts(supabaseClient, functionArgs);
              break;
            case 'validate_recipe_ingredients':
              functionResult = await executeFunctionValidateIngredients(supabaseClient, functionArgs);
              break;
            case 'adapt_recipe_to_daily_cost':
              functionResult = await executeFunctionAdaptRecipeToDailyCost(supabaseClient, functionArgs);
              break;
            case 'validate_daily_budget':
              functionResult = await executeFunctionValidateDailyBudget(supabaseClient, functionArgs);
              break;
            default:
              functionResult = { error: `Function ${functionName} not implemented` };
          }
        } catch (error) {
          console.error(`Error executing function ${functionName}:`, error);
          functionResult = { error: error.message };
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(functionResult)
        });
      }

      // Make a follow-up call with function results
      const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 3000
        }),
      });

      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        const assistantResponse = followUpData.choices[0]?.message?.content;
        
        // Continue with normal processing using the enhanced response
        if (assistantResponse) {
          return await processMenuResponse(supabaseClient, assistantResponse, marketProducts, budget, restrictions, totalFuncionarios, {});
        }
      }
    }
    
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

    // Use centralized response processing
    return await processMenuResponse(supabaseClient, assistantResponse, marketProducts, budget, restrictions, totalFuncionarios, {});


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

async function createFallbackMenu(supabaseClient: any, products: any[], budget: number, restrictions: string[], totalFuncionarios: number) {
  console.log('Creating smart fallback menu with real cost calculations...');
  
  // Get real recipes from database for fallback
  const { data: receitas } = await supabaseClient
    .from('receitas_legado')
    .select('receita_id_legado, nome_receita, categoria_descricao, porcoes, quantidade_refeicoes, custo_total')
    .eq('inativa', false)
    .limit(20);

  const { data: receitaIngredientes } = await supabaseClient
    .from('receita_ingredientes')
    .select('receita_id_legado, produto_base_id, quantidade, unidade, produto_base_descricao, quantidade_refeicoes')
    .limit(100);

  // Filter out inappropriate products (non-food items)
  const inappropriateTerms = ['couro', 'pele', 'saco', 'embalagem', 'papel', 'plástico', 'vidro'];
  const validProducts = products.filter(product => {
    const name = (product.descricao || '').toLowerCase();
    const hasPrice = product.preco > 0.50 && product.preco < 100; // Reasonable price range
    const notInappropriate = !inappropriateTerms.some(term => name.includes(term));
    
    return hasPrice && notInappropriate && product.produto_base_id;
  });

  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const menuItems: any[] = [];

  // Function to calculate real ingredient cost
  const calculateIngredientCost = (ingredient: any, marketProduct: any, targetServings: number) => {
    if (!ingredient || !marketProduct) return 0;
    
    const originalServings = ingredient.quantidade_refeicoes || 1;
    const scalingFactor = targetServings / originalServings;
    const adjustedQuantity = (ingredient.quantidade || 0) * scalingFactor;
    const unitPrice = marketProduct.preco || 0;
    
    return adjustedQuantity * unitPrice;
  };

  // Function to calculate total recipe cost
  const calculateRecipeCost = (receitaId: string, targetServings: number) => {
    const ingredients = receitaIngredientes?.filter(ing => ing.receita_id_legado === receitaId) || [];
    let totalCost = 0;
    
    for (const ingredient of ingredients) {
      const marketProduct = validProducts.find(p => p.produto_base_id === ingredient.produto_base_id);
      if (marketProduct) {
        totalCost += calculateIngredientCost(ingredient, marketProduct, targetServings);
      }
    }
    
    return Math.max(totalCost, 3.0); // Minimum viable cost
  };

  // Create realistic menu for each day using real recipes when possible
  days.forEach((day, dayIndex) => {
    const dayRecipes = receitas?.slice(dayIndex * 4, (dayIndex + 1) * 4) || [];
    
    // Try to use real recipes first
    if (dayRecipes.length > 0) {
      dayRecipes.forEach((receita, recipeIndex) => {
        const realCost = calculateRecipeCost(receita.receita_id_legado, totalFuncionarios);
        const adjustedCost = Math.min(realCost, budget * 0.8); // Stay within budget
        
        const recipeIngredients = receitaIngredientes?.filter(ing => 
          ing.receita_id_legado === receita.receita_id_legado
        ) || [];
        
        const categoryMap: { [key: string]: string } = {
          'Carnes': 'protein',
          'Proteína': 'protein',
          'Carboidrato': 'carb',
          'Gêneros': 'carb',
          'Verduras': 'vegetable',
          'Hortifruti': 'vegetable',
          'Frutas': 'fruit',
          'Sobremesa': 'fruit'
        };
        
        const category = categoryMap[receita.categoria_descricao || ''] || 
                        (recipeIndex % 4 === 0 ? 'protein' : 
                         recipeIndex % 4 === 1 ? 'vegetable' : 
                         recipeIndex % 4 === 2 ? 'carb' : 'fruit');

        menuItems.push({
          id: `recipe_${dayIndex}_${recipeIndex}`,
          name: receita.nome_receita,
          category: category,
          cost: adjustedCost,
          servings: totalFuncionarios,
          day: day,
          receita_id_legado: receita.receita_id_legado,
          nutritionalInfo: { 
            calories: 300 + (recipeIndex * 50), 
            protein: category === 'protein' ? 25 : 10, 
            carbs: category === 'carb' ? 40 : 15, 
            fat: category === 'protein' ? 12 : 5 
          },
          ingredients: recipeIngredients.map(ing => ({
            nome: ing.produto_base_descricao || 'Ingrediente',
            produto_base_id: ing.produto_base_id,
            quantidade: (ing.quantidade || 0) * (totalFuncionarios / (ing.quantidade_refeicoes || 1)),
            unidade: ing.unidade || 'g'
          })),
          description: `Receita tradicional: ${receita.nome_receita}`
        });
      });
    } else {
      // Fallback to product-based menu if no recipes available
      const proteins = validProducts.filter(p => {
        const desc = (p.descricao || '').toLowerCase();
        return desc.includes('frango') || desc.includes('boi') || desc.includes('carne') || 
               desc.includes('peixe') || (p.categoria_descricao === 'Carnes');
      });
      
      if (proteins.length > 0) {
        const protein = proteins[dayIndex % proteins.length];
        const realCost = (protein.preco || 0) * 0.2 * totalFuncionarios; // 200g per person
        menuItems.push({
          id: `fallback_protein_${dayIndex}`,
          name: `${protein.descricao} Grelhado`,
          category: 'protein',
          cost: Math.min(realCost, budget * 0.4),
          servings: totalFuncionarios,
          day: day,
          nutritionalInfo: { calories: 350, protein: 30, carbs: 5, fat: 15 },
          ingredients: [{
            nome: protein.descricao,
            produto_base_id: protein.produto_base_id,
            quantidade: 200,
            unidade: protein.unidade || 'g'
          }],
          description: `${protein.descricao} temperado e grelhado`
        });
      }
    }

    // Add complementary dishes if needed to reach 4 per day
    const currentDayItems = menuItems.filter(item => item.day === day);
    const neededItems = 4 - currentDayItems.length;
    
    if (neededItems > 0) {
        // Add vegetables
        const vegetables = validProducts.filter(p => {
          const desc = (p.descricao || '').toLowerCase();
          return desc.includes('alface') || desc.includes('tomate') || desc.includes('cenoura') ||
                 desc.includes('verdura') || (p.categoria_descricao === 'Hortifruti');
        });
        
        if (vegetables.length > 0 && neededItems > 0) {
          const vegetable = vegetables[dayIndex % vegetables.length];
          const vegCost = (vegetable.preco || 0) * 0.08 * totalFuncionarios; // 80g per person
          menuItems.push({
            id: `fallback_vegetable_${dayIndex}`,
            name: `Salada de ${vegetable.descricao}`,
            category: 'vegetable',
            cost: Math.min(vegCost, budget * 0.25),
            servings: totalFuncionarios,
            day: day,
            nutritionalInfo: { calories: 50, protein: 2, carbs: 8, fat: 1 },
            ingredients: [{
              nome: vegetable.descricao,
              produto_base_id: vegetable.produto_base_id,
              quantidade: 80,
              unidade: vegetable.unidade || 'g'
            }],
            description: `Salada fresca de ${vegetable.descricao}`
          });
        }

        // Add carbohydrates
        const carbs = validProducts.filter(p => {
          const desc = (p.descricao || '').toLowerCase();
          return desc.includes('arroz') || desc.includes('feijão') || desc.includes('batata') ||
                 desc.includes('macarrão') || (p.categoria_descricao === 'Gêneros');
        });
        
        if (carbs.length > 0 && neededItems > 1) {
          const carb = carbs[dayIndex % carbs.length];
          const carbCost = (carb.preco || 0) * 0.1 * totalFuncionarios; // 100g per person
          menuItems.push({
            id: `fallback_carb_${dayIndex}`,
            name: `${carb.descricao} Temperado`,
            category: 'carb',
            cost: Math.min(carbCost, budget * 0.25),
            servings: totalFuncionarios,
            day: day,
            nutritionalInfo: { calories: 200, protein: 8, carbs: 40, fat: 2 },
            ingredients: [{
              nome: carb.descricao,
              produto_base_id: carb.produto_base_id,
              quantidade: 100,
              unidade: carb.unidade || 'g'
            }],
            description: `${carb.descricao} bem temperado`
          });
        }

        // Add fruits
        const fruits = validProducts.filter(p => {
          const desc = (p.descricao || '').toLowerCase();
          return desc.includes('banana') || desc.includes('maçã') || desc.includes('laranja') ||
                 desc.includes('fruta') || desc.includes('uva');
        });
        
        if (fruits.length > 0 && neededItems > 2) {
          const fruit = fruits[dayIndex % fruits.length];
          const fruitCost = (fruit.preco || 0) * 0.12 * totalFuncionarios; // 120g per person
          menuItems.push({
            id: `fallback_fruit_${dayIndex}`,
            name: `${fruit.descricao} Natural`,
            category: 'fruit',
            cost: Math.min(fruitCost, budget * 0.15),
            servings: totalFuncionarios,
            day: day,
            nutritionalInfo: { calories: 80, protein: 1, carbs: 20, fat: 0 },
            ingredients: [{
              nome: fruit.descricao,
              produto_base_id: fruit.produto_base_id,
              quantidade: 120,
              unidade: fruit.unidade || 'g'
            }],
            description: `${fruit.descricao} fresca da estação`
          });
        }
      }
    }
  });

  console.log(`Created smart fallback menu with ${menuItems.length} items using real recipes and cost calculations`);
  return menuItems;
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

// Function implementations for GPT function calling - Category Specific Functions
async function executeFunctionGetProdutosCarnes(supabaseClient: any, args: any) {
  try {
    console.log('Executing get_produtos_carnes function with args:', args);
    
    const { data, error } = await supabaseClient
      .from('co_solicitacao_produto_listagem')
      .select('produto_base_id, descricao, preco, preco_compra, per_capita, unidade, categoria_descricao, promocao')
      .eq('categoria_descricao', 'Carnes')
      .not('produto_base_id', 'is', null)
      .limit(args.limit || 20);
    
    if (error) {
      console.error('Error fetching produtos carnes:', error);
      return { error: error.message };
    }
    
    console.log(`Found ${data?.length || 0} produtos de carnes`);
    return { produtos: data || [] };
    
  } catch (error) {
    console.error('Error in executeFunctionGetProdutosCarnes:', error);
    return { error: error.message };
  }
}

async function executeFunctionGetProdutosHortifruti(supabaseClient: any, args: any) {
  try {
    console.log('Executing get_produtos_hortifruti function with args:', args);
    
    const { data, error } = await supabaseClient
      .from('co_solicitacao_produto_listagem')
      .select('produto_base_id, descricao, preco, preco_compra, per_capita, unidade, categoria_descricao, promocao')
      .eq('categoria_descricao', 'Hortifruti')
      .not('produto_base_id', 'is', null)
      .limit(args.limit || 20);
    
    if (error) {
      console.error('Error fetching produtos hortifruti:', error);
      return { error: error.message };
    }
    
    console.log(`Found ${data?.length || 0} produtos de hortifruti`);
    return { produtos: data || [] };
    
  } catch (error) {
    console.error('Error in executeFunctionGetProdutosHortifruti:', error);
    return { error: error.message };
  }
}

async function executeFunctionGetProdutosGeneros(supabaseClient: any, args: any) {
  try {
    console.log('Executing get_produtos_generos function with args:', args);
    
    const { data, error } = await supabaseClient
      .from('co_solicitacao_produto_listagem')
      .select('produto_base_id, descricao, preco, preco_compra, per_capita, unidade, categoria_descricao, promocao')
      .eq('categoria_descricao', 'Gêneros')
      .not('produto_base_id', 'is', null)
      .limit(args.limit || 20);
    
    if (error) {
      console.error('Error fetching produtos generos:', error);
      return { error: error.message };
    }
    
    console.log(`Found ${data?.length || 0} produtos de gêneros`);
    return { produtos: data || [] };
    
  } catch (error) {
    console.error('Error in executeFunctionGetProdutosGeneros:', error);
    return { error: error.message };
  }
}

async function executeFunctionGetProdutosFrios(supabaseClient: any, args: any) {
  try {
    console.log('Executing get_produtos_frios function with args:', args);
    
    const { data, error } = await supabaseClient
      .from('co_solicitacao_produto_listagem')
      .select('produto_base_id, descricao, preco, preco_compra, per_capita, unidade, categoria_descricao, promocao')
      .eq('categoria_descricao', 'Frios')
      .not('produto_base_id', 'is', null)
      .limit(args.limit || 10);
    
    if (error) {
      console.error('Error fetching produtos frios:', error);
      return { error: error.message };
    }
    
    console.log(`Found ${data?.length || 0} produtos frios`);
    return { produtos: data || [] };
    
  } catch (error) {
    console.error('Error in executeFunctionGetProdutosFrios:', error);
    return { error: error.message };
  }
}

async function executeFunctionGetPromotionalProducts(supabaseClient: any, args: any) {
  try {
    console.log('Executing get_promotional_products function with args:', args);
    
    let query = supabaseClient
      .from('co_solicitacao_produto_listagem')
      .select('produto_id, descricao, preco, preco_compra, per_capita, unidade, categoria_descricao, promocao')
      .eq('promocao', true);
    
    if (args.categoria) {
      query = query.ilike('categoria_descricao', `%${args.categoria}%`);
    }
    
    query = query.limit(20);
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching promotional products:', error);
      return { error: error.message };
    }
    
    console.log(`Found ${data?.length || 0} promotional products`);
    return { produtos_promocao: data || [] };
    
  } catch (error) {
    console.error('Error in executeFunctionGetPromotionalProducts:', error);
    return { error: error.message };
  }
}

async function executeFunctionCalculateRealCosts(supabaseClient: any, args: any) {
  try {
    console.log('Executing calculate_real_costs function with args:', args);
    
    const { ingredients, total_funcionarios } = args;
    let totalCost = 0;
    const costBreakdown = [];
    
    for (const ingredient of ingredients) {
      // Get product details from produtos_base
      const { data: produtoBase } = await supabaseClient
        .from('produtos_base')
        .select('produto_base_id, descricao, unidade')
        .eq('produto_base_id', ingredient.produto_base_id)
        .single();
      
      if (produtoBase) {
        // Get market price from co_solicitacao_produto_listagem
        const { data: marketProduct } = await supabaseClient
          .from('co_solicitacao_produto_listagem')
          .select('preco, preco_compra, per_capita, promocao')
          .eq('produto_base_id', ingredient.produto_base_id)
          .single();
        
        if (marketProduct) {
          const unitPrice = marketProduct.preco_compra || marketProduct.preco || 0;
          const totalQuantity = ingredient.quantidade * total_funcionarios;
          const itemCost = totalQuantity * unitPrice;
          
          totalCost += itemCost;
          costBreakdown.push({
            produto_base_id: ingredient.produto_base_id,
            nome: produtoBase.descricao,
            quantidade_total: totalQuantity,
            preco_unitario: unitPrice,
            custo_total: itemCost,
            promocao: marketProduct.promocao || false
          });
        }
      }
    }
    
    return {
      custo_total: totalCost,
      custo_por_pessoa: totalCost / total_funcionarios,
      detalhamento: costBreakdown
    };
    
  } catch (error) {
    console.error('Error in executeFunctionCalculateRealCosts:', error);
    return { error: error.message };
  }
}

async function executeFunctionValidateIngredients(supabaseClient: any, args: any) {
  try {
    console.log('Executing validate_recipe_ingredients function with args:', args);
    
    const { ingredient_names } = args;
    const validatedIngredients = [];
    const missingIngredients = [];
    
    for (const ingredientName of ingredient_names) {
      // Search for ingredient in produtos_base
      const { data: found } = await supabaseClient
        .from('produtos_base')
        .select('produto_base_id, descricao, unidade')
        .ilike('descricao', `%${ingredientName}%`)
        .limit(3);
      
      if (found && found.length > 0) {
        validatedIngredients.push({
          nome_procurado: ingredientName,
          encontrados: found.map(item => ({
            produto_base_id: item.produto_base_id,
            descricao: item.descricao,
            unidade: item.unidade
          }))
        });
      } else {
        missingIngredients.push(ingredientName);
      }
    }
    
    return {
      ingredientes_validados: validatedIngredients,
      ingredientes_nao_encontrados: missingIngredients,
      taxa_sucesso: (validatedIngredients.length / ingredient_names.length) * 100
    };
    
  } catch (error) {
    console.error('Error in executeFunctionValidateIngredients:', error);
    return { error: error.message };
  }
}

async function processMenuResponse(supabaseClient: any, assistantResponse: string, marketProducts: any[], budget: number, restrictions: string[], totalFuncionarios: number, summary: any) {
  // Try to parse JSON response with improved error handling
  let menuItems;
  try {
    console.log('Parsing GPT Assistant response...');
    
    // Try multiple JSON extraction methods
    let jsonMatch = assistantResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Try finding JSON between code blocks
      jsonMatch = assistantResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonMatch[0] = jsonMatch[1];
      }
    }
    
    if (jsonMatch) {
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Validate parsed response structure
      if (parsedResponse && (parsedResponse.items || parsedResponse.recipes)) {
        menuItems = parsedResponse.items || parsedResponse.recipes || [];
        summary = parsedResponse.summary || summary;
        
        console.log(`Successfully parsed ${menuItems.length} menu items from GPT response`);
        
        // Validate and fix menu items costs
        menuItems = menuItems.map((item: any) => ({
          ...item,
          cost: Math.max(item.cost || 0, 2.0), // Ensure minimum cost
          servings: item.servings || totalFuncionarios
        }));
        
      } else {
        throw new Error('Invalid response structure - missing items/recipes');
      }
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (parseError) {
    console.error('JSON parsing error:', parseError);
    console.log('Creating smart fallback menu with real cost calculations...');
    
    // Enhanced fallback: create structured menu using database and market data
    menuItems = await createFallbackMenu(supabaseClient, marketProducts || [], budget, restrictions, totalFuncionarios);
    
    const totalCost = menuItems.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
    summary = {
      total_cost: totalCost,
      average_cost_per_person: totalCost / totalFuncionarios,
      within_budget: totalCost <= (budget * totalFuncionarios),
      total_recipes: menuItems.length,
      promotions_used: menuItems.filter((item: any) => item.promocao).length,
      fallback_used: true
    };
    
    console.log(`Fallback menu created with total cost: R$${totalCost.toFixed(2)}`);
  }

  // Convert menuItems to recipes format expected by frontend with proper cost calculation
  const recipes = menuItems.map((item: any, index: number) => {
    // Ensure minimum cost calculation based on ingredients or fallback
    const baseCost = item.cost || 0;
    const ingredientCount = item.ingredients?.length || 2;
    const minimumCost = Math.max(baseCost, ingredientCount * 1.5); // R$1.50 per ingredient minimum
    
    return {
      id: item.receita_id_legado || `recipe_${index + 1}`,
      name: item.name || `Receita ${index + 1}`,
      description: item.description || 'Prato nutritivo e saboroso',
      category: item.category || 'Principal',
      costPerServing: minimumCost,
      prepTime: item.prepTime || item.tempo_preparo || 30,
      difficulty: item.difficulty || 'Médio',
      day: item.day || 'Sem especificação',
      nutritionalInfo: {
        calories: item.nutritionalInfo?.calories || 300 + (index * 50),
        protein: item.nutritionalInfo?.protein || (item.category === 'protein' ? 25 : 10),
        carbs: item.nutritionalInfo?.carbs || (item.category === 'carb' ? 45 : 20),
        fat: item.nutritionalInfo?.fat || 15,
        fiber: item.nutritionalInfo?.fiber || 8
      },
      ingredients: item.ingredients?.map((ing: any) => ({
        name: ing.nome || ing.name || 'Ingrediente',
        quantity: ing.quantidade || ing.quantity || 100,
        unit: ing.unidade || ing.unit || 'g',
        produto_base_id: ing.produto_base_id
      })) || [
        { name: 'Ingrediente principal', quantity: 200, unit: 'g' },
        { name: 'Temperos', quantity: 10, unit: 'g' }
      ],
      instructions: item.instructions || item.modo_preparo || 'Seguir receita padrão',
      receita_id_legado: item.receita_id_legado,
      servings: item.servings || totalFuncionarios
    };
  });

  // Calculate accurate totals based on recipes
  const calculatedTotalCost = recipes.reduce((sum: number, recipe: any) => sum + (recipe.costPerServing || 0), 0);
  const calculatedCostPerMeal = calculatedTotalCost / Math.max(totalFuncionarios, 1);
  const isWithinBudget = calculatedCostPerMeal <= budget;
  
  // Create menu object in the format expected by frontend with accurate calculations
  const menu = {
    id: Date.now().toString(),
    total_cost: Math.max(calculatedTotalCost, summary.total_cost || 0),
    cost_per_meal: Math.max(calculatedCostPerMeal, summary.average_cost_per_person || 0),
    within_budget: isWithinBudget,
    recipes: recipes,
    summary: {
      total_recipes: recipes.length,
      total_cost: Math.max(calculatedTotalCost, summary.total_cost || 0),
      average_cost_per_meal: Math.max(calculatedCostPerMeal, summary.average_cost_per_person || 0),
      within_budget: isWithinBudget,
      promotions_used: summary.promotions_used || 0,
      fallback_used: summary.fallback_used || false,
      cost_calculation_method: summary.fallback_used ? 'database_fallback' : 'ai_generated'
    },
    functionsUsed: true // Flag to indicate function calling was used
  };

  return new Response(
    JSON.stringify({ success: true, menu, assistantResponse }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// NEW FUNCTIONS FOR DAILY COST ADAPTATION SYSTEM

async function executeFunctionAdaptRecipeToDailyCost(supabaseClient: any, args: any) {
  try {
    console.log('Executing adapt_recipe_to_daily_cost function with args:', args);
    
    const { receita_id, custo_alvo, total_funcionarios, dia_semana } = args;
    
    // Get the original recipe from receitas_legado
    const { data: receitaOriginal } = await supabaseClient
      .from('receitas_legado')
      .select('*')
      .eq('receita_id_legado', receita_id)
      .single();
    
    if (!receitaOriginal) {
      return { error: `Receita ${receita_id} não encontrada` };
    }
    
    // Get recipe ingredients
    const { data: ingredientes } = await supabaseClient
      .from('receita_ingredientes')
      .select('*')
      .eq('receita_id_legado', receita_id);
    
    if (!ingredientes || ingredientes.length === 0) {
      return { error: `Ingredientes da receita ${receita_id} não encontrados` };
    }
    
    // Calculate original cost per serving
    const custoOriginalTotal = receitaOriginal.custo_total || 0;
    const porcoesOriginais = receitaOriginal.porcoes || 1;
    const custoOriginalPorPorcao = custoOriginalTotal / porcoesOriginais;
    
    // Calculate adaptation factor to fit target cost
    let fatorAdaptacao = 1;
    if (custoOriginalPorPorcao > 0) {
      fatorAdaptacao = custo_alvo / custoOriginalPorPorcao;
    }
    
    // Limit adaptation factor to reasonable bounds (don't reduce below 30% or increase above 200%)
    fatorAdaptacao = Math.max(0.3, Math.min(2.0, fatorAdaptacao));
    
    // Adapt ingredients
    const ingredientesAdaptados = ingredientes.map(ing => ({
      produto_base_id: ing.produto_base_id,
      nome: ing.notas || 'Ingrediente',
      quantidade_original: ing.quantidade,
      quantidade_adaptada: ing.quantidade * fatorAdaptacao,
      unidade: ing.unidade,
      fator_adaptacao: fatorAdaptacao
    }));
    
    // Calculate new cost estimation
    const custoEstimadoAdaptado = custoOriginalPorPorcao * fatorAdaptacao;
    const custoTotalParaFuncionarios = custoEstimadoAdaptado * total_funcionarios;
    
    return {
      receita_id: receita_id,
      nome_receita: receitaOriginal.nome_receita,
      dia_semana: dia_semana,
      custo_original_por_porcao: custoOriginalPorPorcao,
      custo_alvo: custo_alvo,
      custo_adaptado: custoEstimadoAdaptado,
      fator_adaptacao: fatorAdaptacao,
      porcoes_originais: porcoesOriginais,
      total_funcionarios: total_funcionarios,
      custo_total_funcionarios: custoTotalParaFuncionarios,
      ingredientes_adaptados: ingredientesAdaptados,
      observacoes: fatorAdaptacao < 0.7 ? 
        `Receita reduzida em ${Math.round((1-fatorAdaptacao)*100)}% para caber no orçamento` :
        fatorAdaptacao > 1.3 ? 
        `Receita aumentada em ${Math.round((fatorAdaptacao-1)*100)}% para melhor valor` :
        'Receita mantida próxima ao original',
      viabilidade: custoEstimadoAdaptado <= custo_alvo ? 'VIÁVEL' : 'LIMITE_EXCEDIDO'
    };
    
  } catch (error) {
    console.error('Error in executeFunctionAdaptRecipeToDailyCost:', error);
    return { error: error.message };
  }
}

async function executeFunctionValidateDailyBudget(supabaseClient: any, args: any) {
  try {
    console.log('Executing validate_daily_budget function with args:', args);
    
    const { receitas_dia, custo_dia, tolerancia_percentual = 10, dia_semana } = args;
    
    // Calculate total cost for the day
    const custoTotalDia = receitas_dia.reduce((total: number, receita: any) => {
      return total + (receita.custo_estimado || 0);
    }, 0);
    
    // Calculate limits
    const limiteSuperior = custo_dia * (1 + tolerancia_percentual / 100);
    const limiteInferior = custo_dia * 0.8; // Allow 20% below target
    
    // Validate budget compliance
    const dentroOrcamento = custoTotalDia <= limiteSuperior;
    const acimaMinimoRecomendado = custoTotalDia >= limiteInferior;
    
    // Calculate percentages
    const percentualDoCusto = (custoTotalDia / custo_dia) * 100;
    const economiaOuExcesso = custo_dia - custoTotalDia;
    
    // Generate recommendations
    const recomendacoes = [];
    
    if (custoTotalDia > limiteSuperior) {
      recomendacoes.push(`Custo excede o limite em R$ ${(custoTotalDia - limiteSuperior).toFixed(2)}`);
      recomendacoes.push('Reduzir porções ou substituir ingredientes mais caros');
    } else if (custoTotalDia < limiteInferior) {
      recomendacoes.push(`Custo muito baixo, pode melhorar qualidade em R$ ${(limiteInferior - custoTotalDia).toFixed(2)}`);
      recomendacoes.push('Considerar ingredientes premium ou aumentar porções');
    } else {
      recomendacoes.push('Custo dentro da faixa ideal para o dia');
    }
    
    // Analyze individual recipes
    const analiseReceitas = receitas_dia.map((receita: any) => {
      const percentualDoTotal = (receita.custo_estimado / custoTotalDia) * 100;
      return {
        receita_id: receita.receita_id,
        custo: receita.custo_estimado,
        percentual_do_total: percentualDoTotal,
        classificacao: percentualDoTotal > 40 ? 'ALTA' : 
                      percentualDoTotal > 25 ? 'MÉDIA' : 'BAIXA'
      };
    });
    
    return {
      dia_semana: dia_semana,
      custo_alvo: custo_dia,
      custo_total_dia: custoTotalDia,
      limite_superior: limiteSuperior,
      limite_inferior: limiteInferior,
      percentual_do_custo: percentualDoCusto,
      economia_ou_excesso: economiaOuExcesso,
      dentro_orcamento: dentroOrcamento,
      acima_minimo_recomendado: acimaMinimoRecomendado,
      status: dentroOrcamento && acimaMinimoRecomendado ? 'APROVADO' : 
              !dentroOrcamento ? 'EXCEDE_ORCAMENTO' : 'ABAIXO_MINIMO',
      recomendacoes: recomendacoes,
      analise_receitas: analiseReceitas,
      total_receitas: receitas_dia.length
    };
    
  } catch (error) {
    console.error('Error in executeFunctionValidateDailyBudget:', error);
    return { error: error.message };
  }
}
