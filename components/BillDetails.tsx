import React, { useState, useCallback } from 'react';
import type { Bill, Settings, SharedBillPayload, Participant } from './types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth';
import ShareModal from './ShareModal.tsx';
import ShareActionSheet from './ShareActionSheet.tsx';
import { useKeys } from '../hooks/useKeys.ts';
import * as cryptoService from '../services/cryptoService.ts';
import { generateShareText, generateShareLink } from '../services/shareService.ts';

interface BillDetailsProps {
  bill: Bill;
  bills: Bill[];
  settings: Settings;
  onUpdateBill: (bill: Bill) => void;
  onUpdateSettings: (settings: Partial<Settings>) => void;
  onBack: () => void;
  subscriptionStatus: SubscriptionStatus;
}

const BillDetails: React.FC<BillDetailsProps> = ({ bill, settings, onUpdateBill, onBack, subscriptionStatus }) => {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareMenuParticipant, setShareMenuParticipant] = useState<Participant | null>(null);
  const { keyPair } = useKeys();

  const pushShareUpdate = async (billToUpdate: Bill) => {
    // Check if there's valid, active share info and we have the keys
    if (!billToUpdate.shareInfo || billToUpdate.shareInfo.expiresAt < Date.now() || !keyPair) {
      return;
    }
    try {
      const { shareId, encryptionKey: encryptionKeyJwk } = billToUpdate.shareInfo;
      const encryptionKey = await cryptoService.importEncryptionKey(encryptionKeyJwk);
      const publicKeyJwk = await cryptoService.exportKey(keyPair.publicKey);

      // We sign the bill *without* the shareInfo to keep the signature consistent
      const { shareInfo, ...billToSign } = billToUpdate;
      const signature = await cryptoService.sign(JSON.stringify(billToSign), keyPair.privateKey);

      const payload: SharedBillPayload = {
        bill: billToSign as Bill,
        creatorName: settings.myDisplayName,
        publicKey: publicKeyJwk,
        signature,
      };
      const encryptedData = await cryptoService.encrypt(JSON.stringify(payload), encryptionKey);
      
      // POST to the server with the existing shareId to update
      await fetch(`/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData, shareId }), 
      });
      console.log(`Pushed live update for shared bill: ${shareId}`);
    } catch (error) {
      console.error("Failed to push live update for shared bill:", error);
    }
  };

  const handleParticipantPaidToggle = (participantId: string) => {
    const updatedParticipants = bill.participants.map(p =>
      p.id === participantId ? { ...p, paid: !p.paid } : p
    );
    const updatedBill = { ...bill, participants: updatedParticipants };
    onUpdateBill(updatedBill);
    // Push the update for anyone watching the share link
    pushShareUpdate(updatedBill);
  };
  
  // --- Share Handlers ---
  const handleShareGeneric = async (participant: Participant) => {
    const billsInfo = [{ description: bill.description, amountOwed: participant.amountOwed }];
    const text = generateShareText(participant.name, participant.amountOwed, billsInfo, settings, subscriptionStatus);
    
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Bill Split Reminder', text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Share text copied to clipboard!');
      }
    } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Error sharing:", err);
        }
    } finally {
        setShareMenuParticipant(null);
    }
  };

  const handleShareSms = (participant: Participant) => {
    if (!participant.phone) return;
    const billsInfo = [{ description: bill.description, amountOwed: participant.amountOwed }];
    const text = generateShareText(participant.name, participant.amountOwed, billsInfo, settings, subscriptionStatus);
    window.location.href = `sms:${participant.phone}?&body=${encodeURIComponent(text)}`;
    setShareMenuParticipant(null);
  };
    
  const handleShareEmail = (participant: Participant) => {
    if (!participant.email) return;
    const billsInfo = [{ description: bill.description, amountOwed: participant.amountOwed }];
    const text = generateShareText(participant.name, participant.amountOwed, billsInfo, settings, subscriptionStatus);
    const subject = "Shared Bill Reminder";
    window.location.href = `mailto:${participant.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    setShareMenuParticipant(null);
  };

  const handleShareLink = useCallback(async (participant: Participant, method: 'sms' | 'email' | 'generic') => {
    if (!keyPair) {
      alert("Cryptographic keys not loaded. Cannot generate share link.");
      return;
    }

    const shareUrl = await generateShareLink(bill, settings, keyPair);
    const message = `Here is a link to view our bill for "${bill.description}". This link will expire in 24 hours:\n\n${shareUrl}`;

    try {
        if (method === 'sms') {
            if (participant.phone) window.location.href = `sms:${participant.phone}?&body=${encodeURIComponent(message)}`;
        } else if (method === 'email') {
            if (participant.email) window.location.href = `mailto:${participant.email}?subject=${encodeURIComponent(`Bill: ${bill.description}`)}&body=${encodeURIComponent(message)}`;
        } else {
            if (navigator.share) {
                await navigator.share({ title: `Bill: ${bill.description}`, text: message });
            } else {
                await navigator.clipboard.writeText(message);
                alert('Share link copied to clipboard!');
            }
        }
    } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error("Error sharing link:", err);
            alert("An error occurred while trying to share the link.");
        }
    } finally {
        setShareMenuParticipant(null);
    }
  }, [keyPair, bill, settings]);

  return (
    <>
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </button>

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
            {bill.receiptImage && (
                <button onClick={() => setIsReceiptModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                    View Scanned Receipt
                </button>
            )}
            {bill.additionalInfo && Object.keys(bill.additionalInfo).length > 0 && (
                <button onClick={() => setIsInfoModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    View Additional Info
                </button>
            )}
          </div>
          
          <div className="my-6 border-t border-slate-200 dark:border-slate-700" />
          
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Participants</h3>
               <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-teal-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors"
                  aria-label="Share this bill"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                  <span>Share Bill</span>
               </button>
            </div>
            <ul className="space-y-3">
              {bill.participants.map(p => (
                <li key={p.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <button onClick={() => setShareMenuParticipant(p)} className="flex items-center text-left hover:opacity-80 transition-opacity">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xs">
                      {p.name.charAt(0)}
                    </div>
                    <p className="ml-3 font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                  </button>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">${p.amountOwed.toFixed(2)}</span>
                    <button 
                      onClick={() => handleParticipantPaidToggle(p.id)}
                      className={`px-3 py-1 text-sm font-semibold rounded-full ${p.paid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                      {p.paid ? 'Paid' : 'Unpaid'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {isShareModalOpen && (
        <ShareModal
          bill={bill}
          settings={settings}
          onClose={() => setIsShareModalOpen(false)}
          onUpdateBill={onUpdateBill}
        />
      )}
      
      {shareMenuParticipant && (
        <ShareActionSheet 
            participant={shareMenuParticipant}
            onClose={() => setShareMenuParticipant(null)}
            onShareSms={handleShareSms}
            onShareEmail={handleShareEmail}
            onShareGeneric={handleShareGeneric}
            onShareLinkSms={() => handleShareLink(shareMenuParticipant, 'sms')}
            onShareLinkEmail={() => handleShareLink(shareMenuParticipant, 'email')}
            onShareLinkGeneric={() => handleShareLink(shareMenuParticipant, 'generic')}
            shareContext="bill"
        />
      )}

      {isReceiptModalOpen && bill.receiptImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4" onClick={() => setIsReceiptModalOpen(false)} role="dialog" aria-modal="true" aria-label="Receipt Image Viewer">
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={bill.receiptImage} alt="Scanned receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" />
            <button onClick={() => setIsReceiptModalOpen(false)} className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close receipt view"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
      )}

      {isInfoModalOpen && bill.additionalInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4" onClick={() => setIsInfoModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="info-dialog-title">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200 dark:border-slate-700"><h3 id="info-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Additional Information</h3></div>
              <div className="p-6 flex-grow overflow-y-auto"><dl className="space-y-4">{Object.entries(bill.additionalInfo).map(([key, value]) => (<div key={key} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md"><dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{key}</dt>{/* FIX: Explicitly cast value to a string to satisfy ReactNode type, as Object.entries can infer `unknown`. */}<dd className="mt-1 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{String(value)}</dd></div>))}</dl></div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end"><button onClick={() => setIsInfoModalOpen(false)} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Close</button></div>
          </div>
        </div>
      )}
    </>
  );
};

export default BillDetails;