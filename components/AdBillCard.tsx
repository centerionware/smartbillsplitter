import React, { useState, useEffect, useRef } from 'react';
import { AD_IFRAME_CONTENT } from '../services/adService';

const AdBillCard: React.FC = () => {
  const [loadAd, setLoadAd] = useState(false);
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the component is intersecting with the viewport, load the ad.
        if (entry.isIntersecting) {
          setLoadAd(true);
          // Stop observing once the ad is loaded to prevent unnecessary work.
          if (adRef.current) {
            observer.unobserve(adRef.current);
          }
        }
      },
      {
        rootMargin: '100px', // Start loading when it's 100px away from the viewport
        threshold: 0.01,    // As soon as a tiny part is visible
      }
    );

    if (adRef.current) {
      observer.observe(adRef.current);
    }

    return () => {
      if (adRef.current) {
        observer.unobserve(adRef.current);
      }
    };
  }, []);

  // If no ad provider is configured, render nothing.
  if (!AD_IFRAME_CONTENT) {
    return null;
  }

  return (
    <div ref={adRef} className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden h-full flex flex-col justify-between p-5 border border-slate-200 dark:border-slate-700 min-h-[150px]">
      <div>
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Advertisement
        </span>
      </div>
      <div className="flex items-center justify-center min-h-[100px] w-full">
        {loadAd && (
          <iframe
            srcDoc={AD_IFRAME_CONTENT}
            title="Advertisement"
            style={{
              width: '100%',
              minHeight: '100px',
              border: '0',
              overflow: 'hidden',
            }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            aria-label="Advertisement Content"
          ></iframe>
        )}
      </div>
    </div>
  );
};

export default AdBillCard;