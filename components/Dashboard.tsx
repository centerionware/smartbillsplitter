import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Bill, Settings, ImportedBill, Participant, SummaryFilter } from '../types';
import type { SubscriptionStatus } from '../hooks/useAuth';
import ShareActionSheet from './ShareActionSheet.tsx';
import { generateShareText, generateAggregateBill, generateOneTimeShareLink } from '../services/shareService.ts';
import { useAppControl } from '../contexts/AppControlContext.tsx';
import HalfScreenAdModal from './HalfScreenAdModal.tsx';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver.ts';
import PaymentMethodsModal from './PaymentMethodsModal.tsx';

// New Child Components
import DashboardSummary from './dashboard/DashboardSummary.tsx';
import DashboardControls from './dashboard/DashboardControls.tsx';
import BillList from './dashboard/BillList.tsx';
import ParticipantList, { ParticipantData } from './dashboard/ParticipantList.tsx';
import ParticipantDetailView from './dashboard/ParticipantDetailView.tsx';
import EmptyState from './dashboard/EmptyState.tsx';


interface DashboardProps {
  bills: Bill[];
  importedBills: ImportedBill[];
  settings: Settings;
  subscriptionStatus: SubscriptionStatus;
  onSelectBill: (bill: Bill) => void;
  onSelectImportedBill: (bill: ImportedBill) => void;
  onArchiveBill: (billId: string) => void;
  onUnarchiveBill: (billId: string) => void;
  onDeleteBill: (billId: string) => void;
  onUpdateMultipleBills: (bills: Bill[]) => void;
  onUpdateImportedBill: (bill: ImportedBill) => void;
  onArchiveImportedBill: (billId: string) => void;
  onUnarchiveImportedBill: (billId: string) => void;
  onDeleteImportedBill: (billId: string) => void;
  onShowSummaryDetails: (bill: ImportedBill) => void;
  // Navigation State & Handlers
  dashboardView: 'bills' | 'participants';
  selectedParticipant: string | null;
  dashboardStatusFilter: 'active' | 'archived';
  dashboardSummaryFilter: SummaryFilter;
  onSetDashboardView: (view: 'bills' | 'participants') => void;
  onSetDashboardStatusFilter: (status: 'active' | 'archived') => void;
  onSetDashboardSummaryFilter: (filter: SummaryFilter) => void;
  onSelectParticipant: (name: string) => void;
  onClearParticipant: () => void;
}

const BILLS_PER_PAGE = 15;

const Dashboard: React.FC<DashboardProps> = ({ 
  bills, importedBills, settings, subscriptionStatus, 
  onSelectBill, onSelectImportedBill, 
  onArchiveBill, onUnarchiveBill, onDeleteBill, onUpdateMultipleBills, 
  onUpdateImportedBill, onArchiveImportedBill, onUnarchiveImportedBill, onDeleteImportedBill,
  onShowSummaryDetails,
  dashboardView, selectedParticipant, dashboardStatusFilter, dashboardSummaryFilter,
  onSetDashboardView, onSetDashboardStatusFilter, onSetDashboardSummaryFilter, onSelectParticipant, onClearParticipant
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'description' | 'participant'>('description');
  const [visibleCount, setVisibleCount] = useState(BILLS_PER_PAGE);
  const [shareSheetParticipant, setShareSheetParticipant] = useState<ParticipantData | null>(null);
  const [archivingBillIds, setArchivingBillIds] = useState<string[]>([]);
  const [isHalfScreenAdOpen, setIsHalfScreenAdOpen] = useState(false);
  const [settleUpBill, setSettleUpBill] = useState<ImportedBill | null>(null);
  const { showNotification } = useAppControl();

  // --- Calculations for Summary & Participant View ---
  const activeBills = useMemo(() => bills.filter(b => b.status === 'active'), [bills]);

  // --- Auto-Archive Logic ---
  useEffect(() => {
    if (dashboardView !== 'bills' || dashboardStatusFilter !== 'active') return;
    const billsToAutoArchive = activeBills.filter(b => b.participants.length > 0 && b.participants.every(p => p.paid));
    if (billsToAutoArchive.length > 0) {
        const idsToArchive = billsToAutoArchive.map(b => b.id);
        setArchivingBillIds(idsToArchive);
        const timer = setTimeout(() => {
            const updatedBills = billsToAutoArchive.map(b => ({ ...b, status: 'archived' as const }));
            onUpdateMultipleBills(updatedBills);
        }, 600);
        return () => clearTimeout(timer);
    } else {
        if (archivingBillIds.length > 0) setArchivingBillIds([]);
    }
  }, [activeBills, onUpdateMultipleBills, dashboardView, dashboardStatusFilter]);

  // --- Half-Screen Ad Logic ---
  useEffect(() => {
    if (subscriptionStatus === 'free' && !sessionStorage.getItem('halfScreenAdShown')) {
        const timer = setTimeout(() => {
            setIsHalfScreenAdOpen(true);
            sessionStorage.setItem('halfScreenAdShown', 'true');
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [subscriptionStatus]);

  const summaryTotals = useMemo(() => {
    const myDisplayNameLower = settings.myDisplayName.trim().toLowerCase();
    let totalTracked = 0, othersOweMe = 0, iOwe = 0;
    activeBills.forEach(bill => {
      totalTracked += bill.totalAmount;
      bill.participants.forEach(p => {
        if (!p.paid) {
          if (p.name.trim().toLowerCase() === myDisplayNameLower) iOwe += p.amountOwed;
          else othersOweMe += p.amountOwed;
        }
      });
    });
    importedBills.forEach(imported => {
        if (imported.status === 'active' && !imported.localStatus.myPortionPaid) {
            const myPart = imported.sharedData.bill.participants.find(p => p.id === imported.myParticipantId);
            if (myPart && !myPart.paid) iOwe += myPart.amountOwed;
        }
    });
    return { totalTracked, othersOweMe, iOwe };
  }, [activeBills, importedBills, settings.myDisplayName]);

  const participantsData = useMemo((): ParticipantData[] => {
    const myDisplayNameLower = settings.myDisplayName.trim().toLowerCase();
    const participantContactInfo = new Map<string, { phone?: string; email?: string }>();
    bills.forEach(bill => {
        bill.participants.forEach(p => {
            if (p.name.trim().toLowerCase() === myDisplayNameLower) return;
            const existing = participantContactInfo.get(p.name) || {};
            if ((p.phone && !existing.phone) || (p.email && !existing.email)) {
                participantContactInfo.set(p.name, { phone: p.phone || existing.phone, email: p.email || existing.email });
            }
        });
    });

    if (dashboardStatusFilter === 'active') {
        const debtMap = new Map<string, number>();
        bills.forEach(bill => {
            bill.participants.forEach(p => {
                if (!p.paid && p.amountOwed > 0.005 && p.name.trim().toLowerCase() !== myDisplayNameLower) {
                    debtMap.set(p.name, (debtMap.get(p.name) || 0) + p.amountOwed);
                }
            });
        });
        return Array.from(debtMap.entries())
            .map(([name, amount]) => ({ name, amount, type: 'owed' as const, ...participantContactInfo.get(name) }))
            .sort((a, b) => b.amount - a.amount);
    } else {
        const participantStats = new Map<string, { outstandingDebt: number; totalBilled: number }>();
        bills.forEach(bill => {
            bill.participants.forEach(p => {
                const stats = participantStats.get(p.name) || { outstandingDebt: 0, totalBilled: 0 };
                stats.totalBilled += p.amountOwed;
                if (!p.paid) stats.outstandingDebt += p.amountOwed;
                participantStats.set(p.name, stats);
            });
        });
        return Array.from(participantStats.entries())
            .filter(([name, stats]) => stats.outstandingDebt < 0.01 && stats.totalBilled > 0 && name.trim().toLowerCase() !== myDisplayNameLower)
            .map(([name, stats]) => ({ name, amount: stats.totalBilled, type: 'paid' as const, ...participantContactInfo.get(name) }))
            .sort((a, b) => b.amount - a.amount);
    }
  }, [bills, dashboardStatusFilter, settings.myDisplayName]);

  const participantBills = useMemo(() => {
    if (!selectedParticipant) return { active: [], allArchived: [], unpaidArchived: [] };
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    const allParticipantBills = bills.filter(b => b.participants.some(p => p.name === selectedParticipant));
    const searchedBills = lowercasedQuery ? allParticipantBills.filter(bill => searchMode === 'description' ? bill.description.toLowerCase().includes(lowercasedQuery) : bill.participants.some(p => p.name.toLowerCase().includes(lowercasedQuery))) : allParticipantBills;
    const active = searchedBills.filter(b => b.status === 'active').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const allArchived = searchedBills.filter(b => b.status === 'archived').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const unpaidArchived = allArchived.filter(b => b.participants.some(p => p.name === selectedParticipant && !p.paid && p.amountOwed > 0.005));
    return { active, allArchived, unpaidArchived };
  }, [bills, selectedParticipant, searchQuery, searchMode]);

  const filteredBills = useMemo(() => {
    if (selectedParticipant || dashboardView === 'participants') return [];
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    const myNameLower = settings.myDisplayName.toLowerCase().trim();
    let billsToFilter = lowercasedQuery ? bills.filter(bill => searchMode === 'description' ? bill.description.toLowerCase().includes(lowercasedQuery) : bill.participants.some(p => p.name.toLowerCase().includes(lowercasedQuery))) : bills;
    let statusFilteredBills = billsToFilter.filter(bill => bill.status === dashboardStatusFilter);
    if (dashboardStatusFilter === 'active') {
        if (dashboardSummaryFilter === 'othersOweMe') {
            statusFilteredBills = statusFilteredBills.filter(bill => !bill.participants.some(p => p.name.toLowerCase().trim() === myNameLower && !p.paid) && bill.participants.some(p => p.name.toLowerCase().trim() !== myNameLower && !p.paid));
        } else if (dashboardSummaryFilter === 'iOwe') {
            statusFilteredBills = statusFilteredBills.filter(bill => bill.participants.some(p => p.name.toLowerCase().trim() === myNameLower && !p.paid));
        }
    }
    return statusFilteredBills;
  }, [bills, searchQuery, searchMode, dashboardStatusFilter, selectedParticipant, dashboardView, dashboardSummaryFilter, settings.myDisplayName]);
  
  const filteredImportedBills = useMemo(() => {
    if (selectedParticipant || dashboardView === 'participants') return [];
    let baseFiltered = importedBills.filter(bill => bill.status === dashboardStatusFilter);
    if (dashboardStatusFilter === 'active') {
        if (dashboardSummaryFilter === 'othersOweMe') return [];
        if (dashboardSummaryFilter === 'iOwe') return baseFiltered.filter(bill => !bill.localStatus.myPortionPaid);
    }
    return baseFiltered;
  }, [importedBills, dashboardStatusFilter, dashboardSummaryFilter, selectedParticipant, dashboardView]);
  
  useEffect(() => {
    setVisibleCount(BILLS_PER_PAGE);
  }, [dashboardStatusFilter, searchQuery, searchMode, dashboardView, selectedParticipant, dashboardSummaryFilter]);
  
  const hasMore = visibleCount < filteredBills.length;
  const loadMore = useCallback(() => {
    if (hasMore) setVisibleCount(prev => prev + BILLS_PER_PAGE);
  }, [hasMore]);
  const { ref: loadMoreRef } = useIntersectionObserver({ onIntersect: loadMore });

  const getShareTextForParticipant = useCallback((participantName: string): string => {
    const participantData = participantsData.find(p => p.name === participantName && p.type === 'owed');
    if (!participantData) return "No outstanding bills found.";
    const billsInfo = activeBills.filter(b => b.participants.some(p => p.name === participantName && !p.paid && p.amountOwed > 0)).map(b => ({ description: b.description, amountOwed: b.participants.find(p => p.name === participantName)!.amountOwed }));
    return generateShareText(participantName, participantData.amount, billsInfo, settings, subscriptionStatus);
  }, [participantsData, activeBills, settings, subscriptionStatus]);

  const handleShareGeneric = async (participant: Participant) => {
    const shareText = getShareTextForParticipant(participant.name);
    try {
      if (navigator.share) await navigator.share({ title: 'Bill Split Reminder', text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        showNotification('Share text copied to clipboard!');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') showNotification('Share cancelled', 'info');
      else {
        console.error("Error sharing or copying:", err);
        showNotification('Failed to share', 'error');
      }
    } finally {
      setShareSheetParticipant(null);
    }
  };
  
  const handleShareSms = (participant: Participant) => {
    if (!participant.phone) return;
    window.location.href = `sms:${participant.phone}?&body=${encodeURIComponent(getShareTextForParticipant(participant.name))}`;
    setShareSheetParticipant(null);
  };
    
  const handleShareEmail = (participant: Participant) => {
    if (!participant.email) return;
    window.location.href = `mailto:${participant.email}?subject=${encodeURIComponent("Shared Bill Reminder")}&body=${encodeURIComponent(getShareTextForParticipant(participant.name))}`;
    setShareSheetParticipant(null);
  };

  const handleShareLink = useCallback(async (participantName: string, method: 'sms' | 'email' | 'generic') => {
    const unpaidBills = bills.filter(b => b.participants.some(p => p.name === participantName && !p.paid && p.amountOwed > 0));
    const summaryBill = generateAggregateBill(participantName, unpaidBills, settings);
    const shareUrl = await generateOneTimeShareLink(summaryBill, settings);
    const message = `Here is a link to view a summary of your outstanding bills with me. This link contains a key and should not be shared with others:\n\n${shareUrl}`;
    try {
        if (method === 'sms') {
            const phone = participantsData.find(p => p.name === participantName)?.phone;
            if (phone) window.location.href = `sms:${phone}?&body=${encodeURIComponent(message)}`;
        } else if (method === 'email') {
            const email = participantsData.find(p => p.name === participantName)?.email;
            if (email) window.location.href = `mailto:${email}?subject=${encodeURIComponent("Summary of Outstanding Bills")}&body=${encodeURIComponent(message)}`;
        } else {
            if (navigator.share) await navigator.share({ title: 'Summary of Outstanding Bills', text: message });
            else {
                await navigator.clipboard.writeText(message);
                showNotification('Share link copied to clipboard!');
            }
        }
    } catch (err: any) {
        if (err.name === 'AbortError') showNotification('Share cancelled', 'info');
        else {
            console.error("Error sharing link:", err);
            showNotification('An error occurred while trying to share the link.', 'error');
        }
    } finally {
        setShareSheetParticipant(null);
    }
  }, [bills, settings, participantsData, showNotification]);

  const handleMarkParticipantAsPaid = async (participantName: string) => {
    const billsToUpdate: Bill[] = bills.filter(bill => bill.status === 'active' && bill.participants.some(p => p.name === participantName && !p.paid)).map(bill => ({ ...bill, participants: bill.participants.map(p => p.name === participantName ? { ...p, paid: true } : p) }));
    if (billsToUpdate.length > 0) await onUpdateMultipleBills(billsToUpdate);
  };

  const getEmptyState = () => {
    if (dashboardView === 'participants') {
      return dashboardStatusFilter === 'active' ? { title: "No outstanding debts", message: "Everyone is all paid up!" } : { title: "No settled participants", message: "Participants who are fully paid up across all bills will appear here." };
    }
    if (dashboardSummaryFilter === 'othersOweMe' && filteredBills.length === 0) {
      return { title: "All Caught Up!", message: "No one currently owes you money on active bills." };
    }
    if (dashboardSummaryFilter === 'iOwe' && filteredBills.length === 0 && filteredImportedBills.length === 0) {
      return { title: "You're All Paid Up!", message: "You don't currently owe money on any active bills." };
    }
    if (searchQuery && filteredBills.length === 0 && filteredImportedBills.length === 0) {
      return { title: "No results found", message: `Your search for "${searchQuery}" did not match any ${dashboardStatusFilter} bills.` };
    }
    if (dashboardStatusFilter === 'active' && bills.every(b => b.status === 'archived') && importedBills.every(b => b.status === 'archived')) {
      return { title: "All bills archived", message: "You can view your archived bills or create a new one." };
    }
    if (dashboardStatusFilter === 'archived') {
      return { title: "No archived bills", message: "Archived bills will appear here." };
    }
    return { title: "No bills found", message: "Get started by creating a new bill." };
  };

  const handleSettleUp = (bill: ImportedBill) => {
    setSettleUpBill(bill);
  };

  const myParticipantForSettleUp = settleUpBill ? settleUpBill.sharedData.bill.participants.find(p => p.id === settleUpBill.myParticipantId) : null;

  const renderContent = () => {
    if (dashboardView === 'participants' && !selectedParticipant) {
        if (participantsData.length > 0) {
            return <ParticipantList participantsData={participantsData} onSetShareSheetParticipant={setShareSheetParticipant} onMarkParticipantAsPaid={handleMarkParticipantAsPaid} />;
        }
    } else if (selectedParticipant) {
        return <ParticipantDetailView participantBills={participantBills} onSelectBill={onSelectBill} onArchiveBill={onArchiveBill} onUnarchiveBill={onUnarchiveBill} onDeleteBill={onDeleteBill} dashboardStatusFilter={dashboardStatusFilter} searchQuery={searchQuery} selectedParticipant={selectedParticipant} />;
    } else {
        if (filteredBills.length > 0 || filteredImportedBills.length > 0) {
            return <BillList filteredBills={filteredBills} filteredImportedBills={filteredImportedBills} visibleCount={visibleCount} subscriptionStatus={subscriptionStatus} archivingBillIds={archivingBillIds} onSelectBill={onSelectBill} onArchiveBill={onArchiveBill} onUnarchiveBill={onUnarchiveBill} onDeleteBill={onDeleteBill} onSelectImportedBill={onSelectImportedBill} onUpdateImportedBill={onUpdateImportedBill} onArchiveImportedBill={onArchiveImportedBill} onUnarchiveImportedBill={onUnarchiveImportedBill} onDeleteImportedBill={onDeleteImportedBill} onShowSummaryDetails={onShowSummaryDetails} onSettleUp={handleSettleUp} loadMoreRef={loadMoreRef} hasMore={hasMore} />;
        }
    }
    
    const { title, message } = getEmptyState();
    return <EmptyState title={title} message={message} />;
  };

  return (
    <div>
      <DashboardSummary summaryTotals={summaryTotals} dashboardStatusFilter={dashboardStatusFilter} dashboardSummaryFilter={dashboardSummaryFilter} onSetDashboardSummaryFilter={onSetDashboardSummaryFilter} />
      <DashboardControls selectedParticipant={selectedParticipant} onClearParticipant={onClearParticipant} dashboardView={dashboardView} onSetDashboardView={onSetDashboardView} dashboardStatusFilter={dashboardStatusFilter} onSetDashboardStatusFilter={onSetDashboardStatusFilter} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchMode={searchMode} setSearchMode={setSearchMode} />
      {renderContent()}
      {shareSheetParticipant && <ShareActionSheet participant={{ ...shareSheetParticipant, id: shareSheetParticipant.name, amountOwed: shareSheetParticipant.amount, paid: false }} onClose={() => setShareSheetParticipant(null)} onShareSms={handleShareSms} onShareEmail={handleShareEmail} onShareGeneric={handleShareGeneric} onShareLinkSms={() => handleShareLink(shareSheetParticipant.name, 'sms')} onShareLinkEmail={() => handleShareLink(shareSheetParticipant.name, 'email')} onShareLinkGeneric={() => handleShareLink(shareSheetParticipant.name, 'generic')} onViewDetails={() => { onSelectParticipant(shareSheetParticipant.name); setShareSheetParticipant(null); }} shareContext="dashboard" />}
      {isHalfScreenAdOpen && <HalfScreenAdModal onClose={() => setIsHalfScreenAdOpen(false)} />}
      {settleUpBill && myParticipantForSettleUp && (
        <PaymentMethodsModal
            paymentDetails={settleUpBill.sharedData.paymentDetails}
            billDescription={settleUpBill.sharedData.bill.description}
            amountOwed={myParticipantForSettleUp.amountOwed}
            creatorName={settleUpBill.creatorName}
            onClose={() => setSettleUpBill(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;