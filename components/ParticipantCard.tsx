import React from 'react';

interface ParticipantCardProps {
  name: string;
  totalOwed: number;
  onClick: () => void;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({ name, totalOwed, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 h-full flex flex-col p-5"
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-slate-800 bg-teal-500 flex items-center justify-center text-white font-bold text-lg">
                {name.charAt(0).toUpperCase()}
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{name}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </div>

      <div className="mt-4 text-right">
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
          Owes
        </p>
        <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
          ${totalOwed.toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default ParticipantCard;
