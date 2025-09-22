import React from 'react';
import type { Bill } from '../types';

interface BillCardProps {
  bill: Bill;
  onClick: () => void;
}

const BillCard: React.FC<BillCardProps> = ({ bill, onClick }) => {
  const paidCount = bill.participants.filter(p => p.paid).length;
  const totalCount = bill.participants.length;
  const isFullyPaid = paidCount === totalCount;

  const totalPaid = bill.participants
    .filter(p => p.paid)
    .reduce((sum, p) => sum + p.amountOwed, 0);
  const unpaidAmount = bill.totalAmount - totalPaid;

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1"
    >
      <div className="p-5">
        <div className="flex justify-between items-start">
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{bill.description}</p>
          <span
            className={`px-3 py-1 text-xs font-semibold rounded-full ${
              isFullyPaid
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
            }`}
          >
            {isFullyPaid ? 'Paid' : 'Pending'}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {new Date(bill.date).toLocaleDateString()}
        </p>
        <div className="mt-4">
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
            ${bill.totalAmount.toFixed(2)}
          </p>
          {!isFullyPaid && unpaidAmount > 0.01 && (
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-1">
              ${unpaidAmount.toFixed(2)} unpaid
            </p>
          )}
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex -space-x-2 overflow-hidden">
            {bill.participants.slice(0, 4).map(p => (
              <div key={p.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-teal-500 flex items-center justify-center text-white font-bold text-xs">
                {p.name.charAt(0)}
              </div>
            ))}
            {bill.participants.length > 4 && (
              <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs">
                +{bill.participants.length - 4}
              </div>
            )}
          </div>
          <p className="font-medium text-slate-600 dark:text-slate-300">
            {paidCount} of {totalCount} paid
          </p>
        </div>
      </div>
    </div>
  );
};

export default BillCard;