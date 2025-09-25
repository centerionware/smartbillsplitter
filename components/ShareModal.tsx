import React, { useState, useEffect, useCallback } from 'react';
import type { Bill, Settings, Participant } from '../types.ts';
import { generateShareLink } from '../services/shareService.ts';

interface ShareModalProps {
  bill: Bill;
  settings: Settings;
  onClose: () => void;
  onUpdateBill: (bill: Bill) => void;
}

type ShareStatus = 'generating' | 'ready' | 'error';
type LinkState = { url: string; status: 'pending' | 'initiated' };

const ActionButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ onClick, children, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {children}
    </button>
);

const ShareModal: React.FC<ShareModalProps> = ({ bill, settings, onClose, onUpdateBill }) => {
  const [status, setStatus] = useState<ShareStatus>('generating');
  const [links, setLinks] = useState<Record<string, LinkState>>({}); // key: participant.id
  const [error, setError] = useState<string | null>(null);
  const [copiedParticipantId, setCopiedParticipantId] = useState<string | null>(null);

  const handleUpdateBillAndShareInfo = useCallback(async (shareInfo: Bill['shareInfo']) => {
      onUpdateBill({ ...bill, shareInfo });
  }, [bill, onUpdateBill]);

  useEffect(() => {
    const generateAllLinks = async () => {
      setStatus('generating');
      try {
        const linkPromises = bill.participants.map(async (p) => {
          const url = await generateShareLink(bill, settings, handleUpdateBillAndShareInfo);
          return { participantId: p.id, url };
        });

        const results = await Promise.all(linkPromises);
        const newLinks: Record<string, LinkState> = {};
        results.forEach(result => {
          newLinks[result.participantId] = { url: result.url, status: 'pending' };
        });
        
        setLinks(newLinks);
        setStatus('ready');
      } catch (err: any) {
        console.error("Error generating share links:", err);
        setError(err.message || "An unknown error occurred while preparing links.");
        setStatus('error');
      }
    };
    generateAllLinks();
  }, [bill, settings, handleUpdateBillAndShareInfo]);

  const markAsInitiated = (participantId: string) => {
    setLinks(prev => ({
        ...prev,
        [participantId]: { ...prev[participantId], status: 'initiated' }
    }));
  };
  
  const handleCopy = (participantId: string) => {
    const link = links[participantId]?.url;
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedParticipantId(participantId);
      markAsInitiated(participantId);
      setTimeout(() => setCopiedParticipantId(null), 2000);
    }
  };

  const handleShare = (p: Participant) => {
      const link = links[p.id]?.url;
      if (!link) return;
      
      const message = `Here is a secure link to our bill for "${bill.description}":\n\n${link}`;
      if (navigator.share) {
          navigator.share({ title: `Bill: ${bill.description}`, text: message });
          markAsInitiated(p.id);
      }
  };

  const getShareMessage = (p: Participant) => {
    const link = links[p.id]?.url;
    if (!link) return '';
    return `Hi ${p.name.split(' ')[0]}, here is the secure link to our bill for "${bill.description}":\n\n${link}`;
  }

  const contactableParticipants = bill.participants.filter(p => (p.phone || p.email) && links[p.id]?.status === 'pending');

  const handleShareAll = () => {
    contactableParticipants.forEach(p => {
        const message = getShareMessage(p);
        if (p.phone) {
            window.open(`sms:${p.phone}?&body=${encodeURIComponent(message)}`);
        } else if (p.email) {
            window.open(`mailto:${p.email}?subject=${encodeURIComponent(`Bill: ${bill.description}`)}&body=${encodeURIComponent(message)}`);
        }
        markAsInitiated(p.id);
    });
  };

  const renderContent = () => {
    switch (status) {
      case 'generating':
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center min-h-64">
            <svg className="animate-spin h-12 w-12 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="mt-4 text-slate-500 dark:text-slate-400">Preparing secure links for everyone...</p>
          </div>
        );
      case 'ready':
        return (
          <>
            <div className="p-6">
              <h3 className="text-xl font-bold text-center text-slate-800 dark:text-slate-100 mb-2">Share Bill</h3>
              <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">A unique, secure link is ready for each participant. Links are single-use for key retrieval.</p>
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {bill.participants.map(p => (
                  <li key={p.id} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xs">{p.name.charAt(0)}</div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        {links[p.id]?.status === 'initiated' ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold px-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                Sent
                            </div>
                        ) : (
                            <>
                                {p.phone && <ActionButton onClick={() => { window.open(`sms:${p.phone}?&body=${encodeURIComponent(getShareMessage(p))}`); markAsInitiated(p.id); }}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><title>Share via Text</title><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg></ActionButton>}
                                {p.email && <ActionButton onClick={() => { window.open(`mailto:${p.email}?subject=${encodeURIComponent(`Bill: ${bill.description}`)}&body=${encodeURIComponent(getShareMessage(p))}`); markAsInitiated(p.id); }}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><title>Share via Email</title><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg></ActionButton>}
                                <ActionButton onClick={() => handleCopy(p.id)}>
                                    {copiedParticipantId === p.id 
                                        ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><title>Copied!</title><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><title>Copy Link</title><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2-2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>
                                    }
                                </ActionButton>
                                {navigator.share && <ActionButton onClick={() => handleShare(p)}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><title>Share...</title><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg></ActionButton>}
                            </>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 space-y-3">
                {contactableParticipants.length > 0 && (
                    <button 
                        onClick={handleShareAll}
                        className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
                    >
                        Share with All ({contactableParticipants.length})
                    </button>
                )}
                <button onClick={onClose} className="w-full px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    Done
                </button>
            </div>
          </>
        );
      case 'error':
        return (
          <div className="p-8 text-center min-h-64 flex flex-col justify-between">
            <div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Failed to Share</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-300 bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{error}</p>
            </div>
            <button onClick={onClose} className="w-full mt-6 px-6 py-3 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                Close
            </button>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {renderContent()}
      </div>
    </div>
  );
};

export default ShareModal;
