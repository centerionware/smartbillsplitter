import React, { useState, useRef, useEffect } from 'react';
import type { Bill } from '../types';

interface BillCardProps {
  bill: Bill;
  onClick: (e: React.MouseEvent | React.TouchEvent) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onReshare: () => void;
  onConvertToTemplate: () => void;
  onExport: () => void;
}

const LiveIndicator: React.FC<{ status: Bill['shareStatus'], onClick?: (e: React.MouseEvent) => void }> = ({ status, onClick }) => {
    if (!status || !['live', 'expired', 'error'].includes(status)) return null;

    const config = {
        live: { color: 'bg-emerald-500', title: 'Live: This bill is actively shared.' },
        expired: { color: 'bg-red-500', title: 'Expired: Click to reactivate sharing.' },
        error: { color: 'bg-amber-500', title: 'Error: Connection issue with share server.' },
    }[status];
    
    if (!config) return null;

    const indicator = (
        <div className="flex-shrink-0" title={config.title}>
            <span className={`block h-2.5 w-2.5 rounded-full ${config.color}`}></span>
        </div>
    );

    if (status === 'expired' && onClick) {
        return (
            <button onClick={onClick} aria-label={config.title} className="p-1 -ml-1">
                {indicator}
            </button>
        );
    }

    return indicator;
};

const BillCard: React.FC<BillCardProps> = ({ bill, onClick, onArchive, onUnarchive, onDelete, onReshare, onConvertToTemplate, onExport }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const totalOwedToMe = bill.participants
    .filter(p => !p.paid)
    .reduce((sum, p) => sum + p.amountOwed, 0);

  const allPaid = bill.participants.every(p => p.paid);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(prev => !prev);
  };
  
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setIsMenuOpen(false);
  };

  const handleIndicatorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReshare();
  }

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 h-full flex flex-col"
    >
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start gap-2">
            <div className="flex-grow">
                 <div className="flex items-center gap-2">
                    <LiveIndicator status={bill.shareStatus} onClick={handleIndicatorClick} />
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{bill.description}</p>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{new Date(bill.date).toLocaleDateString()}</p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
                {allPaid && (
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Settled
                    </span>
                )}
                <div ref={menuRef} className="relative">
                    <button onClick={handleMenuClick} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} className="p-3 -m-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full" aria-label="More options">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                    </button>
                    {isMenuOpen && (
                        <div 
                            onMouseDown={e => e.stopPropagation()} 
                            onTouchStart={e => e.stopPropagation()} 
                            className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-20"
                        >
                            <button onClick={(e) => handleActionClick(e, onConvertToTemplate)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Convert to Template</button>
                            <button onClick={(e) => handleActionClick(e, onExport)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Export as CSV</button>
                            <div className="my-1 h-px bg-slate-100 dark:bg-slate-700"></div>
                            <button onClick={(e) => handleActionClick(e, bill.status === 'active' ? onArchive : onUnarchive)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{bill.status === 'active' ? 'Archive' : 'Unarchive'}</button>
                            <button onClick={(e) => handleActionClick(e, onDelete)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40">Delete</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <div className="mt-4 flex justify-between items-end">
          <div>
            <p className={`text-sm font-semibold ${totalOwedToMe > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {totalOwedToMe > 0 ? 'Owed to you' : 'No outstanding'}
            </p>
            <p className={`text-3xl font-extrabold ${totalOwedToMe > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
              ${totalOwedToMe.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Bill Total</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">${bill.totalAmount.toFixed(2)}</p>
          </div>
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

export default BillCard;