import React, { useState, useEffect } from 'react';
import type { SharedBillPayload, ImportedBill, Settings } from '../types.ts';
import * as cryptoService from '../services/cryptoService.ts';
import { getShareKey, saveShareKey } from '../services/db.ts';
import PrivacyConsent from './PrivacyConsent.tsx';

interface ViewSharedBillProps {
  onImportComplete: () => void;
  settings: Settings;
  addImportedBill: (bill: ImportedBill) => Promise<void>;
  importedBills: ImportedBill[];
}

type Status = 'loading' | 'fetching_key' | 'fetching_data' | 'verifying' | 'verified' | 'imported' | 'error' | 'expired';

const ViewSharedBill: React.FC<ViewSharedBillProps> = ({ onImportComplete, settings, addImportedBill, importedBills }) => {
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('privacyConsentAccepted') === 'true'
  );
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<SharedBillPayload | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0);
  const [encryptionKey, setEncryptionKey] = useState<JsonWebKey | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const isAlreadyImported = sharedData ? importedBills.some(b => b.id === sharedData.bill.id) : false;

  useEffect(() => {
    if (!hasAcceptedPrivacy) return;

    const processShareLink = async () => {
      try {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const shareId = params.get('shareId');
        const keyId = params.get('keyId');

        if (!shareId) throw new Error("Invalid or incomplete share link (missing Share ID).");
        
        // 1. Get the encryption key
        let keyToUse: JsonWebKey;
        const cachedKeyRecord = await getShareKey(shareId);

        if (cachedKeyRecord) {
            keyToUse = cachedKeyRecord.key;
        } else {
            if (!keyId) throw new Error("This link requires a key to unlock. Please use the full original link provided.");
            setStatus('fetching_key');
            const keyResponse = await fetch(`/share-key/${keyId}`);
            if (!keyResponse.ok) {
                const err = await keyResponse.json().catch(() => ({}));
                throw new Error(err.error || "Failed to retrieve the encryption key. It may have expired or been used already.");
            }
            const keyData = await keyResponse.json();
            if (keyData.shareId !== shareId) {
                throw new Error("Key/Share ID mismatch. This key is for a different bill.");
            }
            keyToUse = keyData.key;
            await saveShareKey(shareId, keyToUse);
        }
        setEncryptionKey(keyToUse);

        // 2. Fetch the encrypted data
        setStatus('fetching_data');
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

        // 3. Decrypt and verify
        setStatus('verifying');
        const symmetricKey = await cryptoService.importEncryptionKey(keyToUse);
        const decryptedJson = await cryptoService.decrypt(encryptedData, symmetricKey);
        const data: SharedBillPayload = JSON.parse(decryptedJson);

        const publicKey = await cryptoService.importPublicKey(data.publicKey);
        const isVerified = await cryptoService.verify(JSON.stringify(data.bill), data.signature, publicKey);
        if (!isVerified) throw new Error("Signature verification failed. The bill data may have been tampered with.");

        setSharedData(data);
        setStatus('verified');
      } catch (err: any) {
        console.error("Error processing share link:", err);
        setError(err.message || "An unknown error occurred.");
        setStatus('error');
      }
    };
    processShareLink();
  }, [hasAcceptedPrivacy]);

  const handleImport = async () => {
    if (!sharedData || !selectedParticipantId || !encryptionKey) return;

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
        myParticipantId: selectedParticipantId,
        localStatus: {
            myPortionPaid: false,
        },
    };

    await addImportedBill(imported);
    setStatus('imported');
    setTimeout(onImportComplete, 1500);
  };

  const handleAcceptPrivacy = () => {
    localStorage.setItem('privacyConsentAccepted', 'true');
    setHasAcceptedPrivacy(true);
  };

  if (!hasAcceptedPrivacy) {
    return <PrivacyConsent onAccept={handleAcceptPrivacy} />;
  }

  const renderContent = () => {
    if (['loading', 'fetching_key', 'fetching_data', 'verifying'].includes(status)) {
        const messages = {
            loading: 'Loading bill...',
            fetching_key: 'Retrieving encryption key...',
            fetching_data: 'Downloading bill data...',
            verifying: 'Verifying signature...'
        };
        return (
             <div className="flex flex-col items-center justify-center p-8">
                <svg className="animate-spin h-12 w-12 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p className="mt-4 text-slate-500 dark:text-slate-400">{messages[status as keyof typeof messages]}</p>
            </div>
        );
    }
    if (status === 'error' || status === 'expired') {
        return (
            <div className="p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">{status === 'expired' ? 'Link Expired' : 'An Error Occurred'}</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-300">{status === 'expired' ? 'This share link has expired or is invalid. Please ask for a new link.' : error}</p>
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
        return (
            <div className="p-6">
                <div className="p-3 mb-6 bg-emerald-50 dark:bg-emerald-900/40 border-l-4 border-emerald-500 rounded-r-lg flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600 dark:text-emerald-300 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><p className="text-sm text-emerald-800 dark:text-emerald-200">This bill has been cryptographically verified.</p></div>
                <div className="flex justify-between items-start mb-2"><div><h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{bill.description}</h2><p className="text-slate-500 dark:text-slate-400 mt-1">Shared by {sharedData.creatorName} on {new Date(bill.date).toLocaleDateString()}</p></div><div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">${bill.totalAmount.toFixed(2)}</div></div>
                <div className="my-2 flex flex-wrap gap-x-4 gap-y-2">{bill.receiptImage && (<button onClick={() => setIsReceiptModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>View Scanned Receipt</button>)}{bill.additionalInfo && Object.keys(bill.additionalInfo).length > 0 && (<button onClick={() => setIsInfoModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>View Additional Info</button>)}</div>
                <div className="my-6 border-t border-slate-200 dark:border-slate-700" />
                <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-200">Participants</h3>
                <ul className="mb-6 space-y-2">{bill.participants.map(p => (<li key={p.id} className="flex justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm"><span className="font-semibold text-slate-700 dark:text-slate-200">{p.name}</span><span className={`font-semibold ${p.paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{p.paid ? 'Paid' : 'Owes'} ${p.amountOwed.toFixed(2)}</span></li>))}</ul>
                <div className="my-6 border-t border-slate-200 dark:border-slate-700" />
                <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-200">Who are you in this bill?</h3>
                <div className="space-y-2">{bill.participants.map(p => (<button key={p.id} onClick={() => setSelectedParticipantId(p.id)} className={`w-full text-left p-3 rounded-lg transition-all border-2 flex justify-between items-center ${selectedParticipantId === p.id ? 'bg-teal-50 border-teal-500 dark:bg-teal-900/50' : 'bg-slate-50 border-transparent hover:border-slate-300 dark:bg-slate-700/50 dark:hover:border-slate-600'}`}><div><p className="font-bold text-slate-800 dark:text-slate-100">{p.name}</p><p className="text-sm text-slate-600 dark:text-slate-300">Owes ${p.amountOwed.toFixed(2)}</p></div>{selectedParticipantId === p.id && (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>)}</button>))}</div>
            </div>
        );
    }
    return null;
  }

  const bill = sharedData?.bill;

  return (
    <div className="max-w-xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            {renderContent()}
            {(status === 'verified' || status === 'expired' || status === 'error') && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
                     <button onClick={onImportComplete} className="px-5 py-2 bg-slate-100 text-slate-800 font-bold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">{isAlreadyImported ? 'Close' : 'Go to My Bills'}</button>
                    {status === 'verified' && (<button onClick={handleImport} disabled={isAlreadyImported || !selectedParticipantId} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed">{isAlreadyImported ? 'Already Imported' : 'Import to My Bills'}</button>)}
                </div>
            )}
        </div>
        
        {isReceiptModalOpen && bill?.receiptImage && (<div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4" onClick={() => setIsReceiptModalOpen(false)} role="dialog" aria-modal="true" aria-label="Receipt Image Viewer"><div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}><img src={bill.receiptImage} alt="Scanned receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" /><button onClick={() => setIsReceiptModalOpen(false)} className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close receipt view"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>)}
        {isInfoModalOpen && bill?.additionalInfo && (<div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4" onClick={() => setIsInfoModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="info-dialog-title"><div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}><div className="p-6 border-b border-slate-200 dark:border-slate-700"><h3 id="info-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Additional Information</h3></div><div className="p-6 flex-grow overflow-y-auto"><dl className="space-y-4">{Object.entries(bill.additionalInfo).map(([key, value]) => (<div key={key} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md"><dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{key}</dt><dd className="mt-1 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{String(value)}</dd></div>))}</dl></div><div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end"><button onClick={() => setIsInfoModalOpen(false)} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Close</button></div></div></div>)}
    </div>
  )
};

export default ViewSharedBill;