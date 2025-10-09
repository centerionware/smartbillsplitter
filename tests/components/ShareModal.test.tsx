import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShareModal from '../../components/ShareModal';
import { Bill, Settings } from '../../types';
import { generateShareLink } from '../../services/shareService';

// Mocks
vi.mock('../../contexts/AppControlContext', () => ({
  useAppControl: () => ({
    showNotification: vi.fn(),
  }),
}));

vi.mock('../../services/shareService', () => ({
  generateShareLink: vi.fn(),
}));

const mockSettings: Settings = {
  myDisplayName: 'Me',
  paymentDetails: { venmo: '', paypal: '', cashApp: '', zelle: '', customMessage: '' },
  shareTemplate: '',
  notificationsEnabled: false,
  notificationDays: 3,
  hidePaymentMethodWarning: false,
  totalBudget: undefined,
  dashboardLayoutMode: 'card',
};

const mockBillWithHistory: Bill = {
  id: 'bill-1',
  description: 'Dinner Party',
  totalAmount: 100,
  date: new Date().toISOString(),
  status: 'active',
  participants: [
    { id: 'p1', name: 'Alice', amountOwed: 50, paid: false, phone: '123' },
    { id: 'p2', name: 'Bob', amountOwed: 50, paid: false },
  ],
  shareHistory: {
    p1: {
      sms: Date.now() - 5 * 60 * 1000, // 5 minutes ago
    },
    p2: {
      copy: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    },
  },
};

const mockBillWithoutHistory: Bill = {
  ...mockBillWithHistory,
  shareHistory: undefined,
};

const mockHandlers = {
  onClose: vi.fn(),
  onUpdateBill: vi.fn().mockResolvedValue({}),
  checkAndMakeSpaceForImageShare: vi.fn().mockResolvedValue(true),
};

describe('ShareModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateShareLink).mockImplementation(async (bill: Bill) => {
        // The real function returns a new bill object with shareInfo added.
        // This more accurate mock ensures the component receives the expected data structure.
        const billWithNewShareInfo = {
            ...bill,
            shareInfo: bill.shareInfo || {
                shareId: 'mock-share-id',
                encryptionKey: {} as any,
                signingPublicKey: {} as any,
            }
        };
        return { url: 'http://share.link', billWithNewShareInfo };
    });
  });

  it('renders a "Share History" section', () => {
    render(<ShareModal bill={mockBillWithoutHistory} settings={mockSettings} {...mockHandlers} />);
    expect(screen.getByText('Share History')).toBeInTheDocument();
  });

  it('shows previous share events when history exists', async () => {
    render(<ShareModal bill={mockBillWithHistory} settings={mockSettings} {...mockHandlers} />);
    
    // FIX: Click the summary to expand the details section before asserting its content.
    const summary = screen.getByText('Share History');
    await userEvent.click(summary);

    expect(await screen.findByText(/Shared with Alice/i)).toBeInTheDocument();
    expect(screen.getByText(/via Text Message/i)).toBeInTheDocument();
    expect(screen.getByText(/5 minutes ago/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared with Bob/i)).toBeInTheDocument();
    expect(screen.getByText(/via Link Copy/i)).toBeInTheDocument();
    expect(screen.getByText(/2 days ago/i)).toBeInTheDocument();
  });

  it('shows a message when no share history exists', async () => {
    render(<ShareModal bill={mockBillWithoutHistory} settings={mockSettings} {...mockHandlers} />);
    
    const summary = screen.getByText('Share History');
    await userEvent.click(summary);

    expect(await screen.findByText(/No shares have been sent for this bill yet./i)).toBeInTheDocument();
  });

  it('updates share history after a successful share action', async () => {
    const onUpdateBillMock = vi.fn().mockResolvedValue({});
    render(<ShareModal bill={mockBillWithoutHistory} settings={mockSettings} {...mockHandlers} onUpdateBill={onUpdateBillMock} />);

    // Find the "Copy" button for Alice
    const aliceRow = screen.getByText('Alice').closest('li');
    const copyButton = aliceRow?.querySelector('button[title="Copy Link"]');
    expect(copyButton).not.toBeNull();
    
    await userEvent.click(copyButton!);

    // Wait for async operations to complete
    await vi.waitFor(() => {
        expect(onUpdateBillMock).toHaveBeenCalled();
    });

    // The mock should be called with the updated shareHistory
    const updatedBill = onUpdateBillMock.mock.calls[0][0];
    expect(updatedBill.shareHistory).toBeDefined();
    expect(updatedBill.shareHistory.p1).toHaveProperty('copy');
  });
});