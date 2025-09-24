import React from 'react';

interface ParticipantCardProps {
  data: { name: string; amount: number; type: 'owed' | 'paid' };
  onClick: () => void;
  onShare: () => void;
  isCopied: boolean;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({ data, onClick, onShare, isCopied }) => {
  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the click from bubbling up to the parent div's onClick
    onShare();
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 h-full flex flex-col p-5"
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-slate-800 bg-teal-500 flex items-center justify-center text-white font-bold text-lg">
                {data.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{data.name}</p>
        </div>
        <div className="flex items-center gap-2">
           {data.type === 'owed' && (
            <button
                onClick={handleShareClick}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title={isCopied ? "Copied!" : "Share reminder with participant"}
                className="p-2 rounded-full font-semibold text-sm transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                aria-label={`Share reminder with ${data.name}`}
            >
                {isCopied ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                    </svg>
                )}
            </button>
           )}
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