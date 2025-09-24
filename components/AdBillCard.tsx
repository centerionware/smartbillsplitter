import React, { useRef, useEffect } from 'react';
import { AD_IFRAME_CONTENT } from '../services/adService.ts';

const AdBillCard: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(AD_IFRAME_CONTENT);
        doc.close();
      }
    }
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden h-full flex flex-col justify-between p-5 border border-slate-200 dark:border-slate-700">
      <div>
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Advertisement
        </span>
      </div>
      <div className="flex items-center justify-center min-h-[100px] w-full">
        <iframe
          ref={iframeRef}
          title="Advertisement"
          style={{
            width: '100%',
            minHeight: '100px',
            border: '0',
            overflow: 'hidden',
          }}
          sandbox="allow-scripts allow-same-origin"
          aria-label="Advertisement Content"
        ></iframe>
      </div>
    </div>
  );
};

export default AdBillCard;