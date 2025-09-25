import React from 'react';
import { DisclaimerContent } from './DisclaimerContent.tsx';

interface DisclaimerProps {
  onBack: () => void;
}

const Disclaimer: React.FC<DisclaimerProps> = ({ onBack }) => {
  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Disclaimer & Data Privacy</h2>
        <p className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-8">
            We believe in complete transparency. This application is designed with a "privacy first" approach. Here’s exactly how your data is handled.
        </p>
        <DisclaimerContent />
      </div>
    </div>
  );
};

export default Disclaimer;