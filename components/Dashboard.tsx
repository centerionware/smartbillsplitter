import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Bill, Settings } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import SwipeableBillCard from './SwipeableBillCard.tsx';
import SwipeableParticipantCard from './SwipeableParticipantCard.tsx';
import AdBillCard from './AdBillCard.tsx';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver.ts';

interface DashboardProps {
  bills: Bill[];
  settings: Settings;
  subscriptionStatus: SubscriptionStatus;
  onSelectBill: (bill: Bill) => void;
  onArchiveBill: (billId: string) => void;
  onUnarchiveBill: (billId: string) => void;
  onDeleteBill: (billId: string) => void;
  onUpdateMultipleBills: (bills: Bill[]) => void;
  // Navigation State & Handlers
  dashboardView: 'bills' | 'participants';
  selectedParticipant: string | null;
  dashboardStatusFilter: 'active' | 'archived';
  onSetDashboardView: (view: 'bills' | 'participants') => void;
  onSetDashboardStatusFilter: (status: 'active' | 'archived') => void;
  onSelectParticipant: (name: string) => void;
  onClearParticipant: () => void;
}

const BILLS_PER_PAGE = 15;
const AD_INTERVAL = 9; // Show an ad after every 9 bills

const Dashboard: React.FC<DashboardProps> = ({ 
  bills, settings, subscriptionStatus, 
  onSelectBill, onArchiveBill, onUnarchiveBill, onDeleteBill, onUpdateMultipleBills,
  dashboardView, selectedParticipant, dashboardStatusFilter,
  onSetDashboardView, onSetDashboardStatusFilter, onSelectParticipant, onClearParticipant
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'description' | 'participant'>('description');
  const [visibleCount, setVisibleCount] = useState(BILLS_PER_PAGE);
  const [copiedParticipantName, setCopiedParticipantName] = useState<string | null>(null);
  const [archivingBillIds, setArchivingBillIds] = useState<string[]>([]);

  // --- Calculations for Summary & Participant View ---
  const activeBills = useMemo(() => bills.filter(b => b.status === 'active'), [bills]);

  // --- Auto-Archive Logic ---
  useEffect(() => {
    // Only run this logic when viewing active bills on the main dashboard
    if (dashboardView !== 'bills' || dashboardStatusFilter !== 'active') return;

    const billsToAutoArchive = activeBills.filter(b =>
        b.participants.length > 0 && b.participants.every(p => p.paid)
    );

    if (billsToAutoArchive.length > 0) {
        const idsToArchive = billsToAutoArchive.map(b => b.id);
        setArchivingBillIds(idsToArchive);

        const timer = setTimeout(() => {
            const updatedBills = billsToAutoArchive.map(b => ({ ...b, status: 'archived' as const }));
            onUpdateMultipleBills(updatedBills);
        }, 600); // Animation duration + buffer

        return () => clearTimeout(timer);
    } else {
        // If no bills are pending archive, ensure the animation state is cleared.
        if (archivingBillIds.length > 0) {
            setArchivingBillIds([]);
        }
    }
  }, [activeBills, onUpdateMultipleBills, dashboardView, dashboardStatusFilter]);

  const summaryTotals = useMemo(() => {
    const myDisplayNameLower = settings.myDisplayName.trim().toLowerCase();

    let totalTracked = 0;
    let othersOweMe = 0;
    let iOwe = 0;

    activeBills.forEach(bill => {
      totalTracked += bill.totalAmount;

      bill.participants.forEach(p => {
        if (!p.paid) {
          if (p.name.trim().toLowerCase() === myDisplayNameLower) {
            iOwe += p.amountOwed;
          } else {
            othersOweMe += p.amountOwed;
          }
        }
      });
    });

    return { totalTracked, othersOweMe, iOwe };
  }, [activeBills, settings.myDisplayName]);

  const participantsData = useMemo(() => {
    if (dashboardStatusFilter === 'active') {
        const debtMap = new Map<string, number>();
        // An "active" participant owes money on ANY bill, regardless of bill status.
        bills.forEach(bill => {
            bill.participants.forEach(p => {
                if (!p.paid && p.amountOwed > 0.005) {
                    debtMap.set(p.name, (debtMap.get(p.name) || 0) + p.amountOwed);
                }
            });
        });
        return Array.from(debtMap.entries())
            .map(([name, amount]) => ({ name, amount, type: 'owed' as const }))
            .sort((a, b) => b.amount - a.amount);
    } else { // 'archived'
        // An "archived" participant is someone with no outstanding debt across ALL bills.
        const participantStats = new Map<string, { outstandingDebt: number; totalBilled: number }>();

        bills.forEach(bill => {
            bill.participants.forEach(p => {
                if (!participantStats.has(p.name)) {
                    participantStats.set(p.name, { outstandingDebt: 0, totalBilled: 0 });
                }
                const stats = participantStats.get(p.name)!;
                stats.totalBilled += p.amountOwed;
                if (!p.paid) {
                    stats.outstandingDebt += p.amountOwed;
                }
            });
        });
        
        const paidUpParticipants = [];
        for (const [name, stats] of participantStats.entries()) {
            if (stats.outstandingDebt < 0.01 && stats.totalBilled > 0) {
                paidUpParticipants.push({
                    name,
                    amount: stats.totalBilled,
                    type: 'paid' as const
                });
            }
        }

        paidUpParticipants.sort((a, b) => b.amount - a.amount);
        return paidUpParticipants;
    }
  }, [bills, dashboardStatusFilter]);


  // --- Search and Filter Logic ---
  const participantBills = useMemo(() => {
    if (!selectedParticipant) return { active: [], allArchived: [], unpaidArchived: [] };

    const lowercasedQuery = searchQuery.toLowerCase().trim();

    const allParticipantBills = bills.filter(b => 
        b.participants.some(p => p.name === selectedParticipant)
    );

    const searchedBills = lowercasedQuery ? allParticipantBills.filter(bill => {
        if (searchMode === 'description') {
          return bill.description.toLowerCase().includes(lowercasedQuery);
        }
        return bill.participants.some(p => p.name.toLowerCase().includes(lowercasedQuery));
    }) : allParticipantBills;
    
    const active = searchedBills.filter(b => b.status === 'active');
    const allArchived = searchedBills.filter(b => b.status === 'archived');
    
    const unpaidArchived = allArchived.filter(b => 
        b.participants.some(p => p.name === selectedParticipant && !p.paid && p.amountOwed > 0.005)
    );
    
    active.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    allArchived.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { active, allArchived, unpaidArchived };
  }, [bills, selectedParticipant, searchQuery, searchMode]);

  const filteredBills = useMemo(() => {
    if (selectedParticipant) return []; 

    const lowercasedQuery = searchQuery.toLowerCase().trim();
    let billsToFilter = bills;

    if (lowercasedQuery) {
      billsToFilter = billsToFilter.filter(bill => {
        if (searchMode === 'description') {
          return bill.description.toLowerCase().includes(lowercasedQuery);
        }
        return bill.participants.some(p => p.name.toLowerCase().includes(lowercasedQuery));
      });
    }
    
    return billsToFilter.filter(bill => bill.status === dashboardStatusFilter);
  }, [bills, searchQuery, searchMode, dashboardStatusFilter, selectedParticipant]);
  
  // --- Infinite Scroll Logic ---
  useEffect(() => {
    setVisibleCount(BILLS_PER_PAGE);
  }, [dashboardStatusFilter, searchQuery, searchMode, dashboardView, selectedParticipant]);
  
  const hasMore = visibleCount < filteredBills.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
        setVisibleCount(prev => prev + BILLS_PER_PAGE);
    }
  }, [hasMore]);
  
  const { ref: loadMoreRef } = useIntersectionObserver({ onIntersect: loadMore });

  // --- Action Handlers ---
  const handleShareWithParticipant = async (participantName: string) => {
    const participantData = participantsData.find(p => p.name === participantName && p.type === 'owed');
    if (!participantData) return;

    const participantUnpaidBills = activeBills.filter(b => 
      b.participants.some(p => p.name === participantName && !p.paid && p.amountOwed > 0)
    );

    const billList = participantUnpaidBills.map(b => {
      const pInBill = b.participants.find(p => p.name === participantName);
      return `- "${b.description}": $${(pInBill?.amountOwed || 0).toFixed(2)}`;
    }).join('\n');

    const { paymentDetails } = settings;
    let paymentInfo = '';
    const paymentMethods = [];
    if (paymentDetails.venmo) paymentMethods.push(`Venmo: @${paymentDetails.venmo}`);
    if (paymentDetails.paypal) paymentMethods.push(`PayPal: ${paymentDetails.paypal}`);
    if (paymentDetails.cashApp) paymentMethods.push(`Cash App: $${paymentDetails.cashApp}`);
    if (paymentDetails.zelle) paymentMethods.push(`Zelle: ${paymentDetails.zelle}`);
    
    if (paymentMethods.length > 0) {
      paymentInfo = `\n\nYou can pay me via ${paymentMethods.join(' or ')}.`;
    }
    if (paymentDetails.customMessage) {
      paymentInfo += paymentInfo ? `\n\n${paymentDetails.customMessage}` : `\n\n${paymentDetails.customMessage}`;
    }

    let promoText = '';
    if (subscriptionStatus === 'free') {
      let appUrl = 'https://sharedbills.app';
      try {
        const constructedUrl = new URL('/', window.location.href).href;
        appUrl = constructedUrl.endsWith('/') ? constructedUrl.slice(0, -1) : constructedUrl;
      } catch (e) { console.warn("Could not determine app URL from context."); }
      promoText = `\n\nCreated with SharedBills: ${appUrl}`;
    }
    
    let shareText = settings.shareTemplate
      .replace('{participantName}', participantName)
      .replace('{totalOwed}', `$${participantData.amount.toFixed(2)}`)
      .replace('{billList}', billList)
      .replace('{paymentInfo}', paymentInfo)
      .replace('{promoText}', promoText);
    
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Bill Split Reminder', text: shareText });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setCopiedParticipantName(participantName);
        setTimeout(() => setCopiedParticipantName(null), 2000);
      } else {
        alert("Sharing not supported on this browser. Message copied to clipboard as a fallback.");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Error sharing or copying:", err);
        alert("An error occurred while trying to share. Please try again.");
      }
    }
  };

  const handleMarkParticipantAsPaid = async (participantName: string) => {
    const billsToUpdate: Bill[] = [];
    bills.forEach(bill => {
        if (bill.status === 'active' && bill.participants.some(p => p.name === participantName && !p.paid)) {
            const updatedParticipants = bill.participants.map(p => 
                p.name === participantName ? { ...p, paid: true } : p
            );
            billsToUpdate.push({ ...bill, participants: updatedParticipants });
        }
    });

    if (billsToUpdate.length > 0) {
        await onUpdateMultipleBills(billsToUpdate);
    }
  };


  // --- Ad Injection Logic ---
  const itemsWithAds = useMemo(() => {
    const billsToShow = filteredBills.slice(0, visibleCount);
    const renderedItems: React.ReactElement[] = [];

    billsToShow.forEach((bill, index) => {
      const isArchiving = archivingBillIds.includes(bill.id);
      renderedItems.push(
        <div key={bill.id} className={`transition-all duration-500 ease-out ${isArchiving ? 'opacity-0 scale-90 max-h-0' : 'max-h-96'}`}>
          <SwipeableBillCard
            bill={bill}
            onArchive={() => onArchiveBill(bill.id)}
            onUnarchive={() => onUnarchiveBill(bill.id)}
            onDelete={() => onDeleteBill(bill.id)}
            onClick={() => onSelectBill(bill)}
          />
        </div>
      );

      if ((index + 1) % AD_INTERVAL === 0) {
        renderedItems.push(<AdBillCard key={`ad-${index}`} />);
      }
    });
    return renderedItems;
  }, [filteredBills, visibleCount, onArchiveBill, onUnarchiveBill, onDeleteBill, onSelectBill, archivingBillIds]);

  const getEmptyState = () => {
     if (dashboardView === 'participants') {
        if (dashboardStatusFilter === 'active') {
             return {
                title: "No outstanding debts",
                message: "Everyone is all paid up!",
            };
        } else {
             return {
                title: "No settled participants",
                message: "Participants who are fully paid up across all bills will appear here.",
            };
        }
    }
    if (searchQuery && filteredBills.length === 0) {
        return {
            title: "No results found",
            message: `Your search for "${searchQuery}" did not match any ${dashboardStatusFilter} bills.`,
        };
    }
    if (dashboardStatusFilter === 'active' && bills.every(b => b.status === 'archived')) {
        return {
            title: "All bills archived",
            message: "You can view your archived bills or create a new one.",
        };
    }
    if (dashboardStatusFilter === 'archived') {
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
    if (dashboardView === 'participants' && !selectedParticipant) {
      if (participantsData.length > 0) {
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {participantsData.map(p => (
              <SwipeableParticipantCard
                key={p.name}
                participant={p}
                onClick={() => onSelectParticipant(p.name)}
                onShare={() => handleShareWithParticipant(p.name)}
                onPaidInFull={() => handleMarkParticipantAsPaid(p.name)}
                isCopied={copiedParticipantName === p.name}
              />
            ))}
          </div>
        );
      }
    } else if (selectedParticipant) {
        const { active, allArchived, unpaidArchived } = participantBills;

        if (dashboardStatusFilter === 'active') {
            if (active.length === 0 && unpaidArchived.length === 0) {
                return (
                    <div className="text-center py-16 px-6 bg-white dark:bg-slate-800 rounded-lg shadow">
                        <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                        <h3 className="mt-2 text-xl font-medium text-slate-900 dark:text-slate-100">All Settled</h3>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                            {searchQuery ? `Your search for "${searchQuery}" did not match any bills.` : `${selectedParticipant} has no active bills or unpaid archived bills.`}
                        </p>
                    </div>
                );
            }
            return (
                <div className="space-y-8">
                    {active.length > 0 && (
                        <div>
                            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">Active Bills</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {active.map(bill => (
                                    <SwipeableBillCard key={bill.id} bill={bill} onArchive={() => onArchiveBill(bill.id)} onUnarchive={() => onUnarchiveBill(bill.id)} onDelete={() => onDeleteBill(bill.id)} onClick={() => onSelectBill(bill)} />
                                ))}
                            </div>
                        </div>
                    )}
                    {unpaidArchived.length > 0 && (
                        <div>
                            <h3 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">Unpaid Archived Bills</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {unpaidArchived.map(bill => (
                                    <SwipeableBillCard key={bill.id} bill={bill} onArchive={() => onArchiveBill(bill.id)} onUnarchive={() => onUnarchiveBill(bill.id)} onDelete={() => onDeleteBill(bill.id)} onClick={() => onSelectBill(bill)} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        } else { // dashboardStatusFilter === 'archived'
            if (allArchived.length === 0) {
                 return (
                    <div className="text-center py-16 px-6 bg-white dark:bg-slate-800 rounded-lg shadow">
                        <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        <h3 className="mt-2 text-xl font-medium text-slate-900 dark:text-slate-100">No Archived Bills</h3>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                            {searchQuery ? `Your search for "${searchQuery}" did not match any archived bills.` : `${selectedParticipant} has no archived bills.`}
                        </p>
                    </div>
                );
            }
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allArchived.map(bill => (
                        <SwipeableBillCard key={bill.id} bill={bill} onArchive={() => onArchiveBill(bill.id)} onUnarchive={() => onUnarchiveBill(bill.id)} onDelete={() => onDeleteBill(bill.id)} onClick={() => onSelectBill(bill)} />
                    ))}
                </div>
            );
        }
    } else { // Bill display mode, no participant selected
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
      {/* Summary Cards */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md mb-8">
        <div className="flex flex-col sm:flex-row justify-around items-center text-center">
            <div className="p-2 flex-1">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Tracked</p>
                <p className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">${summaryTotals.totalTracked.toFixed(2)}</p>
            </div>
            <div className="h-12 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-4"></div>
            <div className="p-2 flex-1">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Others Owe Me</p>
                <p className="text-2xl lg:text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">${summaryTotals.othersOweMe.toFixed(2)}</p>
            </div>
            <div className="h-12 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-4"></div>
            <div className="p-2 flex-1">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">I Owe</p>
                <p className="text-2xl lg:text-3xl font-bold text-amber-700 dark:text-amber-300 mt-1">${summaryTotals.iOwe.toFixed(2)}</p>
            </div>
        </div>
      </div>

       <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  {selectedParticipant ? (
                    <div className="flex items-center gap-2">
                      <button onClick={onClearParticipant} className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
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
                            <button onClick={() => onSetDashboardView('bills')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${dashboardView === 'bills' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By Bill</button>
                            <button onClick={() => onSetDashboardView('participants')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${dashboardView === 'participants' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By Participant</button>
                            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                        </>
                    )}
                    <button onClick={() => onSetDashboardStatusFilter('active')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${dashboardStatusFilter === 'active' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Active</button>
                    <button onClick={() => onSetDashboardStatusFilter('archived')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${dashboardStatusFilter === 'archived' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Archived</button>
                </div>
            </div>

            {(dashboardView === 'bills' || selectedParticipant) && (
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={searchMode === 'description' ? "Search by bill description..." : "Search by participant name..."} className="w-full pl-11 pr-24 py-3 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" aria-label="Search bills"/>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 bg-slate-200 dark:bg-slate-600 p-1 rounded-md">
                        <button onClick={() => setSearchMode('description')} className={`p-1.5 rounded ${searchMode === 'description' ? 'bg-white dark:bg-slate-800 text-teal-600 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-500/50'}`} aria-label="Search by bill description" title="Search by bill description">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        </button>
                        <button onClick={() => setSearchMode('participant')} className={`p-1.5 rounded ${searchMode === 'participant' ? 'bg-white dark:bg-slate-800 text-teal-600 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-500/50'}`} aria-label="Search by participant name" title="Search by participant name">
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
