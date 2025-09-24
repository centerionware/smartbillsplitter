import React, { useState, useEffect, useCallback } from 'react';
import type { Bill, Settings, SharedBillPayload } from '../types.ts';
import { useKeys } from '../hooks/useKeys.ts';
import * as cryptoService from '../services/cryptoService.ts';

interface ShareModalProps {
  bill: Bill;
  settings: Settings;
  onClose: () => void;
}

type Status = 'generating' | 'ready' | 'error' | 'copied';

const ShareModal: React.FC<ShareModalProps> = ({ bill, settings, onClose }) => {
  const [status, setStatus] = useState<Status>('generating');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { keyPair, isLoading: keysLoading } = useKeys();

  const generateShareLink = useCallback(async () => {
    if (!keyPair) {
      setError("Cryptographic keys are not available. Cannot share bill.");
      setStatus('error');
      return;
    }

    setStatus('generating');
    setError(null);

    try {
      // 1. Generate a new symmetric key for this share session
      const encryptionKey = await cryptoService.generateEncryptionKey();
      
      // 2. Sign the bill data
      const signature = await cryptoService.sign(JSON.stringify(bill), keyPair.privateKey);
      
      // 3. Export the user's public signing key
      const publicKeyJwk = await cryptoService.exportKey(keyPair.publicKey);

      // 4. Create the payload
      const payload: SharedBillPayload = {
        bill,
        creatorName: settings.myDisplayName,
        publicKey: publicKeyJwk,
        signature,
      };

      // 5. Encrypt the payload
      const encryptedData = await cryptoService.encrypt(JSON.stringify(payload), encryptionKey);

      // 6. POST to the server to get a share ID
      const response = await fetch('/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create a share link on the server.");
      }
      
      const { shareId } = result;
      
      // 7. Construct the final shareable URL
      const exportedEncryptionKey = await cryptoService.exportKey(encryptionKey);
      const keyString = btoa(JSON.stringify(exportedEncryptionKey));
      
      // Construct URL carefully to avoid extra slashes or incorrect paths
      const url = new URL(window.location.href);
      url.hash = `#/view-bill?shareId=${shareId}&key=${keyString}`;

      setShareUrl(url.toString());
      setStatus('ready');

    } catch (err: any) {
      console.error("Error generating share link:", err);
      setError(err.message || "An unknown error occurred while creating the share link.");
      setStatus('error');
    }
  }, [bill, settings.myDisplayName, keyPair]);
  
  useEffect(() => {
    if (!keysLoading) {
      generateShareLink();
    }
  }, [keysLoading, generateShareLink]);
  
  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setStatus('copied');
        setTimeout(() => setStatus('ready'), 2000);
      });
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'generating':
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <svg className="animate-spin h-12 w-12 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="mt-4 text-slate-500 dark:text-slate-400">Generating secure share link...</p>
          </div>
        );
      case 'error':
        return (
          <div className="p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Failed to Share</h3>
            <p className="mt-2 text-slate-600 dark:text-slate-300 bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{error}</p>
          </div>
        );
      case 'ready':
      case 'copied':
        if (!shareUrl) return null;
        return (
          <div className="p-6 text-center">
            <h3 id="share-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Share this Bill</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Anyone with this link can view and import this bill. The link will expire in 24 hours.</p>
            <div className="my-6 p-4 bg-white rounded-lg inline-block shadow-md">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(shareUrl)}&qzone=1`} alt="QR Code for sharing bill" width="256" height="256"/>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="text" readOnly value={shareUrl} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm"/>
              <button onClick={handleCopy} className={`w-32 px-4 py-2 font-semibold rounded-lg transition-colors flex-shrink-0 ${status === 'copied' ? 'bg-emerald-500 text-white' : 'bg-teal-500 text-white hover:bg-teal-600'}`}>
                {status === 'copied' ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-2 text-right absolute top-0 right-0">
          <button onClick={onClose} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="pt-8 px-2 pb-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
