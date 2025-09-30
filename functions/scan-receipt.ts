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
      description: "A list of all the individual items found on the receipt. If tax or tip are present, include them as separate items in this list. Do not include subtotal as an item.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "The name of the purchased item. Use 'Tax' for tax amounts and 'Tip' for tip amounts.",
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
        description: "A list of any other relevant key-value pairs from the receipt, like store address or phone numbers. Do not include tax or tip here; they should be in the 'items' list.",
        nullable: true,
        items: {
          type: Type.OBJECT,
          properties: {
            key: {
              type: Type.STRING,
              description: "The name of the information field (e.g., 'Address', 'Phone Number')."
            },
            value: {
              type: Type.STRING,
              description: "The value of the information field (e.g., '123 Main St', '555-1234')."
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
      text: 'Extract the information from this receipt into the provided JSON schema. Focus on accurately identifying all individual line items, including any tax or tip, the final printed total, and any other relevant details like store address or phone number for the \'additionalInfo\' field.'
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