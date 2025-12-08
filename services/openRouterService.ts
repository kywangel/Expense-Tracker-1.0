export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
  };
}

export const callOpenRouter = async (
  messages: OpenRouterMessage[],
  options: {
    model?: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
  } = {}
): Promise<OpenRouterResponse> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenRouter API key is not configured');
  }

  const payload: OpenRouterRequest = {
    model: options.model || 'amazon/nova-2-lite-v1:free',
    messages,
    max_tokens: options.max_tokens || 4000,
    temperature: options.temperature || 0.7,
    stream: options.stream || false,
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href || 'http://localhost:3000',
        'X-Title': 'AI Expense Tracker',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    throw error;
  }
};

// Helper function for common AI tasks in your app
export const analyzeTransactionsWithAI = async (
  transactionsText: string,
  categories: {
    incomeCategories: string[];
    expenseCategories: string[];
    investmentCategories: string[];
  }
): Promise<string> => {
  const prompt = `
You are a financial assistant. Analyze the following transaction data and provide insights:

Transactions:
${transactionsText}

Available Categories:
- Income: ${categories.incomeCategories.join(', ')}
- Expenses: ${categories.expenseCategories.join(', ')}
- Investments: ${categories.investmentCategories.join(', ')}

Please provide:
1. Summary of spending patterns
2. Suggestions for budget optimization
3. Any anomalies or unusual transactions

Format your response in clear, concise paragraphs.
`;

  const response = await callOpenRouter([
    { role: 'system', content: 'You are a helpful financial analyst.' },
    { role: 'user', content: prompt }
  ]);

  return response.choices[0].message.content;
};

// Function for PDF/Statement parsing
export const parseStatementWithAI = async (
  statementText: string,
  context: string = 'bank statement'
): Promise<string> => {
  const prompt = `
Parse the following ${context} and extract transaction information.
Return the data in this exact JSON format:

{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": number,
      "category": "string from provided categories",
      "note": "description from statement",
      "type": "expense" or "income" or "investment"
    }
  ]
}

Statement content:
${statementText}

Important: Only return valid JSON, no additional text.
`;

  const response = await callOpenRouter([
    { role: 'system', content: 'You are a data extraction specialist. Return only JSON.' },
    { role: 'user', content: prompt }
  ]);

  return response.choices[0].message.content;
};
