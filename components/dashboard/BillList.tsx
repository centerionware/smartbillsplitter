import React, { useMemo } from 'react';
import type { Bill, ImportedBill, DashboardLayoutMode } from '../../types';
import type { SubscriptionStatus } from '../../hooks/useAuth';
import SwipeableBillCard from '../SwipeableBillCard';
import SwipeableImportedBillCard from '../SwipeableImportedBillCard';
import AdBillCard from '../AdBillCard';
import { AD_IFRAME_CONTENT } from '../../services/adService';

const AD_INTERVAL = 10; // Show an ad after every 10 bills

const AdListItem: React.FC = () => {
  if (!AD_IFRAME_CONTENT) {
    return null;
  }
  return (
    <div className="p-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        Advertisement
      </span>
      <div className="flex items-center justify-center w-full min-h-[100px]">
        <iframe
          srcDoc={AD_IFRAME_CONTENT}
          title="Advertisement"
          style={{ width: '100%', minHeight: '100px', border: '0', overflow: 'hidden' }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          aria-label="Advertisement Content"
        ></iframe>
      </div>
    </div>
  );
};

interface BillListProps {
  filteredBills: Bill[];
  filteredImportedBills: ImportedBill[];
  visibleCount: number;
  subscriptionStatus: SubscriptionStatus;
  archivingBillIds: string[];
  onSelectBill: (bill: Bill) => void;
  onArchiveBill: (billId: string) => void;
  onUnarchiveBill: (billId: string) => void;
  onDeleteBill: (billId: string) => void;
  onReshareBill: (billId: string) => void;
  onSelectImportedBill: (bill: ImportedBill) => void;
  onUpdateImportedBill: (bill: ImportedBill) => void;
  onArchiveImportedBill: (billId: string) => void;
  onUnarchiveImportedBill: (billId: string) => void;
  onDeleteImportedBill: (billId: string) => void;
  onShowSummaryDetails: (bill: ImportedBill) => void;
  onSettleUp: (bill: ImportedBill) => void;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  hasMore: boolean;
  onConvertToTemplate: (bill: Bill) => void;
  onExportOwnedBill: (bill: Bill) => void;
  onExportImportedBill: (bill: ImportedBill) => void;
  dashboardLayoutMode: DashboardLayoutMode;
}

const BillList: React.FC<BillListProps> = ({
  filteredBills,
  filteredImportedBills,
  visibleCount,
  subscriptionStatus,
  archivingBillIds,
  onSelectBill,
  onArchiveBill,
  onUnarchiveBill,
  onDeleteBill,
  onReshareBill,
  onSelectImportedBill,
  onUpdateImportedBill,
  onArchiveImportedBill,
  onUnarchiveImportedBill,
  onDeleteImportedBill,
  onShowSummaryDetails,
  onSettleUp,
  loadMoreRef,
  hasMore,
  onConvertToTemplate,
  onExportOwnedBill,
  onExportImportedBill,
  dashboardLayoutMode,
}) => {
  const itemsWithAds = useMemo(() => {
    const billsToShow = filteredBills.slice(0, visibleCount);
    const renderedItems: React.ReactElement[] = [];
    const isFree = subscriptionStatus === 'free';
    
    const AdComponent = dashboardLayoutMode === 'card' ? AdBillCard : AdListItem;

    if (isFree) {
      renderedItems.push(<AdComponent key="ad-first" />);
    }

    billsToShow.forEach((bill, index) => {
      const isArchiving = archivingBillIds.includes(bill.id);
      renderedItems.push(
        <div key={bill.id} className={`transition-all duration-500 ease-out ${isArchiving ? 'opacity-0 scale-90 max-h-0' : 'max-h-96'}`}>
          <SwipeableBillCard
            bill={bill}
            onArchive={() => onArchiveBill(bill.id)}
            onUnarchive={() => onUnarchiveBill(bill.id)}
            onDelete={() => onDeleteBill(bill.id)}
            onReshare={() => onReshareBill(bill.id)}
            onClick={(e) => onSelectBill(bill)}
            onConvertToTemplate={() => onConvertToTemplate(bill)}
            onExport={() => onExportOwnedBill(bill)}
            layoutMode={dashboardLayoutMode}
          />
        </div>
      );

      if (isFree && (index + 1) % AD_INTERVAL === 0) {
        renderedItems.push(<AdComponent key={`ad-interval-${index}`} />);
      }
    });
    return renderedItems;
  }, [filteredBills, visibleCount, subscriptionStatus, onArchiveBill, onUnarchiveBill, onDeleteBill, onReshareBill, onSelectBill, archivingBillIds, onConvertToTemplate, onExportOwnedBill, dashboardLayoutMode]);

  const layoutClasses = dashboardLayoutMode === 'card'
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    : "bg-white dark:bg-slate-800 rounded-lg shadow-md";

  return (
    <>
      {filteredImportedBills.length > 0 && (
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4">Shared With Me</h3>
          <div className={layoutClasses}>
            {filteredImportedBills.map(ib => (
              <SwipeableImportedBillCard 
                key={ib.id} 
                bill={ib}
                onArchive={() => onArchiveImportedBill(ib.id)}
                onUnarchive={() => onUnarchiveImportedBill(ib.id)}
                onDelete={() => onDeleteImportedBill(ib.id)}
                onClick={(e) => onSelectImportedBill(ib)}
                onShowSummaryDetails={() => onShowSummaryDetails(ib)}
                onSettleUp={() => onSettleUp(ib)}
                onExport={() => onExportImportedBill(ib)}
                layoutMode={dashboardLayoutMode}
              />
            ))}
          </div>
        </div>
      )}
      {itemsWithAds.length > 0 && (
        <>
          <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4">My Bills</h3>
          <div className={layoutClasses}>
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
      )}
    </>
  );
};

export default BillList;