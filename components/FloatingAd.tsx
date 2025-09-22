import React, { useState } from 'react';

const FloatingAd: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-4 right-4 z-50 w-full max-w-sm bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700"
      role="complementary"
      aria-label="Advertisement"
    >
      <div className="relative p-4">
        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full"
          aria-label="Close ad"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex flex-col items-center justify-center h-48 bg-slate-100 dark:bg-slate-700 rounded-md">
          <p className="text-slate-500 dark:text-slate-400 font-semibold">ADVERTISEMENT</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Upgrade to Pro to remove ads!</p>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2">
            This is a placeholder ad frame.
        </p>
      </div>
    </aside>
  );
};

export default FloatingAd;