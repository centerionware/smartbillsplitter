import React, { useRef, useEffect } from 'react';
import { AD_IFRAME_CONTENT } from '../services/adService.ts';

interface HalfScreenAdModalProps {
  onClose: () => void;
}

const HalfScreenAdModal: React.FC<HalfScreenAdModalProps> = ({ onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => {
        if(modalRef.current) {
            modalRef.current.classList.remove('translate-y-full');
        }
    }, 100); // Small delay to ensure transition is applied
    return () => clearTimeout(timer);
  }, []);
  
  const handleClose = () => {
      if(modalRef.current) {
          modalRef.current.classList.add('translate-y-full');
          // Wait for animation to finish before calling onClose
          setTimeout(onClose, 300);
      } else {
          onClose();
      }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Advertisement"
    >
      <div
        ref={modalRef}
        className="w-full h-1/2 bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl transform translate-y-full transition-transform duration-300 ease-out"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-full flex flex-col p-4">
           <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Advertisement
            </span>
             <button
              onClick={handleClose}
              className="p-1.5 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"
              aria-label="Close ad"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-grow w-full h-full">
            <iframe
              srcDoc={AD_IFRAME_CONTENT}
              title="Advertisement"
              style={{
                width: '100%',
                height: '100%',
                border: '0',
                overflow: 'hidden',
              }}
              sandbox="allow-scripts"
              aria-label="Advertisement Content"
            ></iframe>
           </div>
           <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2">
            Upgrade to Pro to remove ads!
           </p>
        </div>
      </div>
    </div>
  );
};

export default HalfScreenAdModal;