import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;
let initError: string | null = null;

// Attempt to initialize the Gemini client when the module is loaded.
try {
  const API_KEY = process.env.API_KEY;
  // The SDK constructor will throw an error if the API_KEY is missing or invalid.
  ai = new GoogleGenAI({ apiKey: API_KEY! });
} catch (error: any) {
  console.error("Failed to initialize Gemini AI Client:", error.message);
  // Store a user-friendly error message that can be displayed in the UI.
  initError = "The AI receipt scanner is not available because the API Key is not configured for this deployment. Please contact the administrator.";
}

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "A list of all items found on the receipt.",
      items: {
        type: Type.OBJECT,
        description: "A single item from the receipt.",
        properties: {
          name: {
            type: Type.STRING,
            description: "The name of the product or service.",
          },
          price: {
            type: Type.NUMBER,
            description: "The price of the item.",
          },
        },
        required: ["name", "price"],
      },
    },
  },
  required: ["items"],
};


export const parseReceipt = async (base64Image: string, mimeType: string): Promise<{ items: { name: string; price: number }[] }> => {
  if (initError || !ai) {
    // If initialization failed, throw the stored error message.
    throw new Error(initError || "AI client is not available.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
          {
            text: "You are an expert receipt OCR and data extraction tool. Analyze the provided image of a receipt. Extract each line item with its corresponding price. Ignore taxes, tips, and totals. Return the data as a JSON object that adheres to the provided schema. If an item has no price, ignore it.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);

    // Basic validation to ensure the response structure matches expectations
    if (parsedJson && Array.isArray(parsedJson.items)) {
      return parsedJson;
    } else {
      throw new Error("Invalid JSON structure received from API.");
    }
  } catch (error) {
    console.error("Error parsing receipt with Gemini API:", error);
    throw new Error("Failed to analyze receipt. Please try another image or enter items manually.");
  }
};
