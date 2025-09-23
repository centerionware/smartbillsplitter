import React, { useState, useRef, useCallback, useEffect } from 'react';

interface QrScannerHook {
  isScanning: boolean;
  startScanner: () => void;
  stopScanner: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  error: string | null;
}

// Access the global jsQR function loaded from the script in index.html
declare const jsQR: (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;

export const useQrScanner = (onScan: (data: string) => void): QrScannerHook => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  const scan = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          onScan(code.data);
          // Stop scanning once a code is found
          // The component using the hook is responsible for calling stopScanner to close the UI
          return;
        }
      }
    }
    // Continue scanning if no code is found
    animationFrameRef.current = requestAnimationFrame(scan);
  }, [onScan]);

  const startScanner = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported by this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        await videoRef.current.play();
        setIsScanning(true);
        animationFrameRef.current = requestAnimationFrame(scan);
      }
    } catch (err: any) {
      console.error("QR Scanner Error:", err);
      let message = "Could not access the camera. Please ensure you have granted permission.";
      if (err.name === 'NotAllowedError') {
        message = "Camera access was denied. Please enable it in your browser settings.";
      } else if (err.name === 'NotFoundError') {
        message = "No suitable camera was found on your device.";
      }
      setError(message);
      setIsScanning(false);
    }
  }, [scan]);

  const stopScanner = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsScanning(false);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return { isScanning, startScanner, stopScanner, videoRef, error };
};