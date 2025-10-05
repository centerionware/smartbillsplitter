import React from 'react';
// FIX: Changed import for `screen` and `fireEvent`. In some test setups with module resolution issues, these may not be correctly resolved from `@testing-library/react`. Importing directly from `@testing-library/dom` is a workaround.
import { render, act } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateBill from '../../components/CreateBill';
import type { Settings } from '../../types';

// Mocks
vi.mock('../../contexts/AppControlContext.tsx', () => ({
  useAppControl: () => ({
    showNotification: vi.fn(),
  }),
}));

const mockSettings: Settings = {
  myDisplayName: 'Me',
  paymentDetails: { venmo: '', paypal: '', cashApp: '', zelle: '', customMessage: '' },
  shareTemplate: '',
  notificationsEnabled: false,
  notificationDays: 3,
};

const mockHandlers = {
  onSaveBill: vi.fn(),
  onSaveRecurringBill: vi.fn(),
  onUpdateRecurringBill: vi.fn(),
  onBack: vi.fn(),
  updateSettings: vi.fn().mockResolvedValue(undefined),
};

// A simple render helper
const renderComponent = (props = {}) => {
  return render(
    <CreateBill
      settings={mockSettings}
      groups={[]}
      {...mockHandlers}
      {...props}
    />
  );
};


describe('CreateBill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '#/create-bill');
  });

  it('renders the initial step correctly', () => {
    renderComponent();
    expect(screen.getByText('How do you want to start?')).toBeInTheDocument();
    expect(screen.getByText('Scan a Receipt')).toBeInTheDocument();
    expect(screen.getByText('Enter Manually')).toBeInTheDocument();
  });

  it('navigates to the manual entry form', async () => {
    renderComponent();
    await userEvent.click(screen.getByText('Enter Manually'));
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Total Amount/i)).toBeInTheDocument();
  });
  
  it('updates description and total amount fields', async () => {
    renderComponent();
    await userEvent.click(screen.getByText('Enter Manually'));
    
    const descriptionInput = screen.getByLabelText(/Description/i);
    const amountInput = screen.getByLabelText(/Total Amount/i);

    await userEvent.type(descriptionInput, 'Team Lunch');
    // userEvent.type appends, so we clear first for amount
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '123.45');
    
    expect(descriptionInput).toHaveValue('Team Lunch');
    expect(amountInput).toHaveValue(123.45);
  });

  it('validates required fields before proceeding', async () => {
    renderComponent();
    await userEvent.click(screen.getByText('Enter Manually'));
    
    await userEvent.click(screen.getByText('Next'));

    expect(await screen.findByText('Description is required.')).toBeInTheDocument();
    expect(await screen.findByText('Total amount must be greater than zero.')).toBeInTheDocument();
    expect(mockHandlers.onSaveBill).not.toHaveBeenCalled();
  });
  
  it('calls onSaveBill with correct data on final step', async () => {
    renderComponent();
    await userEvent.click(screen.getByText('Enter Manually'));
    
    // Step 2: Fill primary details
    await userEvent.type(screen.getByLabelText(/Description/i), 'Test Bill');
    const amountInput = screen.getByLabelText(/Total Amount/i);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '100');
    await userEvent.click(screen.getByText('Next'));
    
    // Step 3: Add a participant
    const nameInput = screen.getByPlaceholderText('Participant 2');
    await userEvent.click(screen.getByText(/Add Manually/i));
    await userEvent.type(screen.getByPlaceholderText('Participant 2'), 'Bob');
    await userEvent.click(screen.getByText('Next'));
    
    // Step 4: Final save
    await userEvent.click(screen.getByText('Save Bill'));
    
    expect(mockHandlers.onSaveBill).toHaveBeenCalledTimes(1);
    const savedBillData = mockHandlers.onSaveBill.mock.calls[0][0];
    
    expect(savedBillData.description).toBe('Test Bill');
    expect(savedBillData.totalAmount).toBe(100);
    expect(savedBillData.participants.length).toBe(2);
    expect(savedBillData.participants[0].name).toBe('Me');
    expect(savedBillData.participants[1].name).toBe('Bob');
  });
});