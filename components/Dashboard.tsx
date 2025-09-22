import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Bill } from '../types.ts';
import SwipeableBillCard from './SwipeableBillCard.tsx';
import ParticipantCard from './ParticipantCard.tsx';
import AdBillCard from './AdBillCard.tsx';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver.ts';

interface DashboardProps {
  bills: Bill[];
  onSelectBill: (bill: Bill) => void;
  onArchiveBill: (billId: string) => void;
  onUnarchiveBill: (billId: string) => void;
  onDeleteBill: (billId: string) => void;
}

const BILLS_PER_PAGE = 15;
const AD_INTERVAL = 9; // Show an ad after every 9 bills

const Dashboard: React.FC<DashboardProps> = ({ bills, onSelectBill, onArchiveBill, onUnarchiveBill, onDeleteBill }) => {
  const [billStatusFilter, setBillStatusFilter] = useState<'active' | 'archived'>('active');
  const [displayMode, setDisplayMode] = useState<'bills' | 'participants'>('bills');
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'description' | 'participant'>('description');
  const [visibleCount, setVisibleCount] = useState(BILLS_PER_PAGE);

  // --- Calculations for Summary & Participant View ---
  const activeBills = useMemo(() => bills.filter(b => b.status === 'active'), [bills]);

  const totalOwed = useMemo(() => {
    return activeBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
  }, [activeBills]);

  const totalRemaining = useMemo(() => {
    const totalPaid = activeBills.reduce((sum, bill) => {
      const paidAmount = bill.participants
        .filter(p => p.paid)
        .reduce((participantSum, p) => participantSum + p.amountOwed, 0);
      return sum + paidAmount;
    }, 0);
    return totalOwed - totalPaid;
  }, [activeBills, totalOwed]);

  const participantsWithDebt = useMemo(() => {
    const debtMap = new Map<string, number>();
    activeBills.forEach(bill => {
      bill.participants.forEach(p => {
        if (!p.paid && p.amountOwed > 0.005) { // Use a small threshold
          debtMap.set(p.name, (debtMap.get(p.name) || 0) + p.amountOwed);
        }
      });
    });
    return Array.from(debtMap.entries())
      .map(([name, totalOwed]) => ({ name, totalOwed }))
      .sort((a, b) => b.totalOwed - a.totalOwed);
  }, [activeBills]);


  // --- Search and Filter Logic ---
  const filteredBills = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    let billsToFilter = bills;

    if (selectedParticipant) {
      billsToFilter = bills.filter(b => b.participants.some(p => p.name === selectedParticipant));
    }

    if (lowercasedQuery) {
      billsToFilter = billsToFilter.filter(bill => {
        if (searchMode === 'description') {
          return bill.description.toLowerCase().includes(lowercasedQuery);
        }
        return bill.participants.some(p => p.name.toLowerCase().includes(lowercasedQuery));
      });
    }
    
    return billsToFilter.filter(bill => bill.status === billStatusFilter);
  }, [bills, searchQuery, searchMode, billStatusFilter, selectedParticipant]);
  
  // --- Infinite Scroll Logic ---
  useEffect(() => {
    setVisibleCount(BILLS_PER_PAGE);
  }, [billStatusFilter, searchQuery, searchMode, displayMode, selectedParticipant]);
  
  const hasMore = visibleCount < filteredBills.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
        setVisibleCount(prev => prev + BILLS_PER_PAGE);
    }
  }, [hasMore]);
  
  const { ref: loadMoreRef } = useIntersectionObserver({ onIntersect: loadMore });

  // --- Ad Injection Logic ---
  const itemsWithAds = useMemo(() => {
    const billsToShow = filteredBills.slice(0, visibleCount);
    const renderedItems: React.ReactElement[] = [];

    billsToShow.forEach((bill, index) => {
      renderedItems.push(
        <SwipeableBillCard
          key={bill.id}
          bill={bill}
          onArchive={() => onArchiveBill(bill.id)}
          onUnarchive={() => onUnarchiveBill(bill.id)}
          onDelete={() => onDeleteBill(bill.id)}
          onClick={() => onSelectBill(bill)}
        />
      );

      if ((index + 1) % AD_INTERVAL === 0) {
        renderedItems.push(<AdBillCard key={`ad-${index}`} />);
      }
    });
    return renderedItems;
  }, [filteredBills, visibleCount, onArchiveBill, onUnarchiveBill, onDeleteBill, onSelectBill]);

  const getEmptyState = () => {
    if (selectedParticipant) {
        return {
            title: `No ${billStatusFilter} bills found for ${selectedParticipant}`,
            message: "This person has settled all their bills in this category.",
        };
    }
     if (displayMode === 'participants') {
        return {
            title: "No outstanding debts",
            message: "Everyone is all paid up!",
        };
    }
    if (searchQuery && filteredBills.length === 0) {
        return {
            title: "No results found",
            message: `Your search for "${searchQuery}" did not match any ${billStatusFilter} bills.`,
        };
    }
    if (billStatusFilter === 'active' && bills.every(b => b.status === 'archived')) {
        return {
            title: "All bills archived",
            message: "You can view your archived bills or create a new one.",
        };
    }
    if (billStatusFilter === 'archived') {
        return {
            title: "No archived bills",
            message: "Archived bills will appear here.",
        };
    }
    return {
        title: "No bills found",
        message: "Get started by creating a new bill.",
    };
  }
  
  const renderContent = () => {
    if (displayMode === 'participants' && !selectedParticipant) {
      if (participantsWithDebt.length > 0) {
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {participantsWithDebt.map(p => (
              <ParticipantCard
                key={p.name}
                name={p.name}
                totalOwed={p.totalOwed}
                onClick={() => setSelectedParticipant(p.name)}
              />
            ))}
          </div>
        );
      }
    } else { // Bill display mode or a participant is selected
        if (filteredBills.length > 0) {
            return (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {itemsWithAds}
                    </div>
                    {hasMore && (
                        <div ref={loadMoreRef} className="flex justify-center items-center p-8">
                            <svg className="animate-spin h-8 w-8 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}
                </>
            );
        }
    }
    
    // Fallback to empty state
    const { title, message } = getEmptyState();
    return (
      <div className="text-center py-16 px-6 bg-white dark:bg-slate-800 rounded-lg shadow">
        <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <h3 className="mt-2 text-xl font-medium text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{message}</p>
      </div>
    );
  };

  return (
    <div>
       {/* Summary Line */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md mb-8">
        <div className="flex flex-col sm:flex-row justify-center items-center sm:gap-4 text-center">
            <p className="text-lg text-slate-700 dark:text-slate-300">
                <span className="font-semibold">Total Owed:</span>
                <span className="text-slate-900 dark:text-slate-100 font-bold ml-2">${totalOwed.toFixed(2)}</span>
            </p>
            <div className="hidden sm:block h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
            <p className="text-lg text-amber-600 dark:text-amber-400">
                <span className="font-semibold">Total Unpaid:</span>
                <span className="font-bold ml-2">${totalRemaining.toFixed(2)}</span>
            </p>
        </div>
      </div>

       <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  {selectedParticipant ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedParticipant(null)} className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                         </svg>
                      </button>
                      <h2 className="text-2xl sm:text-3xl font-bold text-slate-700 dark:text-slate-200">
                        Bills for <span className="text-teal-600 dark:text-teal-400">{selectedParticipant}</span>
                      </h2>
                    </div>
                  ) : (
                    <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200">My Bills</h2>
                  )}
                </div>
                <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg self-start sm:self-center">
                    {!selectedParticipant && (
                        <>
                            <button onClick={() => setDisplayMode('bills')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${displayMode === 'bills' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By Bill</button>
                            <button onClick={() => setDisplayMode('participants')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${displayMode === 'participants' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By Participant</button>
                            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                        </>
                    )}
                    <button onClick={() => setBillStatusFilter('active')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${billStatusFilter === 'active' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Active</button>
                    <button onClick={() => setBillStatusFilter('archived')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${billStatusFilter === 'archived' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Archived</button>
                </div>
            </div>

            {(displayMode === 'bills' || selectedParticipant) && (
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={searchMode === 'description' ? "Search by bill description..." : "Search by participant name..."} className="w-full pl-11 pr-24 py-3 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" aria-label="Search bills"/>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 bg-slate-200 dark:bg-slate-600 p-1 rounded-md">
                        <button onClick={() => setSearchMode('description')} className={`p-1.5 rounded ${searchMode === 'description' ? 'bg-white dark:bg-slate-800 text-teal-600 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-500/50'}`} aria-label="Search by bill description" title="Search by bill description">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </button>
                        <button onClick={() => setSearchMode('participant')} className={`p-1.5 rounded ${searchMode === 'participant' ? 'bg-white dark:bg-slate-800 text-teal-600 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-500/50'}`} aria-label="Search by participant" title="Search by participant">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>

      {renderContent()}

    </div>
  );
};

export default Dashboard;
