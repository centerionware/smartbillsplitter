import React from 'react';
import type { SplitMode } from '../types';

interface BillPrimaryDetailsProps {
  description: string;
  setDescription: (value: string) => void;
  totalAmount: number | undefined;
  setTotalAmount: (value: number | undefined) => void;
  date: string;
  setDate: (value: string) => void;
  isRecurring: boolean;
  splitMode: SplitMode;
  errors: { [key: string]: string };
}

const BillPrimaryDetails: React.FC<BillPrimaryDetailsProps> = ({
  description,
  setDescription,
  totalAmount,
  setTotalAmount,
  date,
  setDate,
  isRecurring,
  splitMode,
  errors,
}) => {
  return (
    <>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
        <input id="description" type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
        {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className={`flex-1 ${isRecurring ? 'w-full' : 'sm:w-1/2'}`}>
            <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Total Amount {isRecurring && '(Optional)'}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                <input id="totalAmount" type="number" step="0.01" value={totalAmount === undefined ? '' : totalAmount} onChange={e => setTotalAmount(e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={splitMode === 'item'} className="w-full pl-7 pr-2 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-600" />
            </div>
             {errors.totalAmount && <p className="text-sm text-red-500 mt-1">{errors.totalAmount}</p>}
        </div>
        {!isRecurring && (
            <div className="flex-1 sm:w-1/2">
                <label htmlFor="date" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Date</label>
                <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
            </div>
        )}
      </div>
    </>
  );
};

export default BillPrimaryDetails;