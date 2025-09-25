import React from 'react';
import type { Bill } from '../../types';
import SwipeableBillCard from '../SwipeableBillCard.tsx';
import EmptyState from './EmptyState.tsx';

interface ParticipantDetailViewProps {
  participantBills: {
    active: Bill[];
    allArchived: Bill[];
    unpaidArchived: Bill[];
  };
  onSelectBill: (bill: Bill) => void;
  onArchiveBill: (billId: string) => void;
  onUnarchiveBill: (billId: string) => void;
  onDeleteBill: (billId: string) => void;
  dashboardStatusFilter: 'active' | 'archived';
  searchQuery: string;
  selectedParticipant: string;
}

const ParticipantDetailView: React.FC<ParticipantDetailViewProps> = ({
  participantBills,
  onSelectBill,
  onArchiveBill,
  onUnarchiveBill,
  onDeleteBill,
  dashboardStatusFilter,
  searchQuery,
  selectedParticipant,
}) => {
  const { active, allArchived, unpaidArchived } = participantBills;

  if (dashboardStatusFilter === 'active') {
    if (active.length === 0 && unpaidArchived.length === 0) {
      return (
        <EmptyState
          title="All Settled"
          message={searchQuery ? `Your search for "${searchQuery}" did not match any bills.` : `${selectedParticipant} has no active bills or unpaid archived bills.`}
        />
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
        <EmptyState
          title="No Archived Bills"
          message={searchQuery ? `Your search for "${searchQuery}" did not match any archived bills.` : `${selectedParticipant} has no archived bills.`}
          isArchiveContext
        />
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
};

export default ParticipantDetailView;
