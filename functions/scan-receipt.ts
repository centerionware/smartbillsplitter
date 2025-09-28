import { GoogleGenAI, Type } from "@google/genai";
import { HttpRequest, HttpResponse } from '../http-types';

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
        description: "The final total amount explicitly printed on the receipt after all taxes and tips. Extract this value directly; do not calculate it from the items. This should be the final amount paid.",
        nullable: true,
    },
    items: {
      type: Type.ARRAY,
      description: "A list of all the individual items found on the receipt. Do not include tax, tip, or subtotal as items.",
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
    additionalInfo: {
        type: Type.ARRAY,
        description: "A list of any other relevant key-value pairs from the receipt, like store address, phone numbers, tax amounts, or tip amounts.",
        nullable: true,
        items: {
          type: Type.OBJECT,
          properties: {
            key: {
              type: Type.STRING,
              description: "The name of the information field (e.g., 'Tax', 'Tip', 'Address')."
            },
            value: {
              type: Type.STRING,
              description: "The value of the information field (e.g., '$1.25', '123 Main St')."
            }
          },
          required: ["key", "value"]
        }
    }
  },
  required: ["description", "items"],
};


export const scanReceiptHandler = async (req: HttpRequest): Promise<HttpResponse> => {
  if (!process.env.API_KEY) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: "API key for Gemini is not configured on the server." }) };
  }

  const { base64Image, mimeType } = req.body;
  if (!base64Image || !mimeType) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: "Missing base64Image or mimeType in request body." }) };
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Image,
      },
    };
    
    const textPart = {
      text: 'Extract the information from this receipt into the provided JSON schema. Focus on accurately identifying all individual line items and the final printed total.'
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });
    
    const responseText = response.text;
    if (!responseText) {
      throw new Error("The AI returned an empty response. The receipt might be unclear.");
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: responseText.trim(),
    };

  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    let errorMessage = "Failed to process the receipt with the AI service.";
    if (error.message) {
        errorMessage = error.message;
    }
    return { 
        statusCode: 500, 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ error: errorMessage })
    };
  }
};
