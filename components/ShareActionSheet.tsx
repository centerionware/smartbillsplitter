import React, { useState } from 'react';
import type { Participant } from '../types';

interface ShareActionSheetProps {
    participant: Participant;
    onClose: () => void;
    shareContext: 'bill' | 'dashboard';
    // Simple reminder handlers
    onShareSms: (participant: Participant) => void;
    onShareEmail: (participant: Participant) => void;
    onShareGeneric: (participant: Participant) => void;
    // Aggregate share link handlers
    onShareLinkSms?: (participant: Participant) => Promise<void>;
    onShareLinkEmail?: (participant: Participant) => Promise<void>;
    onShareLinkGeneric?: (participant: Participant) => Promise<void>;
    // Navigation handler
    onViewDetails?: () => void;
}

type ShareState = 'choose' | 'reminder' | 'link';

const ActionButton: React.FC<{onClick: () => void; disabled?: boolean; icon: React.ReactNode; text: string; subtext?: string}> = ({ onClick, disabled, icon, text, subtext }) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className="w-full flex items-center gap-4 text-left p-4 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer"
    >
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">{icon}</div>
        <div className="flex-grow">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{text}</span>
            {subtext && <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>}
        </div>
        {disabled && <svg className="animate-spin h-5 w-5 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
    </button>
);


const ShareActionSheet: React.FC<ShareActionSheetProps> = (props) => {
    const { participant, shareContext, onClose, onShareSms, onShareEmail, onShareGeneric, onShareLinkSms, onShareLinkEmail, onShareLinkGeneric, onViewDetails } = props;
    const [shareState, setShareState] = useState<ShareState>('choose');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const isShareApiAvailable = typeof navigator !== 'undefined' && !!navigator.share;

    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const handleShareLink = async (shareFn?: (p: Participant) => Promise<void>) => {
        if (!shareFn) return;
        setIsGeneratingLink(true);
        try {
            await shareFn(participant);
        } catch (e) {
            // Error handling is done in the parent component
        } finally {
            setIsGeneratingLink(false);
            onClose(); // Close sheet after action
        }
    };

    const renderChooseState = () => (
      <div className="space-y-4">
        <ActionButton 
          onClick={() => setShareState('reminder')}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>}
          text="Send Simple Reminder"
          subtext="A plain text message with amounts owed."
        />
         <ActionButton 
          onClick={() => setShareState('link')}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>}
          text="Send Interactive Bill"
          subtext="A secure, live-updating link to the bill."
        />
        {onViewDetails && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <ActionButton onClick={onViewDetails} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" /><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg>} text="View All Bills" />
            </div>
        )}
      </div>
    );
    
    const renderReminderState = () => (
      <div className="space-y-2">
        {participant.phone && <ActionButton onClick={() => onShareSms(participant)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>} text="Share via Text" />}
        {participant.email && <ActionButton onClick={() => onShareEmail(participant)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>} text="Share via Email" />}
        {isShareApiAvailable ? (
             <ActionButton onClick={() => onShareGeneric(participant)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>} text="Share Reminder..." />
        ) : (
             <ActionButton onClick={() => onShareGeneric(participant)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2-2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>} text="Copy Reminder Text" />
        )}
      </div>
    );

    const renderLinkState = () => (
         <div className="space-y-2">
            {participant.phone && onShareLinkSms && <ActionButton onClick={() => handleShareLink(onShareLinkSms)} disabled={isGeneratingLink} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>} text="Share Link via Text" />}
            {participant.email && onShareLinkEmail && <ActionButton onClick={() => handleShareLink(onShareLinkEmail)} disabled={isGeneratingLink} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>} text="Share Link via Email" />}
            {onShareLinkGeneric && (isShareApiAvailable ? (
            <ActionButton onClick={() => handleShareLink(onShareLinkGeneric)} disabled={isGeneratingLink} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>} text="Share Link..." />
            ) : (
            <ActionButton onClick={() => handleShareLink(onShareLinkGeneric)} disabled={isGeneratingLink} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2-2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>} text="Copy Link" />
            ))}
         </div>
    );
    
    const renderContent = () => {
        switch (shareState) {
            case 'reminder': return renderReminderState();
            case 'link': return renderLinkState();
            case 'choose':
            default: return renderChooseState();
        }
    };
    
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end backdrop-blur-sm" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-sheet-title"
        >
            <div 
                className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-2xl p-4 animate-slide-up shadow-2xl" 
                onClick={e => e.stopPropagation()}
            >
                <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4"></div>
                <div className="text-center mb-6">
                    <h3 id="share-sheet-title" className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-3">
                        {shareState !== 'choose' && (
                            <button onClick={() => setShareState('choose')} className="p-1 -ml-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            </button>
                        )}
                        <span>Share with {participant.name}</span>
                    </h3>
                </div>
                {renderContent()}
                <div className="mt-6">
                    <button 
                        onClick={onClose} 
                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShareActionSheet;