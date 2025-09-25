import React from 'react';
import { AD_IFRAME_CONTENT } from '../services/adService.ts';

const AdBillCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden h-full flex flex-col justify-between p-5 border border-slate-200 dark:border-slate-700">
      <div>
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Advertisement
        </span>
      </div>
      <div className="flex items-center justify-center min-h-[100px] w-full">
        <iframe
          srcDoc={AD_IFRAME_CONTENT}
          title="Advertisement"
          style={{
            width: '100%',
            minHeight: '100px',
            border: '0',
            overflow: 'hidden',
          }}
          sandbox="allow-scripts"
          aria-label="Advertisement Content"
        ></iframe>
      </div>
    </div>
  );
};

export default AdBillCard;