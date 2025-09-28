import { getApiUrl, fetchWithRetry } from './api.ts';

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