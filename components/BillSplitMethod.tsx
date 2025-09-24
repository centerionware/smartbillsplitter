import React from 'react';
import type { SplitMode } from '../types.ts';

interface BillSplitMethodProps {
  splitMode: SplitMode;
  setSplitMode: (mode: SplitMode) => void;
  splitError?: string;
}

const BillSplitMethod: React.FC<BillSplitMethodProps> = ({ splitMode, setSplitMode, splitError }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-200">Split Method</h3>
      <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
          <button type="button" onClick={() => setSplitMode('equally')} className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${splitMode === 'equally' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Equally</button>
          <button type="button" onClick={() => setSplitMode('amount')} className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${splitMode === 'amount' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By Amount</button>
          <button type="button" onClick={() => setSplitMode('percentage')} className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${splitMode === 'percentage' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By %</button>
          <button type="button" onClick={() => setSplitMode('item')} className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${splitMode === 'item' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By Item</button>
      </div>
      {splitError && <p className="text-sm text-red-500 mt-2">{splitError}</p>}
    </div>
  );
};

export default BillSplitMethod;
