
import { GoogleGenAI, Type } from "@google/genai";
import { getApiUrl, fetchWithRetry } from './api.ts';
import type { Bill, ImportedBill, Participant, ReceiptItem } from '../types.ts';

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

/**
 * Uses AI to match items from a new scan to a template's itemization rules.
 */
interface MatchAndAssignItemsParams {
  templateItems: ReceiptItem[];
  scannedItems: { name: string; price: number }[];
  participants: Participant[];
}
export const matchAndAssignItems = async ({ templateItems, scannedItems, participants }: MatchAndAssignItemsParams): Promise<ReceiptItem[]> => {
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

    const prompt = `
        You are an intelligent data processor for a bill splitting app. A user has a template for a recurring bill with items assigned to specific people. They just scanned a new receipt for this month's bill. Your task is to assign the new items to the correct people based on the template.

        Here is the context:
        - Participants in the bill: ${JSON.stringify(participants.map(p => ({ id: p.id, name: p.name })))}
        - The template's itemization (how items are usually split): ${JSON.stringify(templateItems.map(item => ({ name: item.name, assignedTo: item.assignedTo })))}
        - The newly scanned items from this month's receipt: ${JSON.stringify(scannedItems)}

        Your task:
        Create a new JSON array of items based on the "newly scanned items". For each new item, you must determine who it should be assigned to by following these rules:
        1.  Match new items to template items based on name similarity. If a new item's name is very similar to a template item's name (e.g., "Monthly Fee" vs "Service Fee", or "Netflix Premium" vs "Netflix"), assign the new item to the SAME participants as the template item. Use the participant IDs from the context provided.
        2.  If a new item appears that has NO clear match in the template (e.g., a "Late Fee" or "One-Time Charge"), assign it EQUALLY to all participants from the provided participant list.
        3.  The final JSON array must include ALL of the "newly scanned items", each with its original name and price, and your calculated 'assignedTo' array of participant IDs.
        4.  The output must be a valid JSON array that strictly conforms to the provided schema. Do not include any other text or explanations.
    `;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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
      throw new Error("AI returned an empty response.");
    }

    const parsedJson = JSON.parse(responseText.trim());
    return parsedJson.map((item: any, index: number) => ({
        ...item,
        id: `item-matched-${Date.now()}-${index}`
    }));
};


// --- CSV Parsing ---
export type ParsedBillFromCsv = Omit<Bill, 'status'>;
// FIX: Added ParsedCsvData interface to correctly type the CSV parsing result.
export interface ParsedCsvData {
  ownedBills: ParsedBillFromCsv[];
  importedBills: Omit<ImportedBill, 'status' | 'liveStatus'>[];
}


// New signature header from the export service
const EXPORT_HEADER = '# SharedBills CSV Export v2';

// Client-side parser for our own CSV format
// FIX: Rewrote parseAppCsv to handle the V2 export format and return the ParsedCsvData structure.
export const parseAppCsv = (csvContent: string): ParsedCsvData => {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
    if (lines.length < 1) return { ownedBills: [], importedBills: [] };

    const header = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1);

    const requiredCols = ['RowType', 'BillID', 'BillType', 'Description', 'Date', 'TotalAmount', 'CreatorName', 'ParticipantID', 'ParticipantName', 'AmountOwed', 'PaidStatus', 'ShareInfoJSON', 'LastUpdatedAt'];
    const colIndices: { [key: string]: number } = {};
    for (const col of requiredCols) {
        const index = header.indexOf(col);
        if (index === -1) {
            console.error("CSV parse error: Missing column", col, "Header found:", header);
            throw new Error(`CSV is missing required V2 column: "${col}". Please use the AI importer for custom formats.`);
        }
        colIndices[col] = index;
    }

    const billGroups = new Map<string, { billData: any; participants: any[] }>();
    
    // A robust CSV line parser that handles quoted fields, escaped quotes (""), and empty fields.
    const parseCsvLine = (line: string): string[] => {
        const fields: string[] = [];
        let currentField = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    currentField += '"';
                    i++; // Skip the next quote
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    currentField += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    fields.push(currentField);
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
        }
        fields.push(currentField); // Add the last field
        return fields;
    };


    rows.forEach(row => {
        if (!row.trim()) return; // Skip empty lines
        const values = parseCsvLine(row);

        if (values.length !== header.length) {
            console.warn(`Skipping malformed CSV row. Expected ${header.length} columns, found ${values.length}. Row: "${row}"`);
            return;
        }

        const billId = values[colIndices['BillID']];
        if (!billGroups.has(billId)) {
            billGroups.set(billId, { billData: {}, participants: [] });
        }
        const group = billGroups.get(billId)!;

        const rowType = values[colIndices['RowType']];
        if (rowType === 'BILL') {
            try {
                const shareInfoString = values[colIndices['ShareInfoJSON']] || '{}';
                group.billData = {
                    billType: values[colIndices['BillType']],
                    description: values[colIndices['Description']],
                    date: values[colIndices['Date']],
                    totalAmount: parseFloat(values[colIndices['TotalAmount']] || '0'),
                    creatorName: values[colIndices['CreatorName']],
                    shareInfo: JSON.parse(shareInfoString.trim() ? shareInfoString : '{}'),
                    lastUpdatedAt: parseInt(values[colIndices['LastUpdatedAt']] || '0', 10),
                };
            } catch (e) {
                console.warn(`Skipping bill due to invalid ShareInfoJSON for BillID ${billId}`, e);
            }
        } else if (rowType === 'PARTICIPANT') {
            group.participants.push({
                id: values[colIndices['ParticipantID']],
                name: values[colIndices['ParticipantName']],
                amountOwed: parseFloat(values[colIndices['AmountOwed']] || '0'),
                paid: (values[colIndices['PaidStatus']] || '').toLowerCase() === 'paid',
            });
        }
    });

    const result: ParsedCsvData = { ownedBills: [], importedBills: [] };
    for (const [billId, group] of billGroups.entries()) {
        if (!group.billData.billType) continue;

        if (group.billData.billType === 'OWNED') {
            const bill: ParsedBillFromCsv = {
                id: billId,
                description: group.billData.description,
                date: group.billData.date,
                totalAmount: group.billData.totalAmount,
                participants: group.participants,
                lastUpdatedAt: group.billData.lastUpdatedAt,
                shareInfo: group.billData.shareInfo,
            };
            result.ownedBills.push(bill);
        } else if (group.billData.billType === 'IMPORTED') {
            const { shareId, shareEncryptionKey, creatorPublicKey, myParticipantId } = group.billData.shareInfo;
            if (!shareId || !shareEncryptionKey || !creatorPublicKey || !myParticipantId) continue;
            
            const importedBill: Omit<ImportedBill, 'status' | 'liveStatus'> = {
                id: billId,
                creatorName: group.billData.creatorName,
                sharedData: {
                    bill: {
                        id: billId,
                        description: group.billData.description,
                        totalAmount: group.billData.totalAmount,
                        date: group.billData.date,
                        participants: group.participants,
                        status: 'active', // status will be set on import
                        lastUpdatedAt: group.billData.lastUpdatedAt,
                    },
                    creatorPublicKey: creatorPublicKey,
                    signature: '',
                    // FIX: Replaced empty object with a valid PaymentDetails object to satisfy the type.
                    paymentDetails: {
                        venmo: '',
                        paypal: '',
                        cashApp: '',
                        zelle: '',
                        customMessage: '',
                    },
                },
                shareId,
                shareEncryptionKey,
                lastUpdatedAt: group.billData.lastUpdatedAt,
                myParticipantId,
                localStatus: {
                    myPortionPaid: group.participants.find((p: any) => p.id === myParticipantId)?.paid ?? false,
                },
            };
            result.importedBills.push(importedBill);
        }
    }
    return result;
};

// FIX: Updated function signature and AI fallback logic to return ParsedCsvData.
export const parseCsv = async (csvContent: string, myDisplayName: string): Promise<ParsedCsvData> => {
    // Client-side detection logic
    if (csvContent.trim().startsWith(EXPORT_HEADER)) {
        try {
            console.log("Detected app-native CSV format. Parsing client-side.");
            return parseAppCsv(csvContent);
        } catch (error) {
            console.warn("Client-side CSV parsing failed, falling back to AI.", error);
            // Fallthrough to AI if client-side parsing fails
        }
    }

    try {
        const response = await fetchWithRetry(getApiUrl('/parse-csv'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ csvContent, myDisplayName }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || `Failed to analyze CSV. The server responded with status: ${response.status}`;
            throw new Error(errorMessage);
        }

        const parsedJson = await response.json();

        // Basic validation
        if (Array.isArray(parsedJson)) {
            // Further validation could be added here to check if objects match the Bill structure
            return {
                ownedBills: parsedJson as ParsedBillFromCsv[],
                importedBills: [],
            };
        } else {
            throw new Error("Invalid JSON structure received from the AI. Expected an array of bills.");
        }

    } catch (error) {
        console.error("Error calling CSV parsing service:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to analyze CSV. The service responded with an error: ${error.message}`);
        }
        throw new Error("An unknown error occurred while analyzing the CSV.");
    }
};