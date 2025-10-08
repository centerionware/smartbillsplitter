import React from 'react';
import type { DashboardView, DashboardLayoutMode } from '../../types';

interface DashboardControlsProps {
  selectedParticipant: string | null;
  onClearParticipant: () => void;
  dashboardView: DashboardView;
  onSetDashboardView: (view: DashboardView) => void;
  dashboardStatusFilter: 'active' | 'archived';
  onSetDashboardStatusFilter: (status: 'active' | 'archived') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMode: 'description' | 'participant';
  setSearchMode: (mode: 'description' | 'participant') => void;
  dashboardLayoutMode: DashboardLayoutMode;
  onSetDashboardLayoutMode: (mode: DashboardLayoutMode) => void;
  hasRecurringBills: boolean;
  hasBudgetData: boolean;
}

const DashboardControls: React.FC<DashboardControlsProps> = ({
  selectedParticipant,
  onClearParticipant,
  dashboardView,
  onSetDashboardView,
  dashboardStatusFilter,
  onSetDashboardStatusFilter,
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
  dashboardLayoutMode,
  onSetDashboardLayoutMode,
  hasRecurringBills,
  hasBudgetData,
}) => {
  const listViews: DashboardView[] = ['bills', 'participants', 'upcoming', 'templates', 'groups'];
  const showLayoutToggle = listViews.includes(dashboardView) && !selectedParticipant;

  return (
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
             <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg self-start sm:self-center flex-wrap gap-1 sm:gap-0">
                <button onClick={() => onSetDashboardView('bills')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${dashboardView === 'bills' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Bills</button>
                {hasBudgetData && <button onClick={() => onSetDashboardView('budget')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${dashboardView === 'budget' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Budget</button>}
                <button onClick={() => onSetDashboardView('groups')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${dashboardView === 'groups' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Groups</button>
                <button onClick={() => onSetDashboardView('participants')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${dashboardView === 'participants' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>People</button>
                {hasRecurringBills && (
                    <>
                        <button onClick={() => onSetDashboardView('upcoming')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${dashboardView === 'upcoming' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Upcoming</button>
                        <button onClick={() => onSetDashboardView('templates')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${dashboardView === 'templates' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Templates</button>
                    </>
                )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 justify-end">
          {showLayoutToggle && (
            <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
              <button onClick={() => onSetDashboardLayoutMode('card')} title="Card View" className={`p-1.5 rounded-md transition-colors ${dashboardLayoutMode === 'card' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 11a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button onClick={() => onSetDashboardLayoutMode('list')} title="List View" className={`p-1.5 rounded-md transition-colors ${dashboardLayoutMode === 'list' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
          {!['upcoming', 'templates', 'groups', 'budget'].includes(dashboardView) && (
            <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg self-start sm:self-center">
                <button onClick={() => onSetDashboardStatusFilter('active')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${dashboardStatusFilter === 'active' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Active</button>
                <button onClick={() => onSetDashboardStatusFilter('archived')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${dashboardStatusFilter === 'archived' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Archived</button>
            </div>
          )}
        </div>
      </div>

      {(dashboardView !== 'participants' || selectedParticipant) && dashboardView !== 'budget' && (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={searchMode === 'description' ? "Search by description..." : "Search by participant name..."} className="w-full pl-11 pr-24 py-3 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" aria-label="Search bills"/>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 bg-slate-200 dark:bg-slate-600 p-1 rounded-md">
            <button onClick={() => setSearchMode('description')} className={`p-1.5 rounded ${searchMode === 'description' ? 'bg-white dark:bg-slate-800 text-teal-600 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-500/50'}`} aria-label="Search by bill description" title="Search by bill description">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
            <button onClick={() => setSearchMode('participant')} disabled={['upcoming', 'templates', 'groups'].includes(dashboardView)} className={`p-1.5 rounded ${searchMode === 'participant' ? 'bg-white dark:bg-slate-800 text-teal-600 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-500/50'} disabled:opacity-50 disabled:cursor-not-allowed`} aria-label="Search by participant name" title="Search by participant name">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardControls;