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
    description: {
      type: Type.STRING,
      description: "A short description of the bill, typically the merchant's name.",
    },
    date: {
      type: Type.STRING,
      description: "The date of the transaction from the receipt, formatted as YYYY-MM-DD. Omit if not found.",
    },
    items: {
      type: Type.ARRAY,
      description: "A list of all items, including products, taxes, fees, and tips found on the receipt.",
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
  required: ["description", "items"],
};


export const parseReceipt = async (base64Image: string, mimeType: string): Promise<{ description: string; date?: string; items: { name: string; price: number }[] }> => {
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
            text: `You are an expert receipt OCR and data extraction tool. Analyze the provided image of a receipt.
            1.  Extract the merchant's name to be used as the bill description.
            2.  Extract the date of the transaction. Format it as YYYY-MM-DD.
            3.  Extract each individual line item with its corresponding price.
            4.  Explicitly extract any Tax, Tip, Delivery Fees, or Service Charges as their own separate items in the list.
            5.  Return the data as a single JSON object that adheres to the provided schema. If an item has no price, ignore it. If the date is not found, omit the date field from the JSON object.`,
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
    if (parsedJson && parsedJson.description && Array.isArray(parsedJson.items)) {
      return parsedJson;
    } else {
      throw new Error("Invalid JSON structure received from API.");
    }
  } catch (error) {
    console.error("Error parsing receipt with Gemini API:", error);
    throw new Error("Failed to analyze receipt. Please try another image or enter items manually.");
  }
};