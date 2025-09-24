import React, { useState, useEffect, useCallback } from 'react';
import type { Bill, SharedBillPayload, Settings, Participant } from '../types.ts';
import { useKeys } from '../hooks/useKeys.ts';
import * as cryptoService from '../services/cryptoService.ts';

interface ShareModalProps {
  bill: Bill;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (settings: Partial<Settings>) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ bill, onClose, settings, onUpdateSettings }) => {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { keyPair, isLoading: keysLoading } = useKeys();
  const [copied, setCopied] = useState(false);

  // State for the one-time name prompt
  const [needsNamePrompt, setNeedsNamePrompt] = useState(false);
  const [provisionalName, setProvisionalName] = useState('');
  const [nameError, setNameError] = useState('');

  const generateShareLink = useCallback(async (creatorName: string) => {
    if (!keyPair) {
        setError("Cryptographic keys are not ready. Please wait a moment and try again.");
        setIsLoading(false);
        return;
    };

    setIsLoading(true);
    setError(null);
    try {
      // 1. Create a temporary, deep copy of the bill to modify for sharing
      const billToShare: Bill = JSON.parse(JSON.stringify(bill));
      
      // 2. Replace "Myself" with the creator's actual name to avoid confusion
      const myselfLower = 'myself';
      const creatorParticipant = billToShare.participants.find((p: Participant) => p.name.trim().toLowerCase() === myselfLower);
      if (creatorParticipant) {
          creatorParticipant.name = creatorName;
      }

      // 3. Generate a temporary symmetric key for E2E encryption
      const encryptionKey = await cryptoService.generateEncryptionKey();
      const encryptionKeyJwk = await cryptoService.exportKey(encryptionKey);

      // 4. Prepare the payload to be signed and shared
      const publicKeyJwk = await cryptoService.exportKey(keyPair.publicKey);
      
      // 5. Sign the modified bill data with the user's private key
      const signature = await cryptoService.sign(JSON.stringify(billToShare), keyPair.privateKey);

      // 6. Create the final bundle to be encrypted
      const payload: SharedBillPayload = {
        bill: billToShare,
        publicKey: publicKeyJwk,
        signature: signature
      };

      // 7. Encrypt the bundle with the temporary symmetric key
      const encryptedData = await cryptoService.encrypt(JSON.stringify(payload), encryptionKey);
      
      // 8. Send the encrypted data to the server
      const response = await fetch('/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create a share session.");
      }
      
      const { shareId } = result;
      
      // 9. Store session info for live updates
      sessionStorage.setItem(`share-session-${bill.id}`, JSON.stringify({
          shareId,
          key: encryptionKeyJwk,
          creatorName
      }));
      
      // 10. Construct the shareable URL
      const keyString = btoa(JSON.stringify(encryptionKeyJwk)); // Base64 encode the key for the URL
      const url = new URL(window.location.href);
      url.hash = `#/view-bill?shareId=${shareId}&key=${keyString}`;

      setShareLink(url.toString());

    } catch (err: any) {
      console.error("Error generating share link:", err);
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [bill, keyPair]);

  useEffect(() => {
    if (keysLoading) return;

    if (settings.myDisplayName === 'Myself') {
      setNeedsNamePrompt(true);
      setIsLoading(false); // Stop loading to show the prompt
    } else {
      setNeedsNamePrompt(false);
      generateShareLink(settings.myDisplayName);
    }
  }, [settings.myDisplayName, keysLoading, generateShareLink]);

  const handleNameSet = () => {
    const trimmedName = provisionalName.trim();
    if (!trimmedName) {
      setNameError("Please enter your name.");
      return;
    }
    setNameError('');
    onUpdateSettings({ myDisplayName: trimmedName });
    // The component will re-render after settings update. The `useEffect` above
    // will see the new name, set `needsNamePrompt` to false, and trigger `generateShareLink`.
  };

  const handleCopy = () => {
    if (shareLink) {
        navigator.clipboard.writeText(shareLink).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }
  };

  const renderNamePrompt = () => (
    <div className="p-6">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">What's your name?</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          To avoid confusion for others, please set your display name before sharing a bill. This is a one-time setup.
        </p>
        <input
            type="text"
            value={provisionalName}
            onChange={(e) => setProvisionalName(e.target.value)}
            placeholder="Your Name"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            autoFocus
            aria-label="Your display name"
        />
        {nameError && <p className="text-sm text-red-500 mt-1">{nameError}</p>}
        <div className="mt-6 flex justify-end">
            <button onClick={handleNameSet} className="px-5 py-2.5 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">
                Continue & Share
            </button>
        </div>
    </div>
  );

  const renderShareContent = () => (
    <div className="p-6 text-center">
      {isLoading || keysLoading ? (
        <div className="flex flex-col items-center justify-center h-48">
          <svg className="animate-spin h-10 w-10 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Generating secure link...</p>
        </div>
      ) : error ? (
        <div className="text-red-600 bg-red-100 p-4 rounded-md dark:bg-red-900/50 dark:text-red-400">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      ) : shareLink && (
        <>
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            Share this secure link or QR code. The link will expire in 24 hours.
          </p>
          <div className="my-4 p-3 bg-white rounded-lg inline-block shadow-md">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareLink)}&qzone=1`} alt="QR Code for sharing bill" width="200" height="200"/>
          </div>
          <div className="relative mt-4">
            <input type="text" value={shareLink} readOnly className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm p-3 rounded-lg pr-24" />
            <button onClick={handleCopy} className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-teal-500 text-white font-semibold text-sm rounded-md hover:bg-teal-600">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900 bg-opacity-60 z-50 flex justify-center items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
      onClick={onClose}
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h2 id="share-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Share Bill</h2>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        {needsNamePrompt ? renderNamePrompt() : renderShareContent()}
      </div>
    </div>
  );
};

export default ShareModal;