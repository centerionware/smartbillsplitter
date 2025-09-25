import { GoogleGenAI, Type } from "@google/genai";
// FIX: Changed import to use RequestHandler for robust Express handler typing.
import { RequestHandler } from 'express';

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

// The main handler, now an Express RequestHandler.
// FIX: Explicitly typed the handler with RequestHandler to ensure correct types for req and res.
export const scanReceiptHandler: RequestHandler = async (req, res) => {
  const { base64Image, mimeType } = req.body;
  if (!base64Image || !mimeType) {
    return res.status(400).json({ error: 'Missing required parameters: base64Image and mimeType.' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY environment variable not set.");
    return res.status(500).json({ error: 'Server configuration error: API key is not set.' });
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
    
    const parsedData = JSON.parse(response.text);

    return res.status(200).json(parsedData);

  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    return res.status(500).json({ error: 'Failed to communicate with the AI service.', details: error.message });
  }
};