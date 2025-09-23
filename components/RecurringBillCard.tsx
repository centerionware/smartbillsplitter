import React from 'react';
import type { RecurringBill } from '../types.ts';

interface RecurringBillCardProps {
  bill: RecurringBill;
  onClick: () => void;
}

const RecurringBillCard: React.FC<RecurringBillCardProps> = ({ bill, onClick }) => {

  const getFrequencyText = () => {
    const { frequency, dayOfMonth, dayOfWeek } = bill.recurrenceRule;
    switch (frequency) {
        case 'daily': return 'Repeats Daily';
        case 'weekly':
            const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(2023, 0, (dayOfWeek ?? 0) + 1));
            return `Repeats Weekly on ${dayName}`;
        case 'monthly':
            const suffix = (d: number) => {
                if (d > 3 && d < 21) return 'th';
                switch (d % 10) {
                    case 1: return "st";
                    case 2: return "nd";
                    case 3: return "rd";
                    default: return "th";
                }
            };
            return `Repeats Monthly on the ${dayOfMonth}${suffix(dayOfMonth ?? 1)}`;
        case 'yearly': return 'Repeats Yearly';
    }
  }

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 h-full flex flex-col"
    >
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start">
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{bill.description}</p>
          <span className="px-3 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
            Template
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {getFrequencyText()}
        </p>
        <div className="mt-4">
          <p className="text-sm font-semibold text-teal-600 dark:text-teal-400">
            Next bill due:
          </p>
           <p className="text-xl font-bold text-slate-900 dark:text-slate-50">
             {new Date(bill.nextDueDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric'})}
           </p>
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
            {bill.participants.length} participant{bill.participants.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecurringBillCard;
