import { GoogleGenAI, Type } from "@google/genai";
import { HttpRequest, HttpResponse } from '../http-types';

// Defines the expected JSON structure from the Gemini API for consistent data handling.
const responseSchema = {
    type: Type.ARRAY,
    description: "The list of newly scanned items with participant assignments based on the template.",
    items: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            price: { type: Type.NUMBER },
            assignedTo: {
                type: Type.ARRAY,
                description: "An array of participant IDs that this item is assigned to.",
                items: { type: Type.STRING }
            }
        },
        required: ["name", "price", "assignedTo"]
    }
};

export const matchItemsHandler = async (req: HttpRequest): Promise<HttpResponse> => {
  if (!process.env.API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key for Gemini is not configured on the server." }) };
  }

  const { templateItems, scannedItems, participants } = req.body;
  if (!templateItems || !scannedItems || !participants) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing templateItems, scannedItems, or participants in request body." }) };
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
     const prompt = `
        You are an intelligent data processor for a bill splitting app. A user has a template for a recurring bill with items assigned to specific people. They just scanned a new receipt for this month's bill. Your task is to assign the new items to the correct people based on the template.

        Here is the context:
        - Participants in the bill: ${JSON.stringify(participants.map((p: any) => ({ id: p.id, name: p.name })))}
        - The template's itemization (how items are usually split): ${JSON.stringify(templateItems.map((item: any) => ({ name: item.name, assignedTo: item.assignedTo })))}
        - The newly scanned items from this month's receipt: ${JSON.stringify(scannedItems)}

        Your task:
        Create a new JSON array of items based on the "newly scanned items". For each new item, you must determine who it should be assigned to by following these rules:
        1.  Match new items to template items based on name similarity. If a new item's name is very similar to a template item's name (e.g., "Monthly Fee" vs "Service Fee", or "Netflix Premium" vs "Netflix"), assign the new item to the SAME participants as the template item. Use the participant IDs from the context provided.
        2.  If a new item appears that has NO clear match in the template (e.g., a "Late Fee" or "One-Time Charge"), assign it EQUALLY to all participants from the provided participant list.
        3.  The final JSON array must include ALL of the "newly scanned items", each with its original name and price, and your calculated 'assignedTo' array of participant IDs.
        4.  The output must be a valid JSON array that strictly conforms to the provided schema. Do not include any other text or explanations.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });
    
    const responseText = response.text;
    if (!responseText) {
      throw new Error("The AI returned an empty response for item matching.");
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: responseText.trim(),
    };

  } catch (error: any) {
    console.error('Error calling Gemini API for item matching:', error);
    let errorMessage = "Failed to process item matching with the AI service.";
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