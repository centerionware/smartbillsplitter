import React, { useState } from 'react';
import type { Participant } from '../types.ts';

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
        }
    };
    
    const showLinkSection = onShareLinkSms || onShareLinkEmail || onShareLinkGeneric;
    const linkTitle = shareContext === 'bill' ? 'Share 24h Bill Link' : 'Share 24h Summary Link';
    const linkDescription = shareContext === 'bill'
        ? 'Generates a secure, temporary link to view this bill.'
        : 'Generates a secure, temporary link to a summary of all their outstanding bills.';


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
                    <h3 id="share-sheet-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Share with {participant.name}</h3>
                </div>
                <div className="space-y-4">
                    {/* --- Simple Reminder Section --- */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 px-2">Send Simple Reminder</h4>
                        {participant.phone && <ActionButton onClick={() => onShareSms(participant)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>} text="Share via Text" />}
                        {participant.email && <ActionButton onClick={() => onShareEmail(participant)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>} text="Share via Email" />}
                        
                        {isShareApiAvailable ? (
                             <ActionButton onClick={() => onShareGeneric(participant)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>} text="Share Reminder..." />
                        ) : (
                             <ActionButton onClick={() => onShareGeneric(participant)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2-2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>} text="Copy Reminder Text" />
                        )}
                    </div>

                    {/* --- Share Link Section --- */}
                    {showLinkSection && (
                        <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                             <div className="px-2">
                                <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400">{linkTitle}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{linkDescription}</p>
                             </div>
                             {participant.phone && onShareLinkSms && <ActionButton onClick={() => handleShareLink(onShareLinkSms)} disabled={isGeneratingLink} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>} text="Share Link via Text" />}
                             {participant.email && onShareLinkEmail && <ActionButton onClick={() => handleShareLink(onShareLinkEmail)} disabled={isGeneratingLink} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>} text="Share Link via Email" />}
                             {onShareLinkGeneric && (isShareApiAvailable ? (
                                <ActionButton onClick={() => handleShareLink(onShareLinkGeneric)} disabled={isGeneratingLink} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>} text="Share Link..." />
                              ) : (
                                <ActionButton onClick={() => handleShareLink(onShareLinkGeneric)} disabled={isGeneratingLink} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2-2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>} text="Copy Link" />
                             ))}
                        </div>
                    )}
                    
                     {/* --- Other Actions Section --- */}
                    {onViewDetails && (
                         <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                             <ActionButton onClick={onViewDetails} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" /><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg>} text="View All Bills" />
                         </div>
                    )}

                </div>
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