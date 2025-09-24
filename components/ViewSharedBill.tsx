import React, { useState, useEffect } from 'react';
import type { SharedBillPayload, Bill, ImportedBill, Settings } from '../types.ts';
import * as cryptoService from '../services/cryptoService.ts';

interface ViewSharedBillProps {
  onImportComplete: () => void;
  settings: Settings;
  addImportedBill: (bill: ImportedBill) => Promise<void>;
  importedBills: ImportedBill[];
}

type Status = 'loading' | 'verifying' | 'verified' | 'imported' | 'error' | 'expired';

const ViewSharedBill: React.FC<ViewSharedBillProps> = ({ onImportComplete, settings, addImportedBill, importedBills }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<SharedBillPayload | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<JsonWebKey | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0);

  const isAlreadyImported = sharedData ? importedBills.some(b => b.id === sharedData.bill.id) : false;

  useEffect(() => {
    const processShareLink = async () => {
      try {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const shareId = params.get('shareId');
        const keyString = params.get('key');

        if (!shareId || !keyString) {
          throw new Error("Invalid or incomplete share link.");
        }
        
        // 1. Fetch encrypted data
        const response = await fetch(`/share/${shareId}`);
        if (response.status === 404) {
          setStatus('expired');
          return;
        }
        if (!response.ok) {
           const errData = await response.json().catch(() => ({}));
           throw new Error(errData.error || "Failed to retrieve shared bill data.");
        }
        const { encryptedData, lastUpdatedAt: serverTimestamp } = await response.json();
        setLastUpdatedAt(serverTimestamp);

        // 2. Decrypt data
        setStatus('verifying');
        const keyJwk = JSON.parse(atob(keyString));
        setEncryptionKey(keyJwk); // Save for import
        const symmetricKey = await cryptoService.importEncryptionKey(keyJwk);
        const decryptedJson = await cryptoService.decrypt(encryptedData, symmetricKey);
        const data: SharedBillPayload = JSON.parse(decryptedJson);

        // 3. Verify signature
        const publicKey = await cryptoService.importPublicKey(data.publicKey);
        const isVerified = await cryptoService.verify(JSON.stringify(data.bill), data.signature, publicKey);

        if (!isVerified) {
          throw new Error("Signature verification failed. The bill data may have been tampered with.");
        }

        setSharedData(data);
        setStatus('verified');

      } catch (err: any) {
        console.error("Error processing share link:", err);
        setError(err.message || "An unknown error occurred.");
        setStatus('error');
      }
    };
    processShareLink();
  }, []);

  const handleImport = async () => {
    if (!sharedData || !encryptionKey) return;

    const imported: ImportedBill = {
        id: sharedData.bill.id,
        creatorName: sharedData.creatorName,
        status: 'active',
        sharedData: {
            bill: sharedData.bill,
            creatorPublicKey: sharedData.publicKey,
            signature: sharedData.signature,
        },
        shareId: new URLSearchParams(window.location.hash.split('?')[1]).get('shareId')!,
        shareEncryptionKey: encryptionKey,
        lastUpdatedAt: lastUpdatedAt,
        localStatus: {
            myPortionPaid: false,
        },
    };

    await addImportedBill(imported);
    setStatus('imported');
    setTimeout(onImportComplete, 1500); // Navigate away after a short delay
  };

  const renderContent = () => {
    if (status === 'loading' || status === 'verifying') {
        return (
             <div className="flex flex-col items-center justify-center p-8">
                <svg className="animate-spin h-12 w-12 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p className="mt-4 text-slate-500 dark:text-slate-400">{status === 'loading' ? 'Loading bill...' : 'Verifying signature...'}</p>
            </div>
        );
    }

    if (status === 'error' || status === 'expired') {
        return (
            <div className="p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">
                    {status === 'expired' ? 'Link Expired' : 'An Error Occurred'}
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-300">
                    {status === 'expired' ? 'This share link has expired or is invalid. Please ask the creator for a new link.' : error}
                </p>
            </div>
        );
    }

    if (status === 'imported') {
        return (
            <div className="p-8 text-center transition-all duration-500 ease-in-out">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Bill Imported Successfully!</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-300">Redirecting to your dashboard...</p>
            </div>
        );
    }
    
    if (status === 'verified' && sharedData) {
        const bill = sharedData.bill;
        const myNameLower = settings.myDisplayName.toLowerCase().trim();
        const myParticipant = bill.participants.find(p => p.name.toLowerCase().trim() === myNameLower);

        return (
            <div className="p-6">
                <div className="p-3 mb-6 bg-emerald-50 dark:bg-emerald-900/40 border-l-4 border-emerald-500 rounded-r-lg flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600 dark:text-emerald-300 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">This bill has been cryptographically verified.</p>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{bill.description}</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{new Date(bill.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                    ${bill.totalAmount.toFixed(2)}
                  </div>
                </div>
                 {myParticipant && (
                    <div className="mt-4 p-4 bg-teal-50 dark:bg-teal-900/40 rounded-lg text-center">
                        <p className="font-medium text-teal-800 dark:text-teal-200">You owe:</p>
                        <p className="text-3xl font-bold text-teal-900 dark:text-teal-100">${myParticipant.amountOwed.toFixed(2)}</p>
                    </div>
                )}
                <ul className="mt-6 space-y-2">
                    {bill.participants.map(p => (
                        <li key={p.id} className="flex justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{p.name}</span>
                            <span className={`font-semibold ${p.paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {p.paid ? 'Paid' : 'Owes'} ${p.amountOwed.toFixed(2)}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return null;
  }

  return (
    <div className="max-w-xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            {renderContent()}
            {(status === 'verified' || status === 'expired' || status === 'error') && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
                     <button onClick={onImportComplete} className="px-5 py-2 bg-slate-100 text-slate-800 font-bold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
                        {isAlreadyImported ? 'Close' : 'Go to My Bills'}
                     </button>
                    {status === 'verified' && (
                        <button onClick={handleImport} disabled={isAlreadyImported} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed">
                          {isAlreadyImported ? 'Already Imported' : 'Import to My Bills'}
                        </button>
                    )}
                </div>
            )}
        </div>
    </div>
  )
};

export default ViewSharedBill;