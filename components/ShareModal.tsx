import React, { useState, useCallback } from 'react';
import type { Bill, Settings, Participant } from '../types';
import { generateShareLink } from '../services/shareService.ts';
import { useAppControl } from '../contexts/AppControlContext.tsx';

interface ShareModalProps {
  bill: Bill;
  settings: Settings;
  onClose: () => void;
  onUpdateBill: (bill: Bill) => Promise<void>;
}

const ActionButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean, title: string, isUsed?: boolean }> = ({ onClick, children, disabled, title, isUsed }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer ${
            isUsed 
                ? 'text-emerald-500 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
        }`}
    >
        {children}
    </button>
);

const ShareModal: React.FC<ShareModalProps> = ({ bill, settings, onClose, onUpdateBill }) => {
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
        const url = await generateShareLink(bill, participant.id, settings, onUpdateBill);
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
            ...(bill.shareHistory || {}),
            [participant.id]: {
                ...(bill.shareHistory?.[participant.id] || {}),
                [method]: now,
            },
        };
        await onUpdateBill({ ...bill, shareHistory: updatedHistory });

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
          <ul className="space-y-2 max-h-80 overflow-y-auto pr-2">
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
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;