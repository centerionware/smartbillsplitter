import React, { useState, useRef, useEffect } from 'react';
import { DisclaimerContent } from './DisclaimerContent';

interface PrivacyConsentProps {
  onAccept: () => void;
}

const PrivacyConsent: React.FC<PrivacyConsentProps> = ({ onAccept }) => {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const scrollableContentRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const element = scrollableContentRef.current;
    if (element && !isScrolledToBottom) {
      // Check if user is within a small buffer zone of the bottom
      const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5;
      if (isAtBottom) {
        setIsScrolledToBottom(true);
      }
    }
  };
  
  // This effect checks if the content is scrollable at all. If not, it enables the button.
  // It also runs on resize to handle dynamic layout changes.
  useEffect(() => {
    const checkScrollability = () => {
      const element = scrollableContentRef.current;
      if (element) {
        if (element.scrollHeight <= element.clientHeight) {
          setIsScrolledToBottom(true);
        } else {
          // Explicitly set to false if it becomes scrollable on resize and isn't at the bottom
          const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5;
          setIsScrolledToBottom(isAtBottom);
        }
      }
    };

    // Check initially and on any resize
    checkScrollability();
    window.addEventListener('resize', checkScrollability);

    return () => {
      window.removeEventListener('resize', checkScrollability);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center flex flex-col max-h-[90vh]">
        <div className="flex justify-center items-center mb-6 flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 ml-3">Data & Privacy Policy</h1>
        </div>
        
        <p className="text-slate-600 dark:text-slate-300 mb-4 flex-shrink-0">
          Please review our data policy below. This app stores all your data on your device for privacy. You must scroll to the bottom to continue.
        </p>

        <div
          ref={scrollableContentRef}
          onScroll={handleScroll}
          className="text-left overflow-y-auto pr-4 mb-6 text-sm border-y border-slate-200 dark:border-slate-700 py-4 flex-grow"
        >
          <DisclaimerContent />
        </div>

        <div className="flex flex-col gap-4 flex-shrink-0">
          <button
            onClick={onAccept}
            disabled={!isScrolledToBottom}
            className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-all duration-300 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isScrolledToBottom ? 'Acknowledge & Continue' : 'Scroll to Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyConsent;