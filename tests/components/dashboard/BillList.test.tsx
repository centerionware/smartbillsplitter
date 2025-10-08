import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BillList from '../../../components/dashboard/BillList';
import { Bill } from '../../../types';

// Mocks
vi.mock('../../../components/SwipeableBillCard', () => ({ default: ({ bill }: { bill: Bill }) => <div data-testid={`bill-${bill.id}`}>{bill.description}</div> }));
vi.mock('../../../components/AdBillCard', () => ({ default: () => <div data-testid="ad-card" /> }));
vi.mock('../../../services/adService', () => ({ AD_IFRAME_CONTENT: '<html><body>Ad</body></html>' }));
vi.mock('../../../components/SwipeableImportedBillCard', () => ({ default: () => <div /> }));


const mockBills: Bill[] = Array.from({ length: 5 }, (_, i) => ({
  id: `${i + 1}`,
  description: `Bill ${i + 1}`,
  totalAmount: 10 * (i + 1),
  date: new Date().toISOString(),
  status: 'active',
  participants: [],
}));

const mockProps = {
  filteredBills: mockBills,
  filteredImportedBills: [],
  visibleCount: 15,
  archivingBillIds: [],
  onSelectBill: vi.fn(),
  onArchiveBill: vi.fn(),
  onUnarchiveBill: vi.fn(),
  onDeleteBill: vi.fn(),
  onReshareBill: vi.fn(),
  onSelectImportedBill: vi.fn(),
  onUpdateImportedBill: vi.fn(),
  onArchiveImportedBill: vi.fn(),
  onUnarchiveImportedBill: vi.fn(),
  onDeleteImportedBill: vi.fn(),
  onShowSummaryDetails: vi.fn(),
  onSettleUp: vi.fn(),
  loadMoreRef: { current: null },
  hasMore: false,
  onConvertToTemplate: vi.fn(),
  onExportOwnedBill: vi.fn(),
  onExportImportedBill: vi.fn(),
};

describe('BillList component with Ads', () => {
  it('displays an ad card in card view for free users', () => {
    render(<BillList {...mockProps} subscriptionStatus="free" dashboardLayoutMode="card" />);
    
    expect(screen.getByTestId('ad-card')).toBeInTheDocument();
  });
  
  it('does NOT display an ad card in card view for subscribed users', () => {
    render(<BillList {...mockProps} subscriptionStatus="subscribed" dashboardLayoutMode="card" />);
    
    expect(screen.queryByTestId('ad-card')).not.toBeInTheDocument();
  });
  
  it('displays an ad list item in list view for free users', () => {
    render(<BillList {...mockProps} subscriptionStatus="free" dashboardLayoutMode="list" />);
    
    // AdListItem is defined inside BillList, so we check for its content
    expect(screen.getByText('Advertisement')).toBeInTheDocument();
    expect(screen.getByTitle('Advertisement')).toBeInTheDocument(); // The iframe title
  });

  it('does NOT display an ad list item in list view for subscribed users', () => {
    render(<BillList {...mockProps} subscriptionStatus="subscribed" dashboardLayoutMode="list" />);

    expect(screen.queryByText('Advertisement')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Advertisement')).not.toBeInTheDocument();
  });
});