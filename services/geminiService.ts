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
      description: "A short, accurate description of the bill, usually the merchant's name as printed on the receipt.",
    },
    date: {
      type: Type.STRING,
      description: "The transaction date from the receipt, formatted as YYYY-MM-DD. Omit this field entirely if no date is found.",
    },
    items: {
      type: Type.ARRAY,
      description: "A list of all individual items, products, taxes, fees, and tips that are explicitly listed on the receipt.",
      items: {
        type: Type.OBJECT,
        description: "A single line item from the receipt with its name and price.",
        properties: {
          name: {
            type: Type.STRING,
            description: "The exact name of the product, service, tax, or fee as it appears on the receipt.",
          },
          price: {
            type: Type.NUMBER,
            description: "The exact numerical price of the item. This must be a number.",
          },
        },
        required: ["name", "price"],
      },
    },
    total: {
        type: Type.NUMBER,
        description: "The final total amount printed on the receipt. This should be the sum of all items, taxes, and tips. Omit if not found."
    }
  },
  required: ["description", "items"],
};


export const parseReceipt = async (base64Image: string, mimeType: string): Promise<{ description: string; date?: string; items: { name: string; price: number }[], total?: number }> => {
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
            text: `You are a highly precise financial data extraction tool specializing in receipt OCR. Your primary goal is accuracy. Analyze the provided receipt image with extreme care.

**Instructions:**
1.  **Extract Merchant Name:** Identify the merchant's name and use it for the 'description'.
2.  **Extract Date:** Find the transaction date. Format it as YYYY-MM-DD. If no date is visible, omit the 'date' field from your response.
3.  **Extract Line Items:**
    *   List every individual item, product, or service with its exact price.
    *   If you see line items for 'Tax', 'Tip', 'Service Charge', 'Delivery Fee', or similar, extract them as separate items in the list with their corresponding prices.
4.  **Extract Total Amount:** Find the final total amount paid and extract it.
5.  **Accuracy is Critical:**
    *   **DO NOT GUESS OR HALLUCINATE.** If you cannot clearly read an item or a price, do not include it. It is better to return fewer, accurate items than an incorrect or fabricated list.
    *   **DO NOT INVENT ITEMS.** Only include items and fees that are explicitly printed on the receipt. For example, do not add a "Delivery Fee" if one is not clearly listed.
    *   Prices must be extracted as numbers.

Return a single, clean JSON object that strictly adheres to the provided schema. Do not include any extra commentary or explanations.`,
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