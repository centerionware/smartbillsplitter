import React from 'react';

interface DisclaimerProps {
  onBack: () => void;
}

const Disclaimer: React.FC<DisclaimerProps> = ({ onBack }) => {
  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back to Dashboard
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Disclaimer & Data Privacy</h2>
        
        <div className="space-y-6 text-slate-600 dark:text-slate-300">
          <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
            We believe in complete transparency about how your data is handled. This application is designed with a "privacy first" approach.
          </p>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">Local-Only Data Storage</h3>
            <p>
              All the data you enter into Smart Bill Splitter—including your bills, participant names, amounts, and settings—is stored exclusively in your browser's <strong>local storage</strong>. This means your data lives directly on your device (your computer, phone, or tablet).
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 pl-2">
              <li><strong>We do not have a server database.</strong></li>
              <li><strong>We never store, see, or have access to your personal financial data.</strong></li>
              <li>Because the data is only on your device, you are responsible for it. If you clear your browser data or lose your device, your data will be permanently lost unless you have created a backup using the "Export Data" feature in Settings.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">Client-Side Rendering</h3>
            <p>
              This is a 100% client-side rendered application. The entire application runs within your web browser. No data is sent to a server for processing, with one specific exception detailed below.
            </p>
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">Use of Google Gemini API for Receipt Scanning</h3>
            <p>
              The only time any data is sent to an external server is when you choose to use the <strong>"Scan with AI"</strong> feature for a receipt.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 pl-2">
              <li>When you upload a receipt image, that image is sent directly from your browser to the <strong>Google Gemini API</strong> for analysis.</li>
              <li>This is necessary for the AI to read the text and extract the line items and prices.</li>
              <li>The analyzed data is then sent back to your browser and is not stored on any server controlled by us.</li>
              <li>Your use of this feature is subject to Google's Privacy Policy. You can review it here: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-teal-400 hover:underline">https://policies.google.com/privacy</a>.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">No Warranties</h3>
            <p>
              This application is provided "as is," without warranty of any kind. We are not responsible for any data loss. We strongly encourage you to use the export feature to back up your data regularly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Disclaimer;
