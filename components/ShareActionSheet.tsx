import React from 'react';
import type { Participant } from '../types.ts';

interface ShareActionSheetProps {
    participant: Participant;
    onClose: () => void;
    onShareSms: (participant: Participant) => void;
    onShareEmail: (participant: Participant) => void;
    onShareGeneric: (participant: Participant) => void;
}

const ShareActionSheet: React.FC<ShareActionSheetProps> = ({ participant, onClose, onShareSms, onShareEmail, onShareGeneric }) => {
    // Prevent scrolling on the body when the modal is open
    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

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
                    {!participant.paid && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Owes ${participant.amountOwed.toFixed(2)} for this bill</p>
                    )}
                </div>
                <div className="space-y-3">
                    {participant.phone && (
                        <button 
                            onClick={() => onShareSms(participant)} 
                            className="w-full flex items-center gap-4 text-left p-4 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
                            </svg>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">Share via Text</span>
                        </button>
                    )}
                    {participant.email && (
                         <button 
                            onClick={() => onShareEmail(participant)} 
                            className="w-full flex items-center gap-4 text-left p-4 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">Share via Email</span>
                        </button>
                    )}
                    {navigator.share && (
                         <button 
                            onClick={() => onShareGeneric(participant)} 
                            className="w-full flex items-center gap-4 text-left p-4 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                            </svg>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">Share...</span>
                        </button>
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
