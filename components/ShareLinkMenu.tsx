import React, { useRef, useEffect } from 'react';
import type { Participant } from '../types.ts';

interface ShareLinkMenuProps {
  url: string;
  billDescription: string;
  participant: Participant;
  onClose: () => void;
  onCopy: () => void;
}

const MenuItem: React.FC<{ onClick: () => void; children: React.ReactNode; href?: string }> = ({ onClick, children, href }) => {
  const commonProps = {
    className: "w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700",
    role: "menuitem",
    onClick: onClick
  };
  return href ? <a href={href} {...commonProps}>{children}</a> : <button type="button" {...commonProps}>{children}</button>;
};

export const ShareLinkMenu: React.FC<ShareLinkMenuProps> = ({ url, billDescription, participant, onClose, onCopy }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

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
      ref={menuRef}
      className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-30"
      role="menu"
    >
      {participant.phone && (
        <MenuItem href={`sms:${participant.phone}?&body=${encodeURIComponent(message)}`} onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>
          <span>Share via Text</span>
        </MenuItem>
      )}
      {participant.email && (
        <MenuItem href={`mailto:${participant.email}?subject=${encodeURIComponent(`Bill: ${billDescription}`)}&body=${encodeURIComponent(message)}`} onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
          <span>Share via Email</span>
        </MenuItem>
      )}
      <MenuItem onClick={handleCopyClick}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>
        <span>Copy Link</span>
      </MenuItem>
      {navigator.share && (
        <MenuItem onClick={handleShareSystem}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
          <span>Share...</span>
        </MenuItem>
      )}
    </div>
  );
};