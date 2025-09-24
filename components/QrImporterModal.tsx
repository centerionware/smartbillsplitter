import React, { useEffect } from 'react';
import { useQrScanner } from '../hooks/useQrScanner.ts';

interface QrImporterModalProps {
  onClose: () => void;
  onScanSuccess: (url: string) => void;
}

const QrImporterModal: React.FC<QrImporterModalProps> = ({ onClose, onScanSuccess }) => {
  
  const { isScanning, startScanner, stopScanner, videoRef, error: scannerError } = useQrScanner(onScanSuccess);

  useEffect(() => {
    startScanner();
    return () => stopScanner();
  }, [startScanner, stopScanner]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col justify-center items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
    >
        <div className="relative w-full max-w-xl bg-slate-900 rounded-lg shadow-xl overflow-hidden aspect-square">
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                aria-label="Camera feed for QR code scanning"
            />
            <div className="absolute inset-0 flex flex-col justify-between p-4">
                <div className="w-full p-3 bg-black/50 rounded-lg text-white font-semibold text-center backdrop-blur-sm">
                    <h2 id="qr-scanner-title">Scan QR Code</h2>
                    <p className="text-sm font-normal opacity-90 mt-1">Point your camera at a share QR code to import a bill.</p>
                </div>

                {scannerError && (
                    <div className="p-3 text-sm text-red-300 bg-red-800/80 rounded-md">
                        <p className="font-semibold">Camera Error:</p>
                        <p>{scannerError}</p>
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="self-center px-8 py-3 bg-slate-600/70 text-white font-semibold rounded-lg text-lg backdrop-blur-sm hover:bg-slate-500/80"
                >
                    Cancel
                </button>
            </div>

            {/* Scanning Overlay */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full relative">
                    <div className="absolute w-1/2 h-1/2 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                         <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-white/80 rounded-tl-lg"></div>
                         <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-white/80 rounded-tr-lg"></div>
                         <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-white/80 rounded-bl-lg"></div>
                         <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-white/80 rounded-br-lg"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default QrImporterModal;