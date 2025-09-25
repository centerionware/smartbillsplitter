
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
    additionalInfo: {
        type: Type.ARRAY,
        description: "A list of any other relevant key-value pairs from the receipt, like store address, tracking numbers, return policies, or promotional details.",
        nullable: true,
        items: {
          type: Type.OBJECT,
          properties: {
            key: {
              type: Type.STRING,
              description: "The label for the piece of information (e.g., 'Store Address', 'Tracking Number')."
            },
            value: {
              type: Type.STRING,
              description: "The value of the information (e.g., '123 Main St, Anytown', '1Z9999W99999999999')."
            }
          },
          required: ["key", "value"]
        }
    },
  },
  required: ["description", "items"],
};


// --- Business Logic ---
// This function contains the core logic for parsing a receipt and is independent of the server framework.
async function scanReceiptLogic(base64Image: string, mimeType: string) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY environment variable not set.");
    // Throw a specific error for the handler to catch and return the correct HTTP status.
    throw new Error('Server configuration error: API key is not set.');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const imagePart = { inlineData: { data: base64Image, mimeType: mimeType } };
    const textPart = { text: "Analyze the provided receipt image. Extract a concise description (like the store name), the date, the final total, a list of all line items with their individual prices, and a list of any other relevant information (like store location, tracking numbers, etc.) as key-value pairs. Ignore any taxes, tips, or subtotals that are not individual items. Return all data in the specified JSON format." };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });
    
    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    // Rethrow to be handled by the adapter layer.
    throw new Error(`Failed to communicate with the AI service: ${error.message}`);
  }
}

// --- Framework-Agnostic Handler ---
// This function is now independent of Express.js.
export const scanReceiptHandler = async (req: HttpRequest): Promise<HttpResponse> => {
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  const { base64Image, mimeType } = req.body;
  if (!base64Image || !mimeType) {
    return {
      statusCode: 400,
      headers: responseHeaders,
      body: JSON.stringify({ error: 'Missing required parameters: base64Image and mimeType.' }),
    };
  }

  try {
    const parsedData = await scanReceiptLogic(base64Image, mimeType);
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(parsedData),
    };
  } catch (error: any) {
    // Check for specific error messages to return appropriate status codes.
    const statusCode = error.message.startsWith('Server configuration error') ? 500 : 500;
    return {
      statusCode: statusCode,
      headers: responseHeaders,
      body: JSON.stringify({ error: 'Failed to process receipt.', details: error.message }),
    };
  }
};