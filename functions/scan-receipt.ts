import { GoogleGenAI, Type } from "@google/genai";

// Basic types for a Netlify Function event and response
interface HandlerEvent {
  httpMethod: string;
  body: string | null;
}

interface HandlerResponse {
  statusCode: number;
  headers?: { [key: string]: string };
  body: string;
}

// Defines the expected JSON structure from the Gemini API for consistent data handling.
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "A short, descriptive title for the receipt (e.g., 'Restaurant Name', 'Grocery Store').",
    },
    date: {
      type: Type.STRING,
      description: "The date of the transaction in YYYY-MM-DD format. Infer if possible.",
      nullable: true,
    },
    total: {
        type: Type.NUMBER,
        description: "The final total amount on the receipt after all taxes and tips.",
        nullable: true,
    },
    items: {
      type: Type.ARRAY,
      description: "A list of all the individual items found on the receipt.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "The name of the purchased item.",
          },
          price: {
            type: Type.NUMBER,
            description: "The price of the individual item.",
          },
        },
        required: ["name", "price"],
      },
    },
  },
  required: ["description", "items"],
};

// The main handler for the Netlify serverless function.
export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    if (!event.body) {
      throw new Error("Request body is empty.");
    }
    body = JSON.parse(event.body);
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON in request body.' }) };
  }
  
  const { base64Image, mimeType } = body;
  if (!base64Image || !mimeType) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required parameters: base64Image and mimeType.' }) };
  }

  // Securely access the API_KEY from Netlify's environment variables.
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY environment variable not set.");
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: API key is not set.' }) };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const imagePart = { inlineData: { data: base64Image, mimeType: mimeType } };
    const textPart = { text: "Analyze the provided receipt image. Extract a concise description (like the store name), the date, the final total, and a list of all line items with their individual prices. Ignore any taxes, tips, or subtotals that are not individual items. Return the data in the specified JSON format." };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });
    
    // The response.text is a stringified JSON, which we can pass through directly.
    // We'll parse it first to ensure it's valid JSON before sending.
    const parsedData = JSON.parse(response.text);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsedData),
    };

  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to communicate with the AI service.', details: error.message }) };
  }
};