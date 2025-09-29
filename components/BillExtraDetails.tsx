import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ReceiptItem } from '../types.ts';

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

// Helper to resize and compress an image file
const resizeImage = (file: File): Promise<{ dataUrl: string; file: File }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (!event.target?.result) return reject(new Error("FileReader failed to load file."));

            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Could not get canvas context'));

                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
                
                canvas.toBlob(
                    (blob) => {
                        if (!blob) return reject(new Error('Canvas to Blob conversion failed'));
                        
                        const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";

                        const resizedFile = new File([blob], newFileName, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve({ dataUrl, file: resizedFile });
                    },
                    'image/jpeg',
                    JPEG_QUALITY
                );
            };
            img.onerror = (err) => reject(new Error(`Image load error: ${err}`));
            img.src = event.target.result as string;
        };
        reader.onerror = (err) => reject(new Error(`File read error: ${err}`));
        reader.readAsDataURL(file);
    });
};

// --- Image Attachment Component ---
interface ImageAttachmentProps {
    receiptImage?: string;
    onReceiptImageChange: (dataUrl: string | undefined) => void;
}
const ImageAttachment: React.FC<ImageAttachmentProps> = ({ receiptImage, onReceiptImageChange }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!isCameraOpen) {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }
    
        const startCamera = async () => {
          setError(null);
          try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              throw new Error("Camera access is not supported by your browser.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
          } catch (err: any) {
            setError(err.message || "Could not access camera.");
            setIsCameraOpen(false);
          }
        };
    
        startCamera();
        return () => { if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop()); };
      }, [isCameraOpen]);
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
          setIsProcessing(true);
          setError(null);
          try {
            const { dataUrl } = await resizeImage(file);
            onReceiptImageChange(dataUrl);
          } catch (err) {
            setError("Failed to process image.");
          } finally {
            setIsProcessing(false);
          }
        }
    };

    const handleCapture = useCallback(() => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            setIsCameraOpen(false);
            const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            onReceiptImageChange(dataUrl);
        }
      }, [onReceiptImageChange]);

    return (
        <div className="flex-1 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center hover:border-teal-500 dark:hover:border-teal-400 transition-colors duration-200">
            {isCameraOpen && (
                <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 flex justify-around items-center">
                        <button type="button" onClick={() => setIsCameraOpen(false)} className="px-6 py-3 bg-gray-600/70 text-white font-semibold rounded-lg text-lg">Cancel</button>
                        <button type="button" onClick={handleCapture} className="w-20 h-20 bg-white rounded-full border-4 border-gray-400"></button>
                    </div>
                </div>
            )}
            
            <h4 className="font-semibold text-slate-700 dark:text-slate-200">Receipt Image</h4>

            {receiptImage ? (
                <div className="mt-2 relative inline-block">
                    <img src={receiptImage} alt="Receipt preview" className="max-h-24 mx-auto rounded-md shadow-sm" />
                    <button type="button" onClick={() => onReceiptImageChange(undefined)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
            ) : isProcessing ? (
                 <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Processing...</p>
            ) : (
                <div className="mt-2 space-y-2">
                     <p className="text-sm text-slate-500 dark:text-slate-400">(Optional)</p>
                     <div className="flex justify-center gap-2">
                        <input type="file" id="image-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
                        <label htmlFor="image-upload" className="cursor-pointer text-xs font-semibold px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700">Choose</label>
                        <button type="button" onClick={() => setIsCameraOpen(true)} className="cursor-pointer text-xs font-semibold px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700">Camera</button>
                     </div>
                </div>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
};


interface BillExtraDetailsProps {
  items: ReceiptItem[];
  additionalInfo: { id: string, key: string, value: string }[];
  onEditItems: () => void;
  onEditInfo: () => void;
  isRecurring: boolean;
  receiptImage?: string;
  onReceiptImageChange: (dataUrl: string | undefined) => void;
}

const BillExtraDetails: React.FC<BillExtraDetailsProps> = ({ items, additionalInfo, onEditItems, onEditInfo, isRecurring, receiptImage, onReceiptImageChange }) => {
  return (
    <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
            <button
                type="button"
                onClick={onEditItems}
                className="flex-1 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-teal-500 dark:hover:border-teal-400 transition-all duration-200"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-slate-500 dark:text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h4 className="font-semibold text-slate-700 dark:text-slate-200">{isRecurring ? 'Default Items' : 'Itemization'}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">({items.length} items)</p>
            </button>

            <button
                type="button"
                onClick={onEditInfo}
                className="flex-1 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-teal-500 dark:hover:border-teal-400 transition-all duration-200"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-slate-500 dark:text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="font-semibold text-slate-700 dark:text-slate-200">Additional Details</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">({additionalInfo.length} details)</p>
            </button>
        </div>
         <div className="flex flex-col sm:flex-row gap-4">
             <ImageAttachment receiptImage={receiptImage} onReceiptImageChange={onReceiptImageChange} />
        </div>
    </div>
  );
};

export default BillExtraDetails;
