import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View } from '../../types';
// FIX: Added DashboardLayoutMode to type imports.
import type { Bill, Settings, ImportedBill, Participant, SummaryFilter, RecurringBill, DashboardView, SettingsSection, Group, DashboardLayoutMode } from '../../types';
import type { SubscriptionStatus } from '../../hooks/useAuth';
import type { ParticipantData } from './ParticipantList';
import ShareActionSheet from '../ShareActionSheet';
import { generateShareText, generateOneTimeShareLink } from '../../services/shareService';
import { useAppControl } from '../../contexts/AppControlContext';
import HalfScreenAdModal from '../HalfScreenAdModal';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import PaymentMethodsModal from '../PaymentMethodsModal';
import PaymentMethodWarningModal from '../PaymentMethodWarningModal';
import { exportData } from '../../services/exportService';

// New Child Components
import DashboardSummary from './DashboardSummary';
import DashboardControls from './DashboardControls';
import BillList from './BillList';
import ParticipantList from './ParticipantList';
import ParticipantDetailView from './ParticipantDetailView';
import EmptyState from './EmptyState';
import RecurringBillCard from '../RecurringBillCard';
import SwipeableGroupCard from './SwipeableGroupCard';
import BudgetView, { BudgetData } from './BudgetView';

// Import the ad error message
import { AD_ERROR_MESSAGE } from '../../services/adService';


interface DashboardProps {
  bills: Bill[];
  importedBills: ImportedBill[];
  recurringBills: RecurringBill[];
  groups: Group[];
  participantsData: ParticipantData[];
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  setSettingsSection: (section: SettingsSection) => void;
  subscriptionStatus: SubscriptionStatus;
  onSelectBill: (bill: Bill) => void;
  onSelectImportedBill: (bill: ImportedBill) => void;
  onArchiveBill: (billId: string) => void;
  onUnarchiveBill: (billId: string) => void;
  onDeleteBill: (billId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onReshareBill: (billId: string) => void;
  onUpdateMultipleBills: (bills: Bill[]) => Promise<void>;
  onUpdateImportedBill: (bill: ImportedBill) => void;
  onArchiveImportedBill: (billId: string) => void;
  onUnarchiveImportedBill: (billId: string) => void;
  onDeleteImportedBill: (billId: string) => void;
  onShowSummaryDetails: (bill: ImportedBill) => void;
  onCreateFromTemplate: (template: RecurringBill) => void;
  navigate: (view: View, params?: any) => void;
  // Navigation State & Handlers
  dashboardView: DashboardView;
  selectedParticipant: string | null;
  dashboardStatusFilter: 'active' | 'archived';
  dashboardSummaryFilter: SummaryFilter;
  // FIX: Added missing props for layout mode.
  dashboardLayoutMode: DashboardLayoutMode;
  onSetDashboardLayoutMode: (mode: DashboardLayoutMode) => void;
  onSetDashboardView: (view: DashboardView) => void;
  onSetDashboardStatusFilter: (status: 'active' | 'archived') => void;
  onSetDashboardSummaryFilter: (filter: SummaryFilter) => void;
  onSelectParticipant: (name: string | null) => void;
  onClearParticipant: () => void;
  // Budget props
  budgetData: BudgetData;
  budgetDate: { year: number; month: number } | 'last30days';
  setBudgetDate: (date: { year: number; month: number } | 'last30days') => void;
  handleSelectBillFromBudget: (billInfo: { billId: string; isImported: boolean }) => void;
}

const BILLS_PER_PAGE = 15;

const Dashboard: React.FC<DashboardProps> = (props) => {
  const { 
    bills, importedBills, recurringBills, groups, participantsData, settings, updateSettings, setSettingsSection, subscriptionStatus, 
    onSelectBill, onSelectImportedBill, 
    onArchiveBill, onUnarchiveBill, onDeleteBill, onDeleteGroup, onReshareBill, onUpdateMultipleBills, 
    onUpdateImportedBill, onArchiveImportedBill, onUnarchiveImportedBill, onDeleteImportedBill,
    onShowSummaryDetails, onCreateFromTemplate,
    navigate,
    // FIX: Destructured missing props.
    dashboardView, selectedParticipant, dashboardStatusFilter, dashboardSummaryFilter, dashboardLayoutMode,
    onSetDashboardView, onSetDashboardStatusFilter, onSetDashboardSummaryFilter, onSelectParticipant, onClearParticipant, onSetDashboardLayoutMode,
    budgetData, budgetDate, setBudgetDate, handleSelectBillFromBudget
  } = props;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'description' | 'participant'>('description');
  const [visibleCount, setVisibleCount] = useState(BILLS_PER_PAGE);
  const [shareSheetParticipant, setShareSheetParticipant] = useState<ParticipantData | null>(null);
  const [archivingBillIds, setArchivingBillIds] = useState<string[]>([]);
  const [isHalfScreenAdOpen, setIsHalfScreenAdOpen] = useState(false);
  const [settleUpBill, setSettleUpBill] = useState<ImportedBill | null>(null);
  const [isPaymentWarningOpen, setIsPaymentWarningOpen] = useState(false);
  const [deferredShareAction, setDeferredShareAction] = useState<(() => void) | null>(null);
  const { showNotification } = useAppControl();

  const hasRecurringBills = recurringBills.length > 0;

  useEffect(() => {
    if (!hasRecurringBills && (dashboardView === 'upcoming' || dashboardView === 'templates')) {
        onSetDashboardView('bills');
    }
  }, [hasRecurringBills, dashboardView, onSetDashboardView]);


  useEffect(() => {
    if (['upcoming', 'templates', 'groups', 'budget'].includes(dashboardView)) {
        setSearchMode('description');
    }
  }, [dashboardView]);

  const activeBills = useMemo(() => bills.filter(b => b.status === 'active'), [bills]);

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

  useEffect(() => {
    if (subscriptionStatus === 'free') {
      const key = 'dashboardViewCount';
      const count = parseInt(sessionStorage.getItem(key) || '0', 10);
      const newCount = count + 1;
      sessionStorage.setItem(key, String(newCount));

      if (newCount > 0 && newCount % 4 === 0) {
        const timer = setTimeout(() => {
          setIsHalfScreenAdOpen(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [subscriptionStatus]);

  useEffect(() => {
    if (subscriptionStatus === 'free' && AD_ERROR_MESSAGE) {
      if (!sessionStorage.getItem('adConfigErrorShown')) {
        showNotification(AD_ERROR_MESSAGE, 'error');
        sessionStorage.setItem('adConfigErrorShown', 'true');
      }
    }
  }, [subscriptionStatus, showNotification]);

  const summaryTotals = useMemo(() => {
    const myDisplayNameLower = settings.myDisplayName.trim().toLowerCase();
    let totalTracked = 0, othersOweMe = 0, iOwe = 0;
    activeBills.forEach(bill => {
      totalTracked += bill.totalAmount;
      bill.participants.forEach((p: Participant) => {
        if (!p.paid) {
          if (p.name.trim().toLowerCase() === myDisplayNameLower) iOwe += p.amountOwed;
          else othersOweMe += p.amountOwed;
        }
      });
    });
    importedBills.forEach(imported => {
        if (imported.status === 'active' && !imported.localStatus.myPortionPaid) {
            const myPart = imported.sharedData.bill.participants.find((p: Participant) => p.id === imported.myParticipantId);
            if (myPart && !myPart.paid) iOwe += myPart.amountOwed;
        }
    });
    return { totalTracked, othersOweMe, iOwe };
  }, [activeBills, importedBills, settings.myDisplayName]);

  const participantBills = useMemo(() => {
    if (!selectedParticipant) return { active: [], allArchived: [], unpaidArchived: [] };
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    const allParticipantBills = bills.filter(b => b.participants.some((p: Participant) => p.name === selectedParticipant));
    const searchedBills = lowercasedQuery ? allParticipantBills.filter(bill => searchMode === 'description' ? bill.description.toLowerCase().includes(lowercasedQuery) : bill.participants.some((p: Participant) => p.name.toLowerCase().includes(lowercasedQuery))) : allParticipantBills;
    const active = searchedBills.filter(b => b.status === 'active').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const allArchived = searchedBills.filter(b => b.status === 'archived').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const unpaidArchived = allArchived.filter(b => b.participants.some((p: Participant) => p.name === selectedParticipant && !p.paid && p.amountOwed > 0.005));
    return { active, allArchived, unpaidArchived };
  }, [bills, selectedParticipant, searchQuery, searchMode]);

  const filteredBills = useMemo(() => {
    if (selectedParticipant || dashboardView !== 'bills') return [];
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    const myNameLower = settings.myDisplayName.toLowerCase().trim();
    let billsToFilter = lowercasedQuery ? bills.filter(bill => searchMode === 'description' ? bill.description.toLowerCase().includes(lowercasedQuery) : bill.participants.some((p: Participant) => p.name.toLowerCase().includes(lowercasedQuery))) : bills;
    let statusFilteredBills = billsToFilter.filter(bill => bill.status === dashboardStatusFilter);
    if (dashboardStatusFilter === 'active') {
        if (dashboardSummaryFilter === 'othersOweMe') {
            statusFilteredBills = statusFilteredBills.filter(bill => !bill.participants.some((p: Participant) => p.name.toLowerCase().trim() === myNameLower && !p.paid) && bill.participants.some((p: Participant) => p.name.toLowerCase().trim() !== myNameLower && !p.paid));
        } else if (dashboardSummaryFilter === 'iOwe') {
            statusFilteredBills = statusFilteredBills.filter(bill => bill.participants.some((p: Participant) => p.name.toLowerCase().trim() === myNameLower && !p.paid));
        }
    }
    return statusFilteredBills;
  }, [bills, searchQuery, searchMode, dashboardStatusFilter, selectedParticipant, dashboardView, dashboardSummaryFilter, settings.myDisplayName]);
  
  const filteredImportedBills = useMemo(() => {
    if (selectedParticipant || dashboardView !== 'bills') return [];
    let baseFiltered = importedBills.filter(bill => bill.status === dashboardStatusFilter);
    if (dashboardStatusFilter === 'active') {
        if (dashboardSummaryFilter === 'othersOweMe') return [];
        if (dashboardSummaryFilter === 'iOwe') return baseFiltered.filter(bill => !bill.localStatus.myPortionPaid);
    }
    return baseFiltered;
  }, [importedBills, dashboardStatusFilter, dashboardSummaryFilter, selectedParticipant, dashboardView]);
  
  const upcomingRecurringBills = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const filtered = recurringBills.filter(bill => {
        if (bill.status !== 'active') return false;
        
        const dueDate = new Date(bill.nextDueDate);
        if (dueDate > thirtyDaysFromNow) return false;

        if (lowercasedQuery && !bill.description.toLowerCase().includes(lowercasedQuery)) {
            return false;
        }
        return true;
    });

    return filtered.sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  }, [recurringBills, searchQuery]);

  const allRecurringBills = useMemo(() => {
      const lowercasedQuery = searchQuery.toLowerCase().trim();
      
      const filtered = recurringBills.filter(bill => {
          if (bill.status !== 'active') return false;

          if (lowercasedQuery && !bill.description.toLowerCase().includes(lowercasedQuery)) {
              return false;
          }
          return true;
      });

      return filtered.sort((a, b) => a.description.localeCompare(b.description));
  }, [recurringBills, searchQuery]);

  const filteredGroups = useMemo(() => {
      const lowercasedQuery = searchQuery.toLowerCase().trim();
      if (!lowercasedQuery) return groups;
      return groups.filter(group => group.name.toLowerCase().includes(lowercasedQuery));
  }, [groups, searchQuery]);

  useEffect(() => {
    setVisibleCount(BILLS_PER_PAGE);
  }, [dashboardStatusFilter, searchQuery, searchMode, dashboardView, selectedParticipant, dashboardSummaryFilter]);
  
  const hasMore = useMemo(() => {
      if (dashboardView === 'upcoming') return visibleCount < upcomingRecurringBills.length;
      if (dashboardView === 'templates') return visibleCount < allRecurringBills.length;
      if (dashboardView === 'groups') return false; // No pagination for groups for now
      return visibleCount < filteredBills.length;
  }, [dashboardView, visibleCount, upcomingRecurringBills.length, allRecurringBills.length, filteredBills.length]);
  
  const loadMore = useCallback(() => {
    if (hasMore) setVisibleCount(prev => prev + BILLS_PER_PAGE);
  }, [hasMore]);
  
  const { ref: loadMoreRef } = useIntersectionObserver<HTMLDivElement>({ onIntersect: loadMore });

  const getShareTextForParticipant = useCallback((participantName: string): string => {
    const participantData = participantsData.find(p => p.name === participantName && p.type === 'owed');
    if (!participantData) return "No outstanding bills found.";
    const billsInfo = activeBills.filter(b => b.participants.some((p: Participant) => p.name === participantName && !p.paid && p.amountOwed > 0)).map(b => ({ description: b.description, amountOwed: b.participants.find((p: Participant) => p.name === participantName)!.amountOwed }));
    return generateShareText(participantName, participantData.amount, billsInfo, settings, subscriptionStatus);
  }, [participantsData, activeBills, settings, subscriptionStatus]);

  const handleShareGeneric = async (participant: ParticipantData) => {
    const shareText = getShareTextForParticipant(participant.name);
    try {
      if (navigator.share) await navigator.share({ title: 'Bill Split Reminder', text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        showNotification('Share text copied to clipboard!');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Error sharing or copying:", err);
        showNotification('Failed to share', 'error');
      }
    } finally {
      setShareSheetParticipant(null);
    }
  };
  
  const handleShareSms = (participant: ParticipantData) => {
    if (!participant.phone) return;
    window.location.href = `sms:${participant.phone}?&body=${encodeURIComponent(getShareTextForParticipant(participant.name))}`;
    setShareSheetParticipant(null);
  };
    
  const handleShareEmail = (participant: ParticipantData) => {
    if (!participant.email) return;
    window.location.href = `mailto:${participant.email}?subject=${encodeURIComponent("Shared Bill Reminder")}&body=${encodeURIComponent(getShareTextForParticipant(participant.name))}`;
    setShareSheetParticipant(null);
  };

  const handleShareLink = useCallback(async (participantName: string, method: 'sms' | 'email' | 'generic') => {
    const unpaidBills = bills.filter(b => b.status === 'active' && b.participants.some((p: Participant) => p.name === participantName && !p.paid && p.amountOwed > 0));
    if (unpaidBills.length === 0) {
        showNotification(`${participantName} has no outstanding bills to share.`, 'info');
        setShareSheetParticipant(null);
        return;
    }
    const { shareUrl, imagesDropped } = await generateOneTimeShareLink(unpaidBills, participantName, settings, onUpdateMultipleBills, bills, subscriptionStatus);
    
    if (imagesDropped > 0) {
        showNotification(`Free image limit reached. ${imagesDropped} older image(s) omitted from summary.`, 'info');
    }

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
  }, [bills, settings, onUpdateMultipleBills, participantsData, showNotification, subscriptionStatus]);

  const handleMarkParticipantAsPaid = async (participantName: string) => {
    const billsToUpdate: Bill[] = bills.filter(bill => bill.status === 'active' && bill.participants.some((p: Participant) => p.name === participantName && !p.paid)).map(bill => ({ ...bill, participants: bill.participants.map((p: Participant) => p.name === participantName ? { ...p, paid: true } : p) }));
    if (billsToUpdate.length > 0) await onUpdateMultipleBills(billsToUpdate);
  };
  
  const handleExportParticipant = async (participantName: string) => {
    const billsForParticipant = bills.filter(b => b.participants.some((p: Participant) => p.name === participantName));
    if (billsForParticipant.length === 0) {
      showNotification(`No bills found for ${participantName}.`, 'info');
      return;
    }
    const filename = `bills_for_${participantName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
    await exportData({ owned: billsForParticipant }, filename);
    showNotification(`Bills for ${participantName} exported.`);
  };

  const getEmptyState = () => {
    if (dashboardView === 'participants') {
      return dashboardStatusFilter === 'active' ? { title: "No outstanding debts", message: "Everyone is all paid up!" } : { title: "No settled participants", message: "Participants who are fully paid up across all bills will appear here." };
    }
    if (dashboardView === 'upcoming') {
        return { title: "No upcoming bills", message: "Recurring bills due in the next 30 days will appear here." };
    }
    if (dashboardView === 'templates') {
        return { title: "No recurring bills", message: "Create a recurring bill template to get started." };
    }
     if (dashboardView === 'groups') {
        return { title: "No groups yet", message: "Create a group to quickly add a set of friends to a new bill." };
    }
    if (dashboardView === 'budget') {
        return { title: "No Budget Data", message: "Create bills with categories to see your budget breakdown." };
    }
    if (dashboardSummaryFilter === 'othersOweMe' && filteredBills.length === 0) {
      return { title: "All Caught Up!", message: "No one currently owes you money on active bills." };
    }
    if (dashboardSummaryFilter === 'iOwe' && filteredBills.length === 0 && filteredImportedBills.length === 0) {
      return { title: "You're All Paid Up!", message: "You don't currently owe money on any active bills." };
    }
    if (searchQuery) {
        return { title: "No results found", message: `Your search for "${searchQuery}" did not match any items.` };
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

  const handleSelectParticipantForShare = (participant: ParticipantData) => {
      const { paymentDetails, hidePaymentMethodWarning } = settings;
      const hasPaymentMethods = paymentDetails.venmo || paymentDetails.paypal || paymentDetails.cashApp || paymentDetails.zelle || paymentDetails.customMessage;
      
      if (!hasPaymentMethods && !hidePaymentMethodWarning) {
        setDeferredShareAction(() => () => setShareSheetParticipant(participant));
        setIsPaymentWarningOpen(true);
      } else {
        setShareSheetParticipant(participant);
      }
  };

  const myParticipantForSettleUp = settleUpBill ? settleUpBill.sharedData.bill.participants.find((p: Participant) => p.id === settleUpBill.myParticipantId) : null;

  const getActiveFilterTag = () => {
    if (dashboardSummaryFilter === 'othersOweMe') return 'Others Owe Me';
    if (dashboardSummaryFilter === 'iOwe') return 'I Owe';
    return null;
  };
  const activeFilterTag = getActiveFilterTag();
  
  const handleConvertToTemplate = (bill: Bill) => {
    navigate(View.CreateBill, { convertFromBill: bill.id });
  };

  const handleExportOwnedBill = (bill: Bill) => {
      exportData({ owned: [bill] }, `${bill.description.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
      showNotification(`Exported "${bill.description}"`);
  };

  const handleExportImportedBill = (bill: ImportedBill) => {
      exportData({ imported: [bill] }, `${bill.sharedData.bill.description.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
      showNotification(`Exported "${bill.sharedData.bill.description}"`);
  };

  const renderContent = () => {
    if (dashboardView === 'participants' && !selectedParticipant) {
        if (participantsData.length > 0) {
            return <ParticipantList participantsData={participantsData} onSetShareSheetParticipant={handleSelectParticipantForShare} onMarkParticipantAsPaid={handleMarkParticipantAsPaid} />;
        }
    } else if (selectedParticipant) {
        return <ParticipantDetailView 
                  participantBills={participantBills} 
                  onSelectBill={onSelectBill} 
                  onArchiveBill={onArchiveBill} 
                  onUnarchiveBill={onUnarchiveBill} 
                  onDeleteBill={onDeleteBill}
                  onReshareBill={onReshareBill}
                  dashboardStatusFilter={dashboardStatusFilter} 
                  searchQuery={searchQuery} 
                  selectedParticipant={selectedParticipant} 
                  onExport={() => handleExportParticipant(selectedParticipant)}
                  onConvertToTemplate={handleConvertToTemplate}
                  onExportBill={handleExportOwnedBill}
                />;
    } else if (dashboardView === 'upcoming' && upcomingRecurringBills.length > 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingRecurringBills.slice(0, visibleCount).map(bill => (
                    <RecurringBillCard key={bill.id} bill={bill} onClick={() => navigate(View.CreateBill, { fromTemplate: bill })} />
                ))}
            </div>
        );
    } else if (dashboardView === 'templates' && allRecurringBills.length > 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allRecurringBills.slice(0, visibleCount).map(bill => (
                    <RecurringBillCard key={bill.id} bill={bill} onClick={() => navigate(View.CreateBill, { fromTemplate: bill })} />
                ))}
            </div>
        );
    } else if (dashboardView === 'groups') {
        if (filteredGroups.length > 0) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map(group => (
                <SwipeableGroupCard 
                  key={group.id} 
                  group={group} 
                  onClick={() => navigate(View.GroupDetails, { groupToView: group })} 
                  onEdit={() => navigate(View.CreateGroup, { groupToEdit: group })} 
                  onDelete={() => onDeleteGroup(group.id)} />
              ))}
            </div>
          );
        }
    } else if (dashboardView === 'budget') {
        if (budgetData.hasBudgetData) {
            return <BudgetView 
                budgetData={budgetData}
                date={budgetDate}
                setDate={setBudgetDate}
                onSelectBill={handleSelectBillFromBudget}
            />
        }
    } else if (dashboardView === 'bills' && (filteredBills.length > 0 || filteredImportedBills.length > 0 || subscriptionStatus === 'free')) {
        return <BillList 
            filteredBills={filteredBills} 
            filteredImportedBills={filteredImportedBills} 
            visibleCount={visibleCount} 
            subscriptionStatus={subscriptionStatus} 
            archivingBillIds={archivingBillIds} 
            onSelectBill={onSelectBill} 
            onArchiveBill={onArchiveBill} 
            onUnarchiveBill={onUnarchiveBill} 
            onDeleteBill={onDeleteBill} 
            onReshareBill={onReshareBill}
            onSelectImportedBill={onSelectImportedBill} 
            onUpdateImportedBill={onUpdateImportedBill} 
            onArchiveImportedBill={onArchiveImportedBill} 
            onUnarchiveImportedBill={onUnarchiveImportedBill} 
            onDeleteImportedBill={onDeleteImportedBill} 
            onShowSummaryDetails={onShowSummaryDetails} 
            onSettleUp={handleSettleUp} 
            loadMoreRef={loadMoreRef} 
            hasMore={hasMore}
            onConvertToTemplate={handleConvertToTemplate}
            onExportOwnedBill={handleExportOwnedBill}
            onExportImportedBill={handleExportImportedBill}
        />;
    }
    
    const { title, message } = getEmptyState();
    return <EmptyState title={title} message={message} isArchiveContext={dashboardStatusFilter === 'archived'} />;
  };

  return (
    <div>
      {['bills', 'participants'].includes(dashboardView) &&
        <DashboardSummary summaryTotals={summaryTotals} dashboardStatusFilter={dashboardStatusFilter} dashboardSummaryFilter={dashboardSummaryFilter} onSetDashboardSummaryFilter={onSetDashboardSummaryFilter} />
      }
      {/* FIX: Pass dashboardLayoutMode and onSetDashboardLayoutMode props. */}
      <DashboardControls 
        selectedParticipant={selectedParticipant}
        onClearParticipant={onClearParticipant}
        dashboardView={dashboardView}
        onSetDashboardView={onSetDashboardView}
        dashboardStatusFilter={dashboardStatusFilter}
        onSetDashboardStatusFilter={onSetDashboardStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        dashboardLayoutMode={dashboardLayoutMode}
        onSetDashboardLayoutMode={onSetDashboardLayoutMode}
        hasRecurringBills={hasRecurringBills}
        hasBudgetData={budgetData.hasBudgetData}
      />
      
      {activeFilterTag && dashboardView === 'bills' && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-x-1.5 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Filtering by: <span className="font-semibold">{activeFilterTag}</span>
            <button onClick={() => onSetDashboardSummaryFilter('total')} className="ml-1 -mr-1 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </span>
        </div>
      )}
      
      {dashboardView === 'groups' && (
        <div className="mb-6">
          <button
            onClick={() => navigate(View.CreateGroup)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-teal-500/50 dark:border-teal-400/50 rounded-lg text-teal-600 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/40 bg-teal-50/50 dark:bg-teal-900/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span className="font-bold text-lg">Add New Group</span>
          </button>
        </div>
      )}

      {renderContent()}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center items-center p-8">
          <svg className="animate-spin h-8 w-8 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
      
      {shareSheetParticipant && <ShareActionSheet 
        participant={{ ...shareSheetParticipant, id: shareSheetParticipant.name, amountOwed: shareSheetParticipant.amount, paid: false } as Participant} 
        onClose={() => setShareSheetParticipant(null)} 
        onShareSms={handleShareSms as any}
        onShareEmail={handleShareEmail as any}
        onShareGeneric={handleShareGeneric as any}
        onShareLinkSms={() => handleShareLink(shareSheetParticipant.name, 'sms')} 
        onShareLinkEmail={() => handleShareLink(shareSheetParticipant.name, 'email')} 
        onShareLinkGeneric={() => handleShareLink(shareSheetParticipant.name, 'generic')} 
        onViewDetails={() => { onSelectParticipant(shareSheetParticipant.name); setShareSheetParticipant(null); }} 
        shareContext="dashboard" />}
      {isHalfScreenAdOpen && <HalfScreenAdModal onClose={() => setIsHalfScreenAdOpen(false)} />}
      {isPaymentWarningOpen && (
        <PaymentMethodWarningModal
            onClose={() => { setIsPaymentWarningOpen(false); setDeferredShareAction(null); }}
            onContinue={() => {
                setIsPaymentWarningOpen(false);
                if(deferredShareAction) deferredShareAction();
                setDeferredShareAction(null);
            }}
            onAddMethods={() => {
                setIsPaymentWarningOpen(false);
                setDeferredShareAction(null);
                setSettingsSection('payments');
            }}
            onUpdateSettings={updateSettings}
        />
      )}
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
