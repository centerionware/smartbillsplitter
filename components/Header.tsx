import React, { useState, useRef, useEffect } from 'react';
import type { Theme } from '../types.ts';
import ThemeToggle from './ThemeToggle.tsx';
import QrImporterModal from './QrImporterModal.tsx';

interface HeaderProps {
  onGoHome: () => void;
  onCreateNewBill: () => void;
  onGoToSettings: () => void;
  onGoToRecurringBills: () => void;
  onNavigate: (path: string) => void;
  onOpenCsvImporter: () => void;
  hasRecurringBills: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const Header: React.FC<HeaderProps> = ({ onGoHome, onCreateNewBill, onGoToSettings, onGoToRecurringBills, onNavigate, onOpenCsvImporter, hasRecurringBills, theme, setTheme }) => {
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    if (isOptionsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOptionsMenuOpen]);
  
  const handleMenuAction = (action: () => void) => {
    action();
    setIsOptionsMenuOpen(false);
  }
  
  const handleScanSuccess = (url: string) => {
      try {
        const urlObject = new URL(url);
        if (urlObject.hash.startsWith('#/view-bill')) {
            onNavigate(urlObject.hash);
            setIsQrModalOpen(false);
        }
      } catch (e) {
        // Not a valid URL, do nothing. The scanner modal can show an error.
        console.error("Scanned QR is not a valid URL:", e);
      }
  }

  return (
    <>
    {isQrModalOpen && <QrImporterModal onScanSuccess={handleScanSuccess} onClose={() => setIsQrModalOpen(false)} />}
    <header className="bg-white dark:bg-slate-800 shadow-md dark:shadow-none dark:border-b dark:border-slate-700">
      <div className="container mx-auto flex items-center justify-between p-4">
        <button 
          onClick={onGoHome} 
          className="flex items-center space-x-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 p-1 -ml-1"
          aria-label="Go to dashboard"
        >
          <svg className="h-8 w-8 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">SharedBills</h1>
        </button>
        <div className="flex items-center gap-2 md:gap-4">
          
          {/* Consolidated Menu */}
          <div ref={optionsMenuRef} className="relative">
            <button
              onClick={() => setIsOptionsMenuOpen(prev => !prev)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-all duration-300"
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={isOptionsMenuOpen}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {isOptionsMenuOpen && (
              <div
                className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-20"
                role="menu"
              >
                <button
                  onClick={() => handleMenuAction(() => setIsQrModalOpen(true))}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  role="menuitem"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h-1m-1-5v1m-2-1v1m-2-1v1m-2-1v1m-6 0h1m6 5h1m-1-5v1m-2-1v1m-2-1v1m-2-1v1M4 12h1m6 5h1m-1-5v1m-2-1v1m-2-1v1m-2-1v1" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h1a2 2 0 002-2v-1a2 2 0 012-2h1.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h1A2.5 2.5 0 0014 5.5V3.935M9 21v-1.5a2.5 2.5 0 012.5-2.5h1A2.5 2.5 0 0115 19.5V21" />
                  </svg>
                  <span>Scan QR Code</span>
                </button>
                <button
                  onClick={() => handleMenuAction(onOpenCsvImporter)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  role="menuitem"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <span>Import from CSV</span>
                </button>
                 {hasRecurringBills && (
                    <button onClick={() => handleMenuAction(onGoToRecurringBills)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 18v-5h5m10-4h5v5h-5M14 18h5v-5h-5" /></svg>
                      <span>Recurring Bills</span>
                    </button>
                  )}
              </div>
            )}
          </div>

          <ThemeToggle theme={theme} setTheme={setTheme} />
          
          <button
            onClick={onCreateNewBill}
            className="flex items-center justify-center h-10 w-10 bg-teal-500 text-white rounded-full hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-all duration-300"
            aria-label="Create new bill"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>

           <button
            onClick={onGoToSettings}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-all duration-300"
            aria-label="Settings"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
           </button>
        </div>
      </div>
    </header>
    </>
  );
};

export default Header;