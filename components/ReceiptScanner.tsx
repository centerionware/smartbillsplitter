import React, { useState, useCallback } from 'react';
import { parseReceipt } from '../services/geminiService';

interface ReceiptScannerProps {
  onItemsScanned: (items: { name: string; price: number }[]) => void;
}

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onItemsScanned }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleScan = useCallback(async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const base64String = await fileToBase64(selectedFile);
      const result = await parseReceipt(base64String, selectedFile.type);
      if(result && result.items) {
        onItemsScanned(result.items);
      } else {
        throw new Error("No items found in the receipt.");
      }
    } catch (e: any) {
      setError(e.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, onItemsScanned]);

  return (
    <div className="mb-6 p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center bg-slate-50 dark:bg-slate-700/30">
      <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Scan a Receipt (Optional)</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Let AI extract the items and prices for you.</p>
      
      <input
        type="file"
        id="receipt-upload"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      <label
        htmlFor="receipt-upload"
        className="cursor-pointer inline-block bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 font-semibold px-4 py-2 border border-teal-500 rounded-lg hover:bg-teal-50 dark:hover:bg-slate-600"
      >
        Choose Image
      </label>

      {previewUrl && (
        <div className="mt-4">
          <img src={previewUrl} alt="Receipt preview" className="max-h-48 mx-auto rounded-md shadow-sm" />
        </div>
      )}

      {selectedFile && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleScan}
            disabled={isLoading}
            className="w-full bg-teal-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-600 disabled:bg-slate-400 dark:disabled:bg-slate-600 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Scanning...</span>
              </>
            ) : (
              'Scan with AI'
            )}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600 bg-red-100 p-3 rounded-md dark:bg-red-900/50 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default ReceiptScanner;