import React, { useState, useCallback } from 'react';
import type { Bill, Settings, Participant } from '../types.ts';
import { generateShareLink } from '../services/shareService.ts';
import { useAppControl } from '../contexts/AppControlContext.tsx';

interface ShareModalProps {
  bill: Bill;
  settings: Settings;
  onClose: () => void;
  // FIX: Updated prop type to reflect that updating a bill is an async operation.
  onUpdateBill: (bill: Bill) => Promise<void>;
}

const ActionButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean, title: string }> = ({ onClick, children, disabled, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait"
    >
        {children}
    </button>
);

const ShareModal: React.FC<ShareModalProps> = ({ bill, settings, onClose, onUpdateBill }) => {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const { showNotification } = useAppControl();

  const getLink = useCallback(async (participant: Participant): Promise<string | null> => {
    // Return cached link if available
    if (links[participant.id]) {
      return links[participant.id];
    }

    setLoading(prev => new Set(prev).add(participant.id));
    try {
      // The new generateShareLink handles per-participant logic
      const url = await generateShareLink(bill, participant.id, settings, onUpdateBill);
      setLinks(prev => ({ ...prev, [participant.id]: url }));
      return url;
    } catch (e: any) {
      console.error("Error generating share link:", e);
      showNotification(e.message || 'Failed to generate share link.', 'error');
      return null;
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(participant.id);
        return next;
      });
    }
  }, [bill, links, settings, onUpdateBill, showNotification]);

  const handleCopy = async (p: Participant) => {
    const url = await getLink(p);
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(p.id);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleShare = async (p: Participant) => {
    const url = await getLink(p);
    if (!url) return;
    
    const message = `Here is a secure link to our bill for "${bill.description}":\n\n${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Bill: ${bill.description}`, text: message });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          showNotification('Failed to share link', 'error');
        }
      }
    }
  };

  const getShareMessage = (p: Participant, url: string) => {
    return `Hi ${p.name.split(' ')[0]}, here is the secure link to our bill for "${bill.description}":\n\n${url}`;
  };

  const handleSms = async (p: Participant) => {
    const url = await getLink(p);
    if (url && p.phone) {
      window.location.href = `sms:${p.phone}?&body=${encodeURIComponent(getShareMessage(p, url))}`;
    }
  };
  
  const handleEmail = async (p: Participant) => {
    const url = await getLink(p);
    if (url && p.email) {
      window.location.href = `mailto:${p.email}?subject=${encodeURIComponent(`Bill: ${bill.description}`)}&body=${encodeURIComponent(getShareMessage(p, url))}`;
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-xl font-bold text-center text-slate-800 dark:text-slate-100 mb-2">Share Bill</h3>
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">Send each participant a unique, secure link to view this bill. Links are single-use for key retrieval and expire after 24 hours.</p>
          <ul className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {bill.participants.map(p => (
              <li key={p.id} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xs">{p.name.charAt(0)}</div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                </div>
                <div className="flex items-center gap-1">
                    {loading.has(p.id) ? (
                        <svg className="animate-spin h-5 w-5 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <>
                            {p.phone && <ActionButton title="Share via Text" onClick={() => handleSms(p)}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg></ActionButton>}
                            {p.email && <ActionButton title="Share via Email" onClick={() => handleEmail(p)}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg></ActionButton>}
                            <ActionButton title="Copy Link" onClick={() => handleCopy(p)}>
                                {copied === p.id 
                                ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2-2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>
                                }
                            </ActionButton>
                            {navigator.share && <ActionButton title="Share..." onClick={() => handleShare(p)}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg></ActionButton>}
                        </>
                    )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
            <button
                onClick={onClose}
                className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
            >
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
