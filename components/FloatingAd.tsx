import React, { useState, useEffect, useRef } from 'react';
import { AD_IFRAME_CONTENT } from '../services/adService';

const FloatingAd: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [loadAd, setLoadAd] = useState(false);
  const adRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoadAd(true);
          if (adRef.current) {
            observer.unobserve(adRef.current);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (adRef.current) {
      observer.observe(adRef.current);
    }

    return () => {
      if (adRef.current) {
        observer.unobserve(adRef.current);
      }
    };
  }, [isVisible]);

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
  };

  // If ads are disabled via the provider system or closed by the user, render nothing.
  if (!isVisible || !AD_IFRAME_CONTENT) {
    return null;
  }

  return (
    <aside
      ref={adRef}
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
        
        {loadAd && (
          <iframe
            srcDoc={AD_IFRAME_CONTENT}
            title="Advertisement"
            style={{
              width: '100%',
              height: '100px',
              border: '0',
              overflow: 'hidden',
            }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            aria-label="Advertisement Content"
          ></iframe>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2">
            Upgrade to Pro to remove ads!
        </p>
      </div>
    </aside>
  );
};

export default FloatingAd;