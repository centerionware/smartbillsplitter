import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import BillCard from '../../components/BillCard';
import type { Bill } from '../../types';

const mockBill: Bill = {
  id: 'bill-1',
  description: 'Dinner Party',
  totalAmount: 120.5,
  date: new Date('2024-05-20').toISOString(),
  status: 'active',
  participants: [
    { id: 'p1', name: 'Alice', amountOwed: 40.17, paid: true },
    { id: 'p2', name: 'Bob', amountOwed: 40.17, paid: false },
    { id: 'p3', name: 'Charlie', amountOwed: 40.16, paid: false },
  ],
};

const mockHandlers = {
  onClick: vi.fn(),
  onArchive: vi.fn(),
  onUnarchive: vi.fn(),
  onDelete: vi.fn(),
  onReshare: vi.fn(),
  onConvertToTemplate: vi.fn(),
  onExport: vi.fn(),
};

describe('BillCard', () => {
  it('renders bill details correctly', () => {
    render(<BillCard bill={mockBill} {...mockHandlers} />);

    expect(screen.getByText('Dinner Party')).toBeInTheDocument();
    expect(screen.getByText('$120.50')).toBeInTheDocument();
    expect(screen.getByText(new Date(mockBill.date).toLocaleDateString())).toBeInTheDocument();
  });

  it('calculates and displays the correct amount owed', () => {
    render(<BillCard bill={mockBill} {...mockHandlers} />);
    const owedAmount = 40.17 + 40.16; // Bob + Charlie
    expect(screen.getByText('Owed to you')).toBeInTheDocument();
    expect(screen.getByText(`$${owedAmount.toFixed(2)}`)).toBeInTheDocument();
  });

  it('displays "Settled" when all participants have paid', () => {
    const settledBill: Bill = {
      ...mockBill,
      participants: mockBill.participants.map(p => ({ ...p, paid: true })),
    };
    render(<BillCard bill={settledBill} {...mockHandlers} />);
    expect(screen.getByText('Settled')).toBeInTheDocument();
    expect(screen.getByText('No outstanding')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('calls onClick when the card is clicked', async () => {
    render(<BillCard bill={mockBill} {...mockHandlers} />);
    await userEvent.click(screen.getByText('Dinner Party'));
    expect(mockHandlers.onClick).toHaveBeenCalled();
  });

  it('opens the menu and shows actions when the menu button is clicked', async () => {
    render(<BillCard bill={mockBill} {...mockHandlers} />);
    const menuButton = screen.getByLabelText('More options');
    await userEvent.click(menuButton);

    expect(screen.getByText('Convert to Template')).toBeInTheDocument();
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });
});