/**
 * Simplified GPT assistant for recipe generation only
 * All calculations moved to frontend
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

export async function generateRecipesOnly(requestData: any) {
  const { client_data, meal_quantity = 50, simple_mode = true } = requestData;
  
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `
Você é um chef especialista em cardápios institucionais. Gere um cardápio semanal simples para:

CLIENTE: ${client_data.nome}
REFEIÇÕES POR DIA: ${meal_quantity}
ORÇAMENTO MÁXIMO: R$ ${client_data.custo_maximo_refeicao}/refeição
RESTRIÇÕES: ${client_data.restricoes_alimentares?.join(', ') || 'Nenhuma'}
PREFERÊNCIAS: ${client_data.preferencias_alimentares?.join(', ') || 'Nenhuma'}

INSTRUÇÕES:
1. Retorne APENAS um JSON válido
2. Gere 14 receitas (2 por dia da semana)
3. Foque em receitas simples e econômicas
4. Inclua variedade proteica e vegetais
5. NÃO calcule custos - isso será feito posteriormente

FORMATO DE RESPOSTA OBRIGATÓRIO:
{
  "recipes": [
    {
      "nome": "Nome da Receita",
      "dia": "segunda-feira",
      "tipo": "prato_principal" ou "acompanhamento",
      "rendimento": ${meal_quantity},
      "ingredientes": [
        {
          "nome": "nome do ingrediente",
          "quantidade": numero,
          "unidade": "kg/g/l/ml/un/dente",
          "produto_base_descricao": "nome para busca no mercado"
        }
      ]
    }
  ]
}

IMPORTANTE: Retorne apenas o JSON, sem explicações adicionais.
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um chef especialista. Responda sempre em JSON válido.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const recipesData = JSON.parse(jsonMatch[0]);
    
    if (!recipesData.recipes || !Array.isArray(recipesData.recipes)) {
      throw new Error('Invalid recipe format returned');
    }

    console.log(`Generated ${recipesData.recipes.length} recipes successfully`);

    return {
      success: true,
      recipes: recipesData.recipes,
      generated_at: new Date().toISOString(),
      mode: 'simplified'
    };

  } catch (error) {
    console.error('Error generating recipes:', error);
    throw new Error(`Recipe generation failed: ${error.message}`);
  }
}