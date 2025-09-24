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
    <>
      <div>
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">{isRecurring ? 'Default Items' : 'Itemization'}</h3>
            <button type="button" onClick={onEditItems} className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline">Edit Items ({items.length})</button>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm text-slate-600 dark:text-slate-300">
            {items.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                    {items.slice(0, 3).map(item => <li key={item.id}>{item.name}{!isRecurring && ` ($${item.price.toFixed(2)})`}</li>)}
                    {items.length > 3 && <li>...and {items.length - 3} more.</li>}
                </ul>
            ) : 'No items added yet.'}
        </div>
      </div>
      
      <div>
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Additional Details</h3>
            <button type="button" onClick={onEditInfo} className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline">Edit Details ({additionalInfo.length})</button>
        </div>
      </div>
    </>
  );
};

export default BillExtraDetails;
