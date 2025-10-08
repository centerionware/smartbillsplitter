import React from 'react';
import type { RecurringBill, Participant } from '../types';

interface RecurringBillCardProps {
  bill: RecurringBill;
  onClick: () => void;
}

const RecurringBillCard: React.FC<RecurringBillCardProps> = ({ bill, onClick }) => {

  const getFrequencyText = () => {
    const { frequency, dayOfMonth, dayOfWeek, interval } = bill.recurrenceRule;
    const intervalText = interval > 1 ? `every ${interval}` : '';
    switch (frequency) {
        case 'daily': return `Repeats ${interval > 1 ? `every ${interval} days` : 'Daily'}`;
        case 'weekly':
            const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(2023, 0, (dayOfWeek ?? 0) + 1));
            return `Repeats ${interval > 1 ? `every ${interval} weeks` : 'Weekly'} on ${dayName}`;
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
            return `Repeats ${interval > 1 ? `every ${interval} months` : 'Monthly'} on the ${dayOfMonth}${suffix(dayOfMonth ?? 1)}`;
        case 'yearly': return `Repeats ${interval > 1 ? `every ${interval} years` : 'Yearly'}`;
    }
  }
  
  const formatTimeUntilDue = (dueDateString: string): string => {
    const now = new Date();
    const dueDate = new Date(dueDateString);

    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const due = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));

    const diffInMs = due.getTime() - today.getTime();
    
    if (diffInMs < 0) {
        return "Overdue";
    }
    
    if (diffInMs < 1000) { // Effectively zero
        return "Due today";
    }

    let current = new Date(today.getTime());
    let years = 0;
    let months = 0;
    let weeks = 0;

    // Calculate years
    while (true) {
        let tempDate = new Date(current.getTime());
        tempDate.setUTCFullYear(tempDate.getUTCFullYear() + 1);
        if (tempDate <= due) {
            years++;
            current = tempDate;
        } else {
            break;
        }
    }
    
    // Calculate months
    while (true) {
        let tempDate = new Date(current.getTime());
        const originalYear = tempDate.getUTCFullYear();
        const originalMonth = tempDate.getUTCMonth();
        tempDate.setUTCMonth(originalMonth + 1);
        
        // Correct for month overflow (e.g., Jan 31 -> Mar 3 instead of Feb 28/29)
        if (tempDate.getUTCMonth() !== (originalMonth + 1) % 12) {
             tempDate = new Date(Date.UTC(originalYear, originalMonth + 2, 0));
        }

        if (tempDate <= due) {
            months++;
            current = tempDate;
        } else {
            break;
        }
    }
    
    // Calculate weeks
    while (true) {
        let tempDate = new Date(current.getTime());
        tempDate.setUTCDate(tempDate.getUTCDate() + 7);
        if (tempDate <= due) {
            weeks++;
            current = tempDate;
        } else {
            break;
        }
    }
    
    const remainingMs = due.getTime() - current.getTime();
    const days = Math.round(remainingMs / (1000 * 60 * 60 * 24));

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (weeks > 0) parts.push(`${weeks} week${weeks > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    
    if (parts.length === 0) {
        return "Due today";
    }
    
    return parts.join(', ');
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 flex flex-col"
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
        <div className="mt-4 flex justify-between items-end">
           <div>
              <p className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                Next bill due in:
              </p>
               <p className="text-xl font-bold text-slate-900 dark:text-slate-50">
                 {formatTimeUntilDue(bill.nextDueDate)}
               </p>
           </div>
           {bill.totalAmount && bill.totalAmount > 0 && (
            <div className="text-right">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Default Total</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">${bill.totalAmount.toFixed(2)}</p>
            </div>
           )}
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex -space-x-2 overflow-hidden">
            {bill.participants.slice(0, 4).map((p: Participant) => (
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