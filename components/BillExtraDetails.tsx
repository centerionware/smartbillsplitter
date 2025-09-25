import React from 'react';
import type { ReceiptItem } from '../types.ts';

interface BillExtraDetailsProps {
  items: ReceiptItem[];
  additionalInfo: { id: string, key: string, value: string }[];
  onEditItems: () => void;
  onEditInfo: () => void;
  isRecurring: boolean;
}

const BillExtraDetails: React.FC<BillExtraDetailsProps> = ({ items, additionalInfo, onEditItems, onEditInfo, isRecurring }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <button
        type="button"
        onClick={onEditItems}
        className="flex-1 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-teal-500 dark:hover:border-teal-400 transition-all duration-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-slate-500 dark:text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h4 className="font-semibold text-slate-700 dark:text-slate-200">{isRecurring ? 'Default Items' : 'Itemization'}</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400">({items.length} items)</p>
      </button>

      <button
        type="button"
        onClick={onEditInfo}
        className="flex-1 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-teal-500 dark:hover:border-teal-400 transition-all duration-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-slate-500 dark:text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h4 className="font-semibold text-slate-700 dark:text-slate-200">Additional Details</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400">({additionalInfo.length} details)</p>
      </button>
    </div>
  );
};

export default BillExtraDetails;