import React, { useState, useEffect } from 'react';
import type { SharedBillPayload, ImportedBill, Settings, PaymentDetails, Bill } from '../types.ts';
import * as cryptoService from '../services/cryptoService.ts';
import PrivacyConsent from './PrivacyConsent.tsx';
import { getApiUrl } from '../services/api.ts';
import PaymentMethodsModal from './PaymentMethodsModal.tsx';
import SummaryBillDetailsModal from './SummaryBillDetailsModal.tsx';

interface ViewSharedBillProps {
  onImportComplete: () => void;
  settings: Settings;
  addImportedBill: (bill: ImportedBill) => Promise<void>;
  importedBills: ImportedBill[];
}

type Status = 'loading' | 'fetching_key' | 'fetching_data' | 'verifying' | 'verified' | 'imported' | 'error' | 'expired';

/**
 * A robust helper to decode a Base64URL string with detailed error reporting.
 * It correctly handles padding, reverses the URL-safe character encoding,
 * decodes the Base64, and interprets the result as a UTF-8 string.
 *
 * @param base64Url The Base64URL-encoded string.
 * @returns The decoded string.
 * @throws An error with a specific message if decoding fails at any step.
 */
function base64UrlDecode(base64Url: string): string {
    if (typeof base64Url !== 'string' || !base64Url) {
        // Throw an error that is specific and helpful for debugging.
        throw new Error('Malformed share link: The key data in the URL is missing, empty, or invalid.');
    }
    // Replace URL-safe characters with standard Base64 characters
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if it's missing
    const padding = base64.length % 4;
    if (padding) {
        if (padding === 2) base64 += '==';
        else if (padding === 3) base64 += '=';
        else throw new Error('Malformed share link: The key data appears to be truncated (invalid length).');
    }

    try {
        // atob decodes a Base64 string into a "binary string" (where each character's code is a byte value).
        const binaryString = atob(base64);
        
        // Convert the binary string into a Uint8Array of actual bytes.
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Use TextDecoder to interpret the byte array as a UTF-8 string.
        // This is the crucial step for correctly handling Unicode characters.
        // `fatal: true` ensures an error is thrown for invalid byte sequences.
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e: any) {
        if (e instanceof DOMException && e.name === 'InvalidCharacterError') {
             // This error comes directly from atob() if the input is not valid Base64.
             throw new Error("Failed to decode share link key. The link is corrupted (invalid Base64 characters).");
        } else if (e instanceof TypeError) {
             // This error comes from TextDecoder if the byte sequence is not valid UTF-8.
             throw new Error("Failed to decode share link key. The data contains an invalid character sequence (not valid UTF-8).");
        } else {
             // Catch any other unexpected errors.
             throw new Error(`An unexpected error occurred during link decoding: ${e.message}`);
        }
    }
}

// FIX: Changed to a named export to resolve module resolution issues.
export const ViewSharedBill: React.FC<ViewSharedBillProps> = ({ onImportComplete, settings, addImportedBill, importedBills }) => {
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('privacyConsentAccepted') === 'true'
  );
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<SharedBillPayload | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0);
  const [billEncryptionKey, setBillEncryptionKey] = useState<JsonWebKey | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  const isAlreadyImported = sharedData ? importedBills.some(b => b.id === sharedData.bill.id) : false;

  useEffect(() => {
    if (!hasAcceptedPrivacy) return;

    const processShareLink = async () => {
      // Reset state for new link processing to avoid showing stale data from a previous link.
      setStatus('loading');
      setError(null);
      setSharedData(null);
      setLastUpdatedAt(0);
      setBillEncryptionKey(null);
      setMyParticipantId(null);

      try {
        const hash = window.location.hash;
        if (!hash.includes('?')) {
          throw new Error("Share link is missing parameters.");
        }
        const params = new URLSearchParams(hash.split('?')[1]);
        const shareId = params.get('shareId');
        const keyId = params.get('keyId');
        const fragmentKeyStr = params.get('fragmentKey');
        const encryptedParticipantId = params.get('p');

        if (!shareId || !keyId || !fragmentKeyStr || !encryptedParticipantId) {
          throw new Error("Invalid or incomplete share link. All components are required.");
        }
        
        // 1. Fetch the encrypted long-term key.
        setStatus('fetching_key');
        const keyResponse = await fetch(getApiUrl(`/onetime-key/${keyId}`));
        if (keyResponse.status === 404) {
          setStatus('expired');
          setError("This share link has already been used or has expired. Please ask for a new one.");
          return;
        }
        if (!keyResponse.ok) {
           const errData = await keyResponse.json().catch(() => ({}));
           throw new Error(errData.error || "Failed to retrieve the bill key.");
        }
        const keyData = await keyResponse.json();
        const { encryptedBillKey } = keyData;
        if (!encryptedBillKey || typeof encryptedBillKey !== 'string') {
          throw new Error("Received an invalid response from the key server. The encrypted key was missing.");
        }

        // 2. Decrypt the long-term key using the key from the URL fragment.
        const fragmentKeyJwk = JSON.parse(base64UrlDecode(fragmentKeyStr));
        const fragmentKey = await cryptoService.importEncryptionKey(fragmentKeyJwk);
        const decryptedBillKeyJson = await cryptoService.decrypt(encryptedBillKey, fragmentKey);
        const billKeyToUse: JsonWebKey = JSON.parse(decryptedBillKeyJson);
        setBillEncryptionKey(billKeyToUse);
        const symmetricKey = await cryptoService.importEncryptionKey(billKeyToUse);
        
        // 3. Decrypt the participant ID from the URL using the now-decrypted bill key.
        const decryptedParticipantId = await cryptoService.decrypt(encryptedParticipantId, symmetricKey);
        setMyParticipantId(decryptedParticipantId);

        // 4. Fetch the main encrypted bill data
        setStatus('fetching_data');
        const response = await fetch(getApiUrl(`/share/${shareId}`));
        if (!response.ok) {
           const errData = await response.json().catch(() => ({}));
           throw new Error(errData.error || "Failed to retrieve shared bill data.");
        }
        const sharePayload = await response.json();
        const { encryptedData, lastUpdatedAt: serverTimestamp } = sharePayload;

        if (!encryptedData || typeof encryptedData !== 'string' || typeof serverTimestamp !== 'number') {
          throw new Error("Received invalid bill data from the server. The payload was incomplete.");
        }
        setLastUpdatedAt(serverTimestamp);

        // 5. Decrypt and verify the main payload
        setStatus('verifying');
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
  }, [hasAcceptedPrivacy, window.location.hash]);

  const handleImport = async () => {
    if (!sharedData || !myParticipantId || !billEncryptionKey) return;

    const initialPaidItems = (sharedData.bill.items || []).reduce((acc, item) => {
        const participant = (item.originalBillData?.participants || []).find(p => p.id === myParticipantId);
        if (participant?.paid) {
            acc[item.id] = true;
        }
        return acc;
    }, {} as Record<string, boolean>);

    const imported: ImportedBill = {
        id: sharedData.bill.id,
        creatorName: sharedData.creatorName,
        status: 'active',
        sharedData: {
            bill: sharedData.bill,
            creatorPublicKey: sharedData.publicKey,
            signature: sharedData.signature,
            paymentDetails: sharedData.paymentDetails,
        },
        shareId: new URLSearchParams(window.location.hash.split('?')[1]).get('shareId')!,
        shareEncryptionKey: billEncryptionKey,
        constituentShares: sharedData.constituentShares,
        lastUpdatedAt: lastUpdatedAt,
        myParticipantId: myParticipantId,
        localStatus: {
            myPortionPaid: false,
            paidItems: initialPaidItems,
        },
        liveStatus: 'live',
    };

    await addImportedBill(imported);
    setStatus('imported');
    setTimeout(onImportComplete, 1500);
  };

  const handleAcceptPrivacy = () => {
    localStorage.setItem('privacyConsentAccepted', 'true');
    setHasAcceptedPrivacy(true);
  };

  const renderContent = () => {
    if (['loading', 'fetching_key', 'fetching_data', 'verifying'].includes(status)) {
        const messages = {
            loading: 'Loading bill...',
            fetching_key: 'Retrieving secure key...',
            fetching_data: 'Downloading bill data...',
            verifying: 'Verifying bill integrity...',
        };
        return (
            <div className="text-center p-8">
                <svg className="animate-spin h-10 w-10 text-teal-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">{messages[status as keyof typeof messages]}</h2>
            </div>
        );
    }

    if (status === 'error' || status === 'expired') {
        return (
             <div className="text-center p-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2">{status === 'expired' ? 'Link Expired' : 'An Error Occurred'}</h2>
                <p className="text-slate-500 dark:text-slate-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{error}</p>
            </div>
        )
    }

    if (status === 'imported') {
        return (
             <div className="text-center p-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4">Bill Imported!</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Redirecting you to the dashboard...</p>
            </div>
        )
    }

    if (sharedData) {
        const { bill, paymentDetails, creatorName } = sharedData;
        const myParticipant = bill.participants.find(p => p.id === myParticipantId);
        const isSummary = bill.id.startsWith('summary-');
        
        const hasPaymentInfo = paymentDetails && (paymentDetails.venmo || paymentDetails.paypal || paymentDetails.cashApp || paymentDetails.zelle || paymentDetails.customMessage);

        return (
            <>
                {isSummaryModalOpen && isSummary && (
                    <SummaryBillDetailsModal
                        summaryBill={bill}
                        paymentDetails={paymentDetails}
                        creatorName={creatorName}
                        myParticipantId={myParticipantId}
                        onClose={() => setIsSummaryModalOpen(false)}
                    />
                )}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between md:items-start mb-2">
                        <div className="flex-grow">
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{bill.description}</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">{new Date(bill.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 text-right mt-4 md:mt-0">
                        ${bill.totalAmount.toFixed(2)}
                        </div>
                    </div>
                    
                    <div className="my-2 flex flex-wrap gap-x-4 gap-y-2">
                        {bill.receiptImage && (<button onClick={() => setIsReceiptModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>View Scanned Receipt</button>)}
                        {bill.additionalInfo && Object.keys(bill.additionalInfo).length > 0 && (<button onClick={() => setIsInfoModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>View Additional Info</button>)}
                        {isSummary && (
                             <button onClick={() => setIsSummaryModalOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                                <span>📝</span>
                                <span>View Bill Breakdown</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="my-6 border-t border-slate-200 dark:border-slate-700" />
                    
                    {myParticipant ? (
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">This Bill Is For You</h3>
                             <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-900/40 border-2 border-teal-500/50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-lg">
                                        {myParticipant.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg text-slate-800 dark:text-slate-100">{myParticipant.name}</p>
                                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">You Owe: ${myParticipant.amountOwed.toFixed(2)}</p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 text-sm font-semibold rounded-full ${myParticipant.paid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                                    {myParticipant.paid ? 'Paid' : 'Unpaid'}
                                </div>
                            </div>
                            
                            <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                {hasPaymentInfo && !myParticipant.paid && (
                                    <button
                                        onClick={() => setIsPaymentModalOpen(true)}
                                        className="w-full flex-1 px-6 py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors order-1 sm:order-none"
                                    >
                                        Settle Up
                                    </button>
                                )}
                                <button 
                                    onClick={handleImport} 
                                    disabled={!myParticipantId || isAlreadyImported} 
                                    className="w-full flex-1 px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors order-2 sm:order-none"
                                >
                                    {isAlreadyImported ? 'Bill Already in Dashboard' : 'Import This Bill'}
                                </button>
                            </div>

                        </div>
                    ) : (
                         <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-center">
                            <p className="font-semibold text-red-800 dark:text-red-200">
                                Your participant ID was not found in this bill. The bill may have been updated since this link was shared.
                            </p>
                         </div>
                    )}
                </div>

                {isReceiptModalOpen && bill.receiptImage && (<div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4" onClick={() => setIsReceiptModalOpen(false)} role="dialog" aria-modal="true" aria-label="Receipt Image Viewer"><div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}><img src={bill.receiptImage} alt="Scanned receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" /><button onClick={() => setIsReceiptModalOpen(false)} className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close receipt view"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>)}
                {isInfoModalOpen && bill.additionalInfo && (<div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4" onClick={() => setIsInfoModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="info-dialog-title"><div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}><div className="p-6 border-b border-slate-200 dark:border-slate-700"><h3 id="info-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Additional Information</h3></div><div className="p-6 flex-grow overflow-y-auto"><dl className="space-y-4">{Object.entries(bill.additionalInfo).map(([key, value]) => (<div key={key} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md"><dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{key}</dt><dd className="mt-1 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{String(value)}</dd></div>))}</dl></div><div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end"><button onClick={() => setIsInfoModalOpen(false)} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Close</button></div></div></div>)}
                {isPaymentModalOpen && sharedData && myParticipant && (
                    <PaymentMethodsModal
                        paymentDetails={sharedData.paymentDetails}
                        billDescription={sharedData.bill.description}
                        amountOwed={myParticipant.amountOwed}
                        creatorName={creatorName}
                        onClose={() => setIsPaymentModalOpen(false)}
                    />
                )}
            </>
        );
    }
  };

  if (!hasAcceptedPrivacy) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <PrivacyConsent onAccept={handleAcceptPrivacy} />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {renderContent()}
    </div>
  );
};