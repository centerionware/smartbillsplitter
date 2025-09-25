import React, { useState } from 'react';
import type { RecurringBill } from '../types.ts';
import SwipeableRecurringBillCard from './SwipeableRecurringBillCard.tsx';

interface RecurringBillsListProps {
  recurringBills: RecurringBill[];
  onCreateFromTemplate: (template: RecurringBill) => void;
  onEditTemplate: (template: RecurringBill) => void;
  onArchive: (billId: string) => void;
  onUnarchive: (billId: string) => void;
  onDelete: (billId: string) => void;
  onBack: () => void;
}

const RecurringBillsList: React.FC<RecurringBillsListProps> = ({
  recurringBills,
  onCreateFromTemplate,
  onEditTemplate,
  onArchive,
  onUnarchive,
  onDelete,
  onBack,
}) => {
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  
  const filteredBills = recurringBills.filter(b => b.status === statusFilter);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back to Dashboard
      </button>

       <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200">Recurring Bills</h2>
          <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg self-start sm:self-center">
             <button onClick={() => setStatusFilter('active')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${statusFilter === 'active' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Active</button>
             <button onClick={() => setStatusFilter('archived')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${statusFilter === 'archived' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Archived</button>
          </div>
      </div>
      
      {filteredBills.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBills.map(bill => (
            <SwipeableRecurringBillCard
              key={bill.id}
              bill={bill}
              onClick={() => onCreateFromTemplate(bill)}
              onEdit={() => onEditTemplate(bill)}
              onArchive={() => onArchive(bill.id)}
              onUnarchive={() => onUnarchive(bill.id)}
              onDelete={() => onDelete(bill.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-6 bg-white dark:bg-slate-800 rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M4 18v-5h5m10-4h5v5h-5M14 18h5v-5h-5" />
          </svg>
          <h3 className="mt-2 text-xl font-medium text-slate-900 dark:text-slate-100">
            No {statusFilter} recurring bills
          </h3>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            {statusFilter === 'active' ? 'Create a new recurring bill template to get started.' : 'Archived templates will appear here.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default RecurringBillsList;