import React, { useState, useCallback, useRef, useEffect } from 'react';
import { parseReceipt } from '../services/geminiService.ts';

interface ScannedData {
  description: string;
  date?: string;
  items: { name: string; price: number }[];
}

interface ReceiptScannerProps {
  onItemsScanned: (data: ScannedData) => void;
  onImageSelected: (imageDataUrl: string) => void;
  onImageCleared: () => void;
  isForTemplate?: boolean;
}

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
                        
                        // Ensure the new filename has a .jpg extension
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


// --- Flash Icons ---
const FlashOnIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

const FlashOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        <line x1="3" y1="3" x2="21" y2="21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const FlashAutoIcon = () => (
    <span className="relative h-6 w-6 inline-flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="absolute -top-1 -right-2.5 text-white font-bold text-[10px] leading-none bg-black/40 rounded-full px-1 py-0.5">A</span>
    </span>
);


const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onItemsScanned, onImageSelected, onImageCleared, isForTemplate }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [canControlFlash, setCanControlFlash] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('auto');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Effect to handle camera stream initialization and cleanup
  useEffect(() => {
    if (!isCameraOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      return;
    }

    const startCamera = async () => {
      setCameraError(null);
      setCanControlFlash(false);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera access is not supported by your browser.");
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const videoTrack = stream.getVideoTracks()[0];
        // The 'torch' capability indicates if the flash can be controlled.
        const capabilities = videoTrack.getCapabilities();
        if ((capabilities as any).torch) {
          setCanControlFlash(true);
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        let message = "Could not access the camera. Please ensure you have granted permission.";
        if (err.name === 'NotAllowedError') {
          message = "Camera access was denied. Please enable it in your browser settings.";
        } else if (err.name === 'NotFoundError') {
          message = "No suitable camera was found on your device.";
        }
        setCameraError(message);
        setIsCameraOpen(false); // Close the modal on error
      }
    };

    startCamera();

    // Cleanup function to stop the stream when the camera is closed or component unmounts
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isCameraOpen]);

  // Effect to apply flash constraints when flashMode changes
  useEffect(() => {
    if (!isCameraOpen || !canControlFlash || !streamRef.current) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    // The browser API uses a boolean 'torch' property. 'auto' mode is treated as 'off'.
    const isTorchOn = flashMode === 'on';

    videoTrack.applyConstraints({
      advanced: [{ torch: isTorchOn } as any]
    }).catch(err => {
      console.error('Failed to apply flash constraints:', err);
      // If this fails, the user just won't have flash. Non-critical error.
    });
  }, [flashMode, isCameraOpen, canControlFlash]);

  const handleOpenCamera = () => setIsCameraOpen(true);
  const handleCloseCamera = () => setIsCameraOpen(false);
  
  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        handleCloseCamera();
        
        canvas.toBlob(async (blob) => {
            if (blob) {
                const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                setIsProcessingImage(true);
                setError(null);
                try {
                    const { dataUrl, file: resizedFile } = await resizeImage(capturedFile);
                    setPreviewUrl(dataUrl);
                    onImageSelected(dataUrl);
                    setSelectedFile(resizedFile);
                } catch (err) {
                    console.error("Image resizing failed after capture:", err);
                    setError("Failed to process captured image.");
                    handleClearImage();
                } finally {
                    setIsProcessingImage(false);
                }
            }
        }, 'image/jpeg', 1.0);
    }
  }, [onImageSelected]);

  const handleFlashToggle = () => {
    const modes: ('auto' | 'on' | 'off')[] = ['auto', 'on', 'off'];
    const currentIndex = modes.indexOf(flashMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setFlashMode(modes[nextIndex]);
  };
  
  const FlashIcon = () => {
    switch(flashMode) {
      case 'on': return <FlashOnIcon />;
      case 'off': return <FlashOffIcon />;
      case 'auto':
      default:
        return <FlashAutoIcon />;
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsProcessingImage(true);
      setError(null);
      try {
        const { dataUrl, file: resizedFile } = await resizeImage(file);
        setPreviewUrl(dataUrl);
        onImageSelected(dataUrl);
        setSelectedFile(resizedFile);
      } catch (err) {
        console.error("Image resizing failed:", err);
        setError("Failed to process image. Please try a different one.");
        handleClearImage();
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    const input = document.getElementById('receipt-upload') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
    onImageCleared();
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
          
          {canControlFlash && (
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={handleFlashToggle}
                className="p-3 bg-black bg-opacity-40 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-white"
                aria-label={`Set flash to ${flashMode}`}
              >
                <FlashIcon />
              </button>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 flex justify-around items-center">
              <button type="button" onClick={handleCloseCamera} className="px-6 py-3 bg-gray-600/70 text-white font-semibold rounded-lg text-lg">Cancel</button>
              <button type="button" onClick={handleCapture} className="w-20 h-20 bg-white rounded-full border-4 border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white ring-offset-black/50"></button>
          </div>
        </div>
      )}
      <div className="mb-6 p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center bg-slate-50 dark:bg-slate-700/30">
        <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Scan a Receipt {isForTemplate ? '(to populate template)' : '(Optional)'}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {isForTemplate
            ? "Use an image to quickly fill out the template fields below. The image itself will not be saved."
            : "Let AI extract the items and prices for you."}
        </p>
        
        {!previewUrl && !isProcessingImage && (
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
        )}

        {isProcessingImage && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
                <svg className="animate-spin h-8 w-8 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p className="text-slate-500 dark:text-slate-400">Processing image...</p>
            </div>
        )}

        {previewUrl && !isProcessingImage && (
          <div className="mt-4 relative inline-block">
            <img src={previewUrl} alt="Receipt preview" className="max-h-48 mx-auto rounded-md shadow-sm" />
             <button
              type="button"
              onClick={handleClearImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Clear image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {selectedFile && !isProcessingImage && (
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