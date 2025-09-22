import React, { useState, useCallback, useRef } from 'react';
import { parseReceipt } from '../services/geminiService.ts';

interface ScannedData {
  description: string;
  date?: string;
  items: { name: string; price: number }[];
}

interface ReceiptScannerProps {
  onItemsScanned: (data: ScannedData) => void;
}

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onItemsScanned }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
  }, []);

  const handleOpenCamera = useCallback(async () => {
    stopCameraStream();
    setCameraError(null);
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera access is not supported by your browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' } // Prefer the rear camera
        });
        streamRef.current = stream;
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        setIsCameraOpen(true);
    } catch (err: any) {
        console.error("Error accessing camera:", err);
        let message = "Could not access the camera. Please ensure you have granted permission.";
        if (err.name === 'NotAllowedError') {
            message = "Camera access was denied. Please enable it in your browser settings.";
        } else if (err.name === 'NotFoundError') {
            message = "No camera was found on your device.";
        }
        setCameraError(message);
    }
  }, [stopCameraStream]);

  const handleCloseCamera = useCallback(() => {
    stopCameraStream();
    setIsCameraOpen(false);
  }, [stopCameraStream]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPreviewUrl(dataUrl);
        
        // Convert data URL to a File object to keep the process consistent
        fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                setSelectedFile(file);
            });
    }
    handleCloseCamera();
  }, [handleCloseCamera]);


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
        onItemsScanned(result);
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
    <>
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 flex justify-center items-center gap-4">
              <button onClick={handleCloseCamera} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg">Cancel</button>
              <button onClick={handleCapture} className="w-20 h-20 bg-white rounded-full border-4 border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"></button>
          </div>
        </div>
      )}
      <div className="mb-6 p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center bg-slate-50 dark:bg-slate-700/30">
        <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Scan a Receipt (Optional)</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Let AI extract the items and prices for you.</p>
        
        <div className="flex justify-center gap-4">
            <input
                type="file"
                id="receipt-upload"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
            <label
                htmlFor="receipt-upload"
                className="cursor-pointer inline-flex items-center gap-2 bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 font-semibold px-4 py-2 border border-teal-500 rounded-lg hover:bg-teal-50 dark:hover:bg-slate-600"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span>Choose Image</span>
            </label>
             <button
                type="button"
                onClick={handleOpenCamera}
                className="cursor-pointer inline-flex items-center gap-2 bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 font-semibold px-4 py-2 border border-teal-500 rounded-lg hover:bg-teal-50 dark:hover:bg-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>Use Camera</span>
            </button>
        </div>

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
        {cameraError && <p className="mt-4 text-sm text-red-600 bg-red-100 p-3 rounded-md dark:bg-red-900/50 dark:text-red-400">{cameraError}</p>}
      </div>
    </>
  );
};

export default ReceiptScanner;