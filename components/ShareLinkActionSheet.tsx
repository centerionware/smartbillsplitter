import React from 'react';
import type { Participant } from '../types.ts';

interface ShareLinkActionSheetProps {
    participant: Participant;
    url: string;
    billDescription: string;
    onClose: () => void;
    onCopy: () => void;
}

const ActionButton: React.FC<{onClick: () => void; href?: string; icon: React.ReactNode; text: string;}> = ({ onClick, href, icon, text }) => {
    const commonProps = {
        className: "w-full flex items-center gap-4 text-left p-4 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors",
        onClick: onClick,
    };
    
    return href ? (
        <a href={href} {...commonProps}>{icon}<span className="font-semibold text-slate-800 dark:text-slate-100">{text}</span></a>
    ) : (
        <button type="button" {...commonProps}>{icon}<span className="font-semibold text-slate-800 dark:text-slate-100">{text}</span></button>
    );
};


export const ShareLinkActionSheet: React.FC<ShareLinkActionSheetProps> = ({ participant, url, billDescription, onClose, onCopy }) => {
    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);
    
    const message = `Here is your unique link for our bill "${billDescription}": ${url}`;

    const handleShareSystem = async () => {
        if (navigator.share) {
            await navigator.share({ title: `Bill: ${billDescription}`, text: message });
        }
        onClose();
    };
    
    const handleCopyClick = () => {
        navigator.clipboard.writeText(url);
        onCopy();
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end backdrop-blur-sm" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-link-sheet-title"
        >
            <div 
                className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-2xl p-4 animate-slide-up shadow-2xl" 
                onClick={e => e.stopPropagation()}
            >
                <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4"></div>
                <div className="text-center mb-6">
                    <h3 id="share-link-sheet-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Share Link with {participant.name}</h3>
                </div>
                <div className="space-y-2">
                    {participant.phone && <ActionButton href={`sms:${participant.phone}?&body=${encodeURIComponent(message)}`} onClick={onClose} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>} text="Share via Text" />}
                    {participant.email && <ActionButton href={`mailto:${participant.email}?subject=${encodeURIComponent(`Bill: ${billDescription}`)}&body=${encodeURIComponent(message)}`} onClick={onClose} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>} text="Share via Email" />}
                    <ActionButton onClick={handleCopyClick} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2-2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>} text="Copy Link" />
                    {navigator.share && <ActionButton onClick={handleShareSystem} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>} text="Share..." />}
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
