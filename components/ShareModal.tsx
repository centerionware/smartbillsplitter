import React, { useState, useCallback, useMemo } from 'react';
import type { Bill, Settings, Participant } from '../types';
import { generateShareLink } from '../services/shareService';
import { useAppControl } from '../contexts/AppControlContext';

interface ShareModalProps {
  bill: Bill;
  settings: Settings;
  onClose: () => void;
  onUpdateBill: (bill: Bill) => Promise<Bill>;
  checkAndMakeSpaceForImageShare: (bill: Bill) => Promise<boolean>;
}

const ActionButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean, title: string, isUsed?: boolean }> = ({ onClick, children, disabled, title, isUsed }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer ${
            isUsed 
                ? 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-400/20' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
        }`}
    >
        {children}
    </button>
);

const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);

    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
};

const ShareHistory: React.FC<{bill: Bill}> = ({ bill }) => {
    const historyEvents = useMemo(() => {
        if (!bill.shareHistory) return [];
        const events: { participantName: string; method: string; timestamp: number }[] = [];
        for (const participantId in bill.shareHistory) {
            const participant = bill.participants.find(p => p.id === participantId);
            if (!participant) continue;

            const shares = bill.shareHistory[participantId];
            for (const method in shares) {
                events.push({
                    participantName: participant.name,
                    method: method,
                    timestamp: shares[method as keyof typeof shares]!
                });
            }
        }
        return events.sort((a, b) => b.timestamp - a.timestamp);
    }, [bill.shareHistory, bill.participants]);

    if (historyEvents.length === 0) {
        return <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">No shares have been sent for this bill yet.</p>;
    }

    const getMethodText = (method: string) => {
        switch(method) {
            case 'sms': return 'via Text Message';
            case 'email': return 'via Email';
            case 'copy': return 'via Link Copy';
            case 'share': return 'via Share';
            default: return `via ${method}`;
        }
    };

    return (
        <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
            {historyEvents.map((event, index) => (
                <li key={index} className="flex justify-between items-center p-2 bg-slate-100 dark:bg-slate-700/50 rounded-md">
                    <span className="text-slate-700 dark:text-slate-200">
                        Shared with <span className="font-semibold">{event.participantName}</span> {getMethodText(event.method)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs flex-shrink-0 ml-2">{formatTimeAgo(event.timestamp)}</span>
                </li>
            ))}
        </ul>
    );
};

const ShareModal: React.FC<ShareModalProps> = ({ bill, settings, onClose, onUpdateBill, checkAndMakeSpaceForImageShare }) => {
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const { showNotification } = useAppControl();

  const getShareMessage = (p: Participant, url: string) => {
    return `Hi ${p.name.split(' ')[0]}, here is the secure link to our bill for "${bill.description}":\n\n${url}`;
  };

  const handleShareAction = async (
    participant: Participant,
    method: 'sms' | 'email' | 'copy' | 'share'
  ) => {
    const loadingKey = `${participant.id}-${method}`;
    if (loading.has(loadingKey)) return;

    setLoading(prev => new Set(prev).add(loadingKey));

    try {
        const canProceed = await checkAndMakeSpaceForImageShare(bill);
        if (!canProceed) {
            return; // Abort if space could not be made. Notification is shown by the check function.
        }
        
        const { url, billWithNewShareInfo } = await generateShareLink(bill, participant.id, settings, async (updatedBill) => { await onUpdateBill(updatedBill); });
        if (!url) {
            throw new Error('Failed to generate share link.');
        }

        const message = getShareMessage(participant, url);

        switch (method) {
            case 'sms':
                if (participant.phone) {
                    window.location.href = `sms:${participant.phone}?&body=${encodeURIComponent(message)}`;
                }
                break;
            case 'email':
                if (participant.email) {
                    window.location.href = `mailto:${participant.email}?subject=${encodeURIComponent(`Bill: ${bill.description}`)}&body=${encodeURIComponent(message)}`;
                }
                break;
            case 'copy':
                await navigator.clipboard.writeText(url);
                setCopied(participant.id);
                setTimeout(() => setCopied(null), 2000);
                break;
            case 'share':
                if (navigator.share) {
                    await navigator.share({ title: `Bill: ${bill.description}`, text: message });
                } else {
                    await navigator.clipboard.writeText(message);
                    showNotification('Share message with link copied.', 'success');
                    setCopied(participant.id);
                    setTimeout(() => setCopied(null), 2000);
                }
                break;
        }

        const now = Date.now();
        const updatedHistory = {
            ...(billWithNewShareInfo.shareHistory || {}),
            [participant.id]: {
                ...(billWithNewShareInfo.shareHistory?.[participant.id] || {}),
                [method]: now,
            },
        };
        await onUpdateBill({ ...billWithNewShareInfo, shareHistory: updatedHistory });

    } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error(`Share action '${method}' failed:`, e);
          showNotification(e.message || 'Failed to perform share action.', 'error');
        }
    } finally {
        setLoading(prev => {
            const next = new Set(prev);
            next.delete(loadingKey);
            return next;
        });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-xl font-bold text-center text-slate-800 dark:text-slate-100 mb-2">Share Bill</h3>
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">Send each participant a unique, secure link to view this bill. Links are single-use for key retrieval and expire after 24 hours.</p>
          <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {bill.participants.map(p => (
              <li key={p.id} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xs">
                    {p.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {p.phone && <ActionButton title="Share via Text Message" onClick={() => handleShareAction(p, 'sms')} disabled={loading.has(`${p.id}-sms`)} isUsed={!!bill.shareHistory?.[p.id]?.sms}><span className="text-xl" role="img" aria-label="Text message">💬</span></ActionButton>}
                  {p.email && <ActionButton title="Share via Email" onClick={() => handleShareAction(p, 'email')} disabled={loading.has(`${p.id}-email`)} isUsed={!!bill.shareHistory?.[p.id]?.email}><span className="text-xl" role="img" aria-label="Email">📧</span></ActionButton>}
                  <ActionButton title="Copy Link" onClick={() => handleShareAction(p, 'copy')} disabled={loading.has(`${p.id}-copy`)} isUsed={!!bill.shareHistory?.[p.id]?.copy}>
                    {copied === p.id ? <span className="text-xl" role="img" aria-label="Checkmark">✅</span> : <span className="text-xl" role="img" aria-label="Copy">📋</span>}
                  </ActionButton>
                  <ActionButton title="Share..." onClick={() => handleShareAction(p, 'share')} disabled={loading.has(`${p.id}-share`)} isUsed={!!bill.shareHistory?.[p.id]?.share}><span className="text-xl" role="img" aria-label="Share">🔗</span></ActionButton>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4">
              <details className="bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <summary className="cursor-pointer p-3 font-semibold text-slate-600 dark:text-slate-300">Share History</summary>
                  <div className="p-3 border-t border-slate-200 dark:border-slate-600">
                      <ShareHistory bill={bill} />
                  </div>
              </details>
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
