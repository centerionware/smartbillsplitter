import React from 'react';
import type { DashboardLayoutMode } from '../types';

interface ParticipantCardProps {
  data: { name: string; amount: number; type: 'owed' | 'paid'; phone?: string; email?: string; };
  onClick: () => void;
  layoutMode: DashboardLayoutMode;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({ data, onClick, layoutMode }) => {
  if (layoutMode === 'list') {
    return (
      <div
        onClick={onClick}
        className="w-full flex items-center p-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
      >
        <div className="flex-grow flex items-center gap-3 overflow-hidden">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm">
            {data.name.charAt(0).toUpperCase()}
          </div>
          <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{data.name}</p>
        </div>
        <div className="flex-shrink-0 w-28 text-right">
          <p className={`font-semibold ${data.type === 'owed' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {data.type === 'owed' ? 'Owes' : 'Total Paid'}
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-100">
            ${data.amount.toFixed(2)}
          </p>
        </div>
        <div className="flex-shrink-0 ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    );
  }

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