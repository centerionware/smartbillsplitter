import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '../../components/dashboard/Dashboard';
import { View } from '../../types';
import type { Bill, ImportedBill, Settings } from '../../types';

// Mock child components to isolate Dashboard logic
vi.mock('../../components/dashboard/DashboardSummary', () => ({ default: () => <div data-testid="summary" /> }));
vi.mock('../../components/dashboard/DashboardControls', () => ({ default: () => <div data-testid="controls" /> }));
vi.mock('../../components/dashboard/BillList', () => ({ default: () => <div data-testid="bill-list" /> }));
vi.mock('../../components/ParticipantList', () => ({ default: () => <div data-testid="participant-list" /> }));
vi.mock('../../components/dashboard/EmptyState', () => ({ default: () => <div data-testid="empty-state" /> }));

const mockBills: Bill[] = [
  { id: '1', description: 'Groceries', totalAmount: 100, date: new Date().toISOString(), status: 'active', participants: [{id: 'p1', name: 'Me', amountOwed: 50, paid: true}, {id: 'p2', name: 'Bob', amountOwed: 50, paid: false}] },
  { id: '2', description: 'Dinner', totalAmount: 50, date: new Date().toISOString(), status: 'archived', participants: [] },
];

const mockImportedBills: ImportedBill[] = [];
const mockRecurringBills = [];
const mockSettings: Settings = { myDisplayName: 'Me' } as Settings;

const mockDashboardProps = {
  bills: mockBills,
  importedBills: mockImportedBills,
  recurringBills: mockRecurringBills,
  groups: [],
  participantsData: [],
  settings: mockSettings,
  subscriptionStatus: 'free' as const,
  onSelectBill: vi.fn(),
  onSelectImportedBill: vi.fn(),
  onArchiveBill: vi.fn(),
  onUnarchiveBill: vi.fn(),
  onDeleteBill: vi.fn(),
  onDeleteGroup: vi.fn(),
  onReshareBill: vi.fn(),
  onUpdateMultipleBills: vi.fn(),
  onUpdateImportedBill: vi.fn(),
  onArchiveImportedBill: vi.fn(),
  onUnarchiveImportedBill: vi.fn(),
  onDeleteImportedBill: vi.fn(),
  onShowSummaryDetails: vi.fn(),
  onCreateFromTemplate: vi.fn(),
  navigate: vi.fn(),
  updateSettings: vi.fn(),
  setSettingsSection: vi.fn(),
  
  // Dashboard state
  dashboardView: 'bills' as const,
  selectedParticipant: null,
  dashboardStatusFilter: 'active' as const,
  dashboardSummaryFilter: 'total' as const,
  onSetDashboardView: vi.fn(),
  onSetDashboardStatusFilter: vi.fn(),
  onSetDashboardSummaryFilter: vi.fn(),
  onSelectParticipant: vi.fn(),
  onClearParticipant: vi.fn(),
};

// Mock AppControl context
vi.mock('../../contexts/AppControlContext', () => ({
    useAppControl: () => ({
        showNotification: vi.fn(),
    }),
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the BillList by default', () => {
    render(<Dashboard {...mockDashboardProps} />);
    expect(screen.getByTestId('bill-list')).toBeInTheDocument();
    expect(screen.queryByTestId('participant-list')).not.toBeInTheDocument();
  });

  it('renders the ParticipantList when dashboardView is "participants"', () => {
    render(<Dashboard {...mockDashboardProps} dashboardView="participants" />);
    expect(screen.getByTestId('participant-list')).toBeInTheDocument();
    expect(screen.queryByTestId('bill-list')).not.toBeInTheDocument();
  });

  it('renders an EmptyState when there are no bills to show', () => {
    render(<Dashboard {...mockDashboardProps} bills={[]} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders the groups view when dashboardView is "groups"', () => {
    const groups = [{ id: '1', name: 'Test Group', participants: [], defaultSplit: { mode: 'equally' }, lastUpdatedAt: Date.now(), popularity: 1 }];
    render(<Dashboard {...mockDashboardProps} dashboardView="groups" groups={groups} />);
    // Don't have a specific testid for group list, so check for a key part of that view
    expect(screen.getByText('Add New Group')).toBeInTheDocument();
  });
});