import React, { useEffect } from 'react';

const AdBillCard: React.FC = () => {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense push error for in-feed ad: ", e);
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
        {/* Google AdSense Ad Unit */}
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client="ca-pub-7626920066448337"
          data-ad-slot="8267308457"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </div>
    </div>
  );
};

export default AdBillCard;
