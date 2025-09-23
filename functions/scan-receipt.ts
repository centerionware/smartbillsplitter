import { GoogleGenAI, Type } from "@google/genai";
// FIX: Changed from 'import type' to a direct import to ensure Express types are resolved correctly, avoiding conflicts with global DOM types.
// FIX: Import the full express module to use express.Request and express.Response, avoiding type conflicts with global DOM types.
import { Request, Response } from 'express';

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

// The main handler, now an Express RequestHandler.
export const scanReceiptHandler = async (req: Request, res: Response) => {
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
    const textPart = { text: "Analyze the provided receipt image. Extract a concise description (like the store name), the date, the final total, and a list of all line items with their individual prices. Ignore any taxes, tips, or subtotals that are not individual items. Return the data in the specified JSON format." };

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