import { GoogleGenAI, Type } from "@google/genai";
import { HttpRequest, HttpResponse } from '../http-types';

// --- Schemas for Gemini API ---
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

// --- Handler ---
export const parseCsvHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    if (!process.env.API_KEY) {
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: "API key for Gemini is not configured on the server." }) };
    }

    const { csvContent, myDisplayName } = req.body;
    if (!csvContent || !myDisplayName) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: "Missing csvContent or myDisplayName in request body." }) };
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
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

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: responseText.trim(),
        };

    } catch (error: any) {
        console.error('Error calling Gemini API for CSV parsing:', error);
        let errorMessage = "Failed to process the CSV with the AI service.";
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