import React from 'react';
import type { SummaryFilter } from '../../types';

interface DashboardSummaryProps {
  summaryTotals: {
    totalTracked: number;
    othersOweMe: number;
    iOwe: number;
  };
  dashboardStatusFilter: 'active' | 'archived';
  dashboardSummaryFilter: SummaryFilter;
  onSetDashboardSummaryFilter: (filter: SummaryFilter) => void;
}

const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  summaryTotals,
  dashboardStatusFilter,
  dashboardSummaryFilter,
  onSetDashboardSummaryFilter,
}) => {
  const handleSummaryKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, filter: SummaryFilter) => {
    if ((e.key === 'Enter' || e.key === ' ') && dashboardStatusFilter === 'active') {
      e.preventDefault();
      onSetDashboardSummaryFilter(filter);
    }
  };
  
  const summaryCardBaseClasses = "p-3 flex-1 rounded-lg transition-all duration-300";
  const summaryCardInactiveClasses = "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50";
  const summaryCardActiveClasses = "bg-teal-50 dark:bg-teal-900/40 ring-2 ring-teal-500";
  const summaryCardDisabledClasses = "opacity-60 cursor-not-allowed";
  
  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md mb-8">
      <div className="flex flex-wrap items-stretch text-center gap-4">
        <div 
          className={`${summaryCardBaseClasses} ${dashboardSummaryFilter === 'total' ? summaryCardActiveClasses : (dashboardStatusFilter === 'active' ? summaryCardInactiveClasses : '')} ${dashboardStatusFilter === 'archived' ? summaryCardDisabledClasses : ''}`}
          onClick={() => dashboardStatusFilter === 'active' && onSetDashboardSummaryFilter('total')}
          onKeyDown={(e) => handleSummaryKeyDown(e, 'total')}
          role="button"
          tabIndex={dashboardStatusFilter === 'active' ? 0 : -1}
          aria-pressed={dashboardSummaryFilter === 'total'}
          aria-label="Filter by Total Tracked"
          aria-disabled={dashboardStatusFilter === 'archived'}
        >
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Tracked</p>
          <p className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">${summaryTotals.totalTracked.toFixed(2)}</p>
        </div>
        <div 
          className={`${summaryCardBaseClasses} ${dashboardSummaryFilter === 'othersOweMe' ? summaryCardActiveClasses : (dashboardStatusFilter === 'active' ? summaryCardInactiveClasses : '')} ${dashboardStatusFilter === 'archived' ? summaryCardDisabledClasses : ''}`}
          onClick={() => dashboardStatusFilter === 'active' && onSetDashboardSummaryFilter('othersOweMe')}
          onKeyDown={(e) => handleSummaryKeyDown(e, 'othersOweMe')}
          role="button"
          tabIndex={dashboardStatusFilter === 'active' ? 0 : -1}
          aria-pressed={dashboardSummaryFilter === 'othersOweMe'}
          aria-label="Filter by bills where others owe me"
          aria-disabled={dashboardStatusFilter === 'archived'}
        >
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Others Owe Me</p>
          <p className="text-2xl lg:text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">${summaryTotals.othersOweMe.toFixed(2)}</p>
        </div>
        <div 
          className={`${summaryCardBaseClasses} ${dashboardSummaryFilter === 'iOwe' ? summaryCardActiveClasses : (dashboardStatusFilter === 'active' ? summaryCardInactiveClasses : '')} ${dashboardStatusFilter === 'archived' ? summaryCardDisabledClasses : ''}`}
          onClick={() => dashboardStatusFilter === 'active' && onSetDashboardSummaryFilter('iOwe')}
          onKeyDown={(e) => handleSummaryKeyDown(e, 'iOwe')}
          role="button"
          tabIndex={dashboardStatusFilter === 'active' ? 0 : -1}
          aria-pressed={dashboardSummaryFilter === 'iOwe'}
          aria-label="Filter by bills where I owe"
          aria-disabled={dashboardStatusFilter === 'archived'}
        >
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">I Owe</p>
          <p className="text-2xl lg:text-3xl font-bold text-amber-700 dark:text-amber-300 mt-1">${summaryTotals.iOwe.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardSummary;
