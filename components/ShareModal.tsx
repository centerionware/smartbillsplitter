import React, { useState, useEffect, useCallback } from 'react';
import type { Bill, Settings, Participant } from '../types.ts';
import { useKeys } from '../hooks/useKeys.ts';
import { generateShareLinksForParticipants } from '../services/shareService.ts';

interface ShareModalProps {
  bill: Bill;
  settings: Settings;
  onClose: () => void;
  onUpdateBill: (bill: Bill) => void;
}

type View = 'selection' | 'generating' | 'links' | 'error';

const ShareModal: React.FC<ShareModalProps> = ({ bill, settings, onClose, onUpdateBill }) => {
  const [view, setView] = useState<View>('selection');
  const [error, setError] = useState<string | null>(null);
  const { keyPair, isLoading: keysLoading } = useKeys();
  
  const myNameLower = settings.myDisplayName.toLowerCase().trim();
  const shareableParticipants = bill.participants.filter(p => p.name.toLowerCase().trim() !== myNameLower);

  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(() => new Set(shareableParticipants.map(p => p.id)));
  const [generatedLinks, setGeneratedLinks] = useState<Map<string, string>>(new Map());

  const handleToggleParticipant = (id: string) => {
    setSelectedParticipantIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleGenerateLinks = useCallback(async () => {
    if (!keyPair || selectedParticipantIds.size === 0) {
      return;
    }

    setView('generating');
    setError(null);

    try {
        const selectedNames = Array.from(selectedParticipantIds)
            .map(id => bill.participants.find(p => p.id === id)?.name)
            .filter((name): name is string => !!name);

      const { links, shareInfo } = await generateShareLinksForParticipants(bill, selectedNames, settings, keyPair);
      
      const linksMap = new Map<string, string>();
      links.forEach((url, name) => {
          const participant = bill.participants.find(p => p.name === name);
          if(participant) {
            linksMap.set(participant.id, url);
          }
      });
      setGeneratedLinks(linksMap);
      
      if (shareInfo && !bill.shareInfo) {
        onUpdateBill({ ...bill, shareInfo });
      }
      
      setView('links');
    } catch (err: any) {
      console.error("Error generating share links:", err);
      setError(err.message || "An unknown error occurred while creating share links.");
      setView('error');
    }
  }, [bill, settings, keyPair, onUpdateBill, selectedParticipantIds]);

  const handleCopy = (url: string, participantId: string) => {
    navigator.clipboard.writeText(url).then(() => {
      // Simple feedback: maybe change button text or show a toast
      const button = document.getElementById(`copy-btn-${participantId}`);
      if(button) {
          const originalText = button.innerHTML;
          button.innerText = 'Copied!';
          setTimeout(() => { button.innerHTML = originalText; }, 2000);
      }
    });
  };

  const renderSelectionView = () => (
    <>
      <div className="p-6 text-center">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Generate Share Links</h3>
        <p className="text-slate-500 dark:text-slate-400">Select participants to generate a unique, one-time use link for each.</p>
      </div>
      <div className="px-6 pb-6 space-y-3 max-h-64 overflow-y-auto">
        {shareableParticipants.map(p => (
          <div key={p.id} onClick={() => handleToggleParticipant(p.id)} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={selectedParticipantIds.has(p.id)}
              onChange={() => handleToggleParticipant(p.id)}
              className="h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
          </div>
        ))}
      </div>
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={handleGenerateLinks}
          disabled={selectedParticipantIds.size === 0}
          className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-slate-400 dark:disabled:bg-slate-600 transition-colors"
        >
          Generate {selectedParticipantIds.size} Link{selectedParticipantIds.size !== 1 && 's'}
        </button>
      </div>
    </>
  );

  const renderGeneratingView = () => (
     <div className="flex flex-col items-center justify-center p-8 text-center min-h-64">
        <svg className="animate-spin h-12 w-12 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <p className="mt-4 text-slate-500 dark:text-slate-400">Generating secure links...</p>
      </div>
  );
  
  const renderLinksView = () => (
     <>
      <div className="p-6 text-center">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Links Generated</h3>
        <p className="text-slate-500 dark:text-slate-400">Send each person their unique link. Links expire after being used once or after 30 days.</p>
      </div>
      <div className="px-6 pb-6 space-y-3 max-h-80 overflow-y-auto">
        {Array.from(generatedLinks.entries()).map(([participantId, url]) => {
            const p = bill.participants.find(p => p.id === participantId);
            if(!p) return null;

            const message = `Here is your unique link for our bill "${bill.description}": ${url}`;

            return (
                <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2">{p.name}</p>
                    <div className="flex items-center gap-2">
                        <input type="text" readOnly value={url} className="w-full text-xs px-2 py-1 border border-slate-300 rounded-md bg-slate-200 dark:bg-slate-600 dark:border-slate-500 text-slate-500 dark:text-slate-400"/>
                        <button id={`copy-btn-${p.id}`} onClick={() => handleCopy(url, p.id)} className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 rounded-md" title="Copy link">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600 dark:text-slate-200" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>
                        </button>
                        {p.phone && <a href={`sms:${p.phone}?&body=${encodeURIComponent(message)}`} className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 rounded-md" title="Send SMS"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600 dark:text-slate-200" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg></a>}
                        {p.email && <a href={`mailto:${p.email}?subject=${encodeURIComponent(`Bill: ${bill.description}`)}&body=${encodeURIComponent(message)}`} className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 rounded-md" title="Send Email"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600 dark:text-slate-200" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg></a>}
                    </div>
                </div>
            )
        })}
      </div>
       <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
        <button onClick={onClose} className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">
          Done
        </button>
      </div>
    </>
  );
  
   const renderErrorView = () => (
        <div className="p-8 text-center min-h-64">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Failed to Share</h3>
            <p className="mt-2 text-slate-600 dark:text-slate-300 bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{error}</p>
             <div className="p-4 mt-4">
                <button onClick={onClose} className="w-full px-6 py-3 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                    Close
                </button>
            </div>
        </div>
    );


  const renderContent = () => {
    switch (view) {
      case 'selection': return renderSelectionView();
      case 'generating': return renderGeneratingView();
      case 'links': return renderLinksView();
      case 'error': return renderErrorView();
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