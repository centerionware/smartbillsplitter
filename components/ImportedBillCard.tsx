import React, { useState, useRef, useEffect } from 'react';
import type { ImportedBill, DashboardLayoutMode } from '../types';

interface ImportedBillCardProps {
  bill: ImportedBill;
  onClick: (e: React.MouseEvent) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onSettleUp: () => void;
  onShowSummaryDetails: () => void;
  onExport: () => void;
  layoutMode: DashboardLayoutMode;
}

const LiveIndicator: React.FC<{ status: ImportedBill['liveStatus'] }> = ({ status }) => {
    if (!status || status === 'error') {
        return null;
    }

    const config = {
        live: { color: 'bg-emerald-500', title: 'Live: Connected and up-to-date' },
        stale: { color: 'bg-amber-500', title: 'Stale: Connection issue, may be out of date' },
    }[status];

    if (!config) return null;

    return (
        <div className="flex-shrink-0" title={config.title}>
            <span className={`block h-2.5 w-2.5 rounded-full ${config.color}`}></span>
        </div>
    );
};

const ImportedBillCard: React.FC<ImportedBillCardProps> = ({ bill, onClick, onArchive, onUnarchive, onDelete, onSettleUp, onShowSummaryDetails, onExport, layoutMode }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const myParticipant = bill.sharedData.bill.participants.find(p => p.id === bill.myParticipantId);
  const amountOwed = myParticipant?.amountOwed || 0;
  const isPaid = bill.localStatus.myPortionPaid;
  const isSummary = bill.id.startsWith('summary-');

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

  const renderMenu = () => (
    <div ref={menuRef} className="relative flex-shrink-0">
        <button onClick={handleMenuClick} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} className="p-3 -m-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full" aria-label="More options">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
        </button>
        {isMenuOpen && (
            <div 
                onClick={e => e.stopPropagation()}
                className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-20"
            >
                {isSummary && <button onClick={(e) => handleActionClick(e, onShowSummaryDetails)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">View Breakdown</button>}
                <button onClick={(e) => handleActionClick(e, onExport)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Export as CSV</button>
                <div className="my-1 h-px bg-slate-100 dark:bg-slate-700"></div>
                <button onClick={(e) => handleActionClick(e, bill.status === 'active' ? onArchive : onUnarchive)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{bill.status === 'active' ? 'Archive' : 'Unarchive'}</button>
                <button onClick={(e) => handleActionClick(e, onDelete)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40">Delete</button>
            </div>
        )}
    </div>
  );
  
  if (layoutMode === 'list') {
    return (
        <div
            onClick={onClick}
            className="w-full flex items-center p-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
        >
            <div className="flex-grow flex items-center gap-3 overflow-hidden">
                <LiveIndicator status={bill.liveStatus} />
                <div className="flex-grow overflow-hidden">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{bill.sharedData.bill.description}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">From {bill.creatorName}</p>
                </div>
            </div>
             <div className="flex-shrink-0 w-24 text-right">
                <p className="font-semibold text-slate-500 dark:text-slate-400">Your Portion</p>
                <p className={`font-bold ${isPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
                    ${amountOwed.toFixed(2)}
                </p>
            </div>
            <div className="flex-shrink-0 w-24 text-right">
                <p className="font-semibold text-slate-500 dark:text-slate-400">Total</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">${bill.sharedData.bill.totalAmount.toFixed(2)}</p>
            </div>
            {renderMenu()}
        </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 flex flex-col"
    >
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start gap-2">
            <div className="flex-grow flex items-center gap-2">
                <LiveIndicator status={bill.liveStatus} />
                {bill.isOwnBill && (
                  <span title="This is one of your own bills that you imported." className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded-full">
                      You
                  </span>
                )}
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{bill.sharedData.bill.description}</p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
                 <span className={`px-3 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                    {isPaid ? 'Paid' : 'Unpaid'}
                 </span>
                 {renderMenu()}
            </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">From {bill.creatorName}</p>
        <div className="mt-4 flex justify-between items-end">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Your Portion</p>
            <p className={`text-3xl font-extrabold ${isPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
              ${amountOwed.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Bill Total</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">${bill.sharedData.bill.totalAmount.toFixed(2)}</p>
          </div>
        </div>
      </div>
       <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3 flex items-center justify-end gap-3">
        {isSummary ? (
            <button onClick={(e) => {e.stopPropagation(); onShowSummaryDetails();}} className="px-4 py-1.5 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500">
                View Breakdown
            </button>
        ) : (
            <button onClick={(e) => {e.stopPropagation(); onClick(e);}} className="px-4 py-1.5 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500">
                Details
            </button>
        )}
        {!isPaid && (
            <button onClick={(e) => {e.stopPropagation(); onSettleUp();}} className="px-4 py-1.5 text-xs font-semibold rounded-full bg-emerald-500 text-white hover:bg-emerald-600">
                Settle Up
            </button>
        )}
      </div>
    </div>
  );
};

export default ImportedBillCard;