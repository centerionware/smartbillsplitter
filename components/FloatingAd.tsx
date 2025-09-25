import React, { useState } from 'react';
import { AD_IFRAME_CONTENT } from '../services/adService.ts';

const FloatingAd: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = (e: React.MouseEvent) => {
    // Prevent the click from bubbling up or triggering any other default action.
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
  };

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
          onClick={handleClose}
          className="absolute top-2 right-2 z-10 p-1.5 text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm hover:bg-white/90 dark:hover:bg-slate-900/90 rounded-full transition-colors"
          aria-label="Close ad"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <iframe
          srcDoc={AD_IFRAME_CONTENT}
          title="Advertisement"
          style={{
            width: '100%',
            height: '100px',
            border: '0',
            overflow: 'hidden',
          }}
          sandbox="allow-scripts"
          aria-label="Advertisement Content"
        ></iframe>

        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2">
            Upgrade to Pro to remove ads!
        </p>
      </div>
    </aside>
  );
};

export default FloatingAd;