import React, { useState, useRef, useEffect } from 'react';
import type { Theme } from '../types.ts';
import ThemeToggle from './ThemeToggle.tsx';

interface HeaderProps {
  onCreateNewBill: () => void;
  onGoToSettings: () => void;
  onGoToRecurringBills: () => void;
  hasRecurringBills: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const Header: React.FC<HeaderProps> = ({ onCreateNewBill, onGoToSettings, onGoToRecurringBills, hasRecurringBills, theme, setTheme }) => {
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsFabMenuOpen(false);
      }
    };
    if (isFabMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFabMenuOpen]);
  
  const handleFabAction = (action: () => void) => {
    action();
    setIsFabMenuOpen(false);
  }

  return (
    <header className="bg-white dark:bg-slate-800 shadow-md dark:shadow-none dark:border-b dark:border-slate-700">
      <div className="container mx-auto flex items-center justify-between p-4">
        <div className="flex items-center space-x-2">
          <svg className="h-8 w-8 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Smart Bill Splitter</h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          
           <div ref={fabRef} className="relative">
             <button
              onClick={() => setIsFabMenuOpen(prev => !prev)}
              className={`flex items-center justify-center h-12 w-12 bg-teal-500 text-white rounded-full hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all duration-300 transform ${isFabMenuOpen ? 'rotate-45' : 'rotate-0'}`}
              aria-label="Create new bill"
              aria-haspopup="true"
              aria-expanded={isFabMenuOpen}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>

            {isFabMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 flex flex-col items-end gap-3 z-20">
                 {hasRecurringBills && (
                    <button onClick={() => handleFabAction(onGoToRecurringBills)} className="flex items-center gap-3 w-full justify-end">
                      <span className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold px-4 py-2 rounded-lg shadow-md">Recurring Bills</span>
                      <span className="flex items-center justify-center h-10 w-10 bg-white dark:bg-slate-600 text-teal-500 rounded-full shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 18v-5h5m10-4h5v5h-5M14 18h5v-5h-5" /></svg>
                      </span>
                    </button>
                  )}
                  <button onClick={() => handleFabAction(onCreateNewBill)} className="flex items-center gap-3 w-full justify-end">
                    <span className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold px-4 py-2 rounded-lg shadow-md">New Bill</span>
                    <span className="flex items-center justify-center h-10 w-10 bg-white dark:bg-slate-600 text-teal-500 rounded-full shadow-md">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </span>
                  </button>
              </div>
            )}
           </div>

           <button
            onClick={onGoToSettings}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all duration-300"
            aria-label="Settings"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
           </button>
        </div>
      </div>
    </header>
  );
};

export default Header;