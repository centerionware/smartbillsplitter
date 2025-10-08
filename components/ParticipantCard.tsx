import React from 'react';
// FIX: Add import for DashboardLayoutMode type.
import type { DashboardLayoutMode } from '../types';

interface ParticipantCardProps {
  data: { name: string; amount: number; type: 'owed' | 'paid'; phone?: string; email?: string; };
  onClick: () => void;
  // FIX: Add layoutMode to props to satisfy type checking from parent components.
  layoutMode: DashboardLayoutMode;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({ data, onClick }) => {

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 flex flex-col p-5"
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-slate-800 bg-teal-500 flex items-center justify-center text-white font-bold text-lg">
                {data.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{data.name}</p>
        </div>
        <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
        </div>
      </div>

      <div className="mt-4 text-right">
        <p className={`text-sm font-semibold ${data.type === 'owed' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {data.type === 'owed' ? 'Owes' : 'Total Paid'}
        </p>
        <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
          ${data.amount.toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default ParticipantCard;