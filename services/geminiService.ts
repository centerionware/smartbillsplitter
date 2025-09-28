import { GoogleGenAI, Type } from '@google/genai';
import { getApiUrl, fetchWithRetry } from './api.ts';
import type { Bill } from '../types.ts';

// The expected structure of the response from our serverless function.
interface ScannedReceiptData {
  description: string;
  date?: string;
  items: { name: string; price: number }[];
  total?: number;
  additionalInfo?: { key: string; value: string }[];
}

export const parseReceipt = async (base64Image: string, mimeType: string): Promise<ScannedReceiptData> => {
  try {
    // The path to our new self-hosted backend endpoint.
    // The Ingress will route this to the backend service.
    const response = await fetchWithRetry(getApiUrl('/scan-receipt'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Image, mimeType }),
    });

    if (!response.ok) {
        // Try to parse the error message from the function's response.
        const errorData = await response.json().catch(() => ({})); // Gracefully handle non-JSON error responses
        const errorMessage = errorData.error || `Failed to analyze receipt. The server responded with status: ${response.status}`;
        throw new Error(errorMessage);
    }
    
    const parsedJson: ScannedReceiptData = await response.json();

    // Basic validation to ensure the response structure matches expectations
    if (parsedJson && parsedJson.description && Array.isArray(parsedJson.items)) {
      return parsedJson;
    } else {
      throw new Error("Invalid JSON structure received from the server.");
    }
  } catch (error) {
    console.error("Error calling receipt parsing service:", error);
    // Re-throw a user-friendly message.
    // If the error came from our function, it might already be user-friendly.
    if (error instanceof Error) {
        // Use the specific message from the server if available, otherwise provide a generic one.
        throw new Error(error.message || "Failed to analyze receipt. Please try another image or enter items manually.");
    }
    throw new Error("An unknown error occurred while analyzing the receipt.");
  }
};

// --- CSV Parsing ---

const billSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: "A short, descriptive title for the bill." },
    totalAmount: { type: Type.NUMBER, description: "The total amount of the bill. This should be the sum of all participants' owed amounts if not explicitly provided." },
    date: { type: Type.STRING, description: "The date of the transaction in YYYY-MM-DD format. Infer if possible from the data." },
    participants: {
      type: Type.ARRAY,
      description: "A list of people involved in this bill.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The participant's name." },
          amountOwed: { type: Type.NUMBER, description: "The amount this specific person owes." },
          paid: { type: Type.BOOLEAN, description: "Whether this person has paid. Default to false unless indicated otherwise." }
        },
        required: ["name", "amountOwed", "paid"]
      }
    }
  },
  required: ["description", "totalAmount", "date", "participants"]
};

const csvResponseSchema = {
    type: Type.ARRAY,
    description: "A list of bill objects extracted from the CSV.",
    items: billSchema
};

export type ParsedBillFromCsv = Omit<Bill, 'id' | 'status'>;

export const parseCsv = async (csvContent: string, myDisplayName: string): Promise<ParsedBillFromCsv[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        const prompt = `
            You are an intelligent data processor for a bill splitting application. Your task is to analyze the following CSV data and convert it into a JSON array of bill objects.

            **Instructions:**
            1.  Read the CSV data carefully. The columns might be in any order and might not have standard names.
            2.  Identify logical groupings of rows that belong to the same bill. Rows with the same description, date, or a clear grouping indicator should be treated as a single bill with multiple participants.
            3.  For each bill, you must extract: a description, a total amount, a date (in YYYY-MM-DD format), and a list of participants.
            4.  For each participant, you must extract their name, the amount they owe, and their payment status (paid: true/false).
            5.  The user who is performing this import is named "${myDisplayName}". If the CSV indicates a single person paid for a bill (e.g., they are the 'payer' or 'paid by' column), assume it is "${myDisplayName}" and set their "paid" status to true. All other participants should be "paid: false". If payment information is unclear, default all participants to "paid: false".
            6.  The \`totalAmount\` for a bill should be the sum of all \`amountOwed\` for its participants.
            7.  The final output MUST be a JSON array that strictly conforms to the provided schema. Do not include any extra text or explanations.

            **CSV Data:**
            \`\`\`csv
            ${csvContent}
            \`\`\`
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: csvResponseSchema,
          },
        });
        
        const responseText = response.text;
        if (!responseText) {
            throw new Error("The AI returned an empty response. The CSV might be empty or in an unsupported format.");
        }
        
        const parsedJson = JSON.parse(responseText.trim());

        // Basic validation
        if (Array.isArray(parsedJson)) {
            // Further validation could be added here to check if objects match the Bill structure
            return parsedJson as ParsedBillFromCsv[];
        } else {
            throw new Error("Invalid JSON structure received from the AI. Expected an array of bills.");
        }

    } catch (error) {
        console.error("Error calling Gemini API for CSV parsing:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to analyze CSV. The AI service responded with an error: ${error.message}`);
        }
        throw new Error("An unknown error occurred while analyzing the CSV.");
    }
};
