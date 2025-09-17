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
Você é um chef especialista em cardápios institucionais brasileiros com vasta experiência em nutrição e gestão de custos. Gere um cardápio semanal otimizado para:

DADOS DO CLIENTE:
- Nome: ${client_data.nome}
- Refeições por dia: ${meal_quantity}
- Orçamento máximo: R$ ${client_data.custo_maximo_refeicao}/refeição
- Restrições alimentares: ${client_data.restricoes_alimentares?.join(', ') || 'Nenhuma'}
- Preferências: ${client_data.preferencias_alimentares?.join(', ') || 'Nenhuma'}

DIRETRIZES AVANÇADAS:
1. QUALIDADE NUTRICIONAL: Balance proteínas, carboidratos, vitaminas e minerais
2. SAZONALIDADE: Priorize ingredientes da estação atual no Brasil
3. VARIEDADE: Evite repetições e garanta diversidade de cores, sabores e texturas
4. ECONOMIA: Maximize aproveitamento de ingredientes e minimize desperdício
5. REGIONALIDADE: Use ingredientes típicos e acessíveis no mercado brasileiro
6. PRATICIDADE: Receitas executáveis em cozinha institucional

ESTRUTURA SEMANAL:
- 14 receitas totais (2 por dia: 1 prato principal + 1 acompanhamento)
- Rotação inteligente de proteínas (bovina, suína, frango, peixe, ovos, leguminosas)
- Incluir sempre: arroz, feijão, salada e uma fruta sazonal
- Considerar técnicas culinárias variadas (cozido, grelhado, refogado, assado)

VALIDAÇÃO DE INGREDIENTES:
- Quantidades realistas para o rendimento especificado
- Unidades corretas e padronizadas (kg, g, l, ml, un, dente, maço)
- Nomes de ingredientes precisos para identificação no mercado
- Evitar ingredientes caros ou difíceis de encontrar

FORMATO JSON OBRIGATÓRIO:
{
  "recipes": [
    {
      "nome": "Nome Descritivo da Receita",
      "dia": "segunda-feira",
      "tipo": "prato_principal" ou "acompanhamento",
      "rendimento": ${meal_quantity},
      "ingredientes": [
        {
          "nome": "nome específico do ingrediente",
          "quantidade": numero_preciso,
          "unidade": "unidade_padronizada",
          "produto_base_descricao": "nome comercial para busca no mercado"
        }
      ]
    }
  ]
}

CATEGORIAS DISPONÍVEIS CONFIRMADAS:
- Prato Principal 1: 307 receitas (proteína principal)
- Prato Principal 2: 266 receitas (proteína secundária)
- Guarnição: 140 receitas (acompanhamentos)
- Salada: 86 receitas (verduras e legumes)
- Sobremesa: 176 receitas

REGRAS DE VARIEDADE INTELIGENTE:
- Alternar tipos de proteína: bovina, suína, frango, peixe, vegetariana
- Máximo 3 carnes vermelhas na semana (bovina + suína)
- Mínimo 1 peixe na semana
- Segunda-feira: receitas simples, sem preparo avançado
- Sexta-feira: receita especial ou "prato show"
- Variedade nas guarnições: batatas, cereais, massas, legumes, raízes
- Saladas balanceadas: verduras/folhas + legumes cozidos

IMPORTANTE: Retorne EXCLUSIVAMENTE o JSON válido, sem texto adicional ou explicações.
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um chef especialista em cardápios institucionais. Foque na variedade semanal, custo-benefício e adequação nutricional. Responda sempre em JSON válido.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
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