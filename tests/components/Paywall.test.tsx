import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import Paywall from '../../components/Paywall';
import { fetchWithRetry } from '../../services/api';

// --- Mocks ---

// Mock the API service
vi.mock('../../services/api.ts', () => ({
  getApiUrl: vi.fn().mockImplementation(async (path: string) => `http://localhost/api${path}`),
  fetchWithRetry: vi.fn(),
}));

// Mock the SubscriptionWarningModal to remove the timer complexity from this test.
// This allows us to test the Paywall's logic in isolation.
vi.mock('../../components/SubscriptionWarningModal', () => ({
  default: ({ onContinue, onCancel }: { onContinue: () => void, onCancel: () => void }) => (
    <div data-testid="mock-warning-modal">
      <h1>Subscription Warning</h1>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onContinue}>Continue to Checkout</button>
    </div>
  ),
}));


describe('Paywall', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('VITE_PAYMENT_PROVIDER', 'paypal');
        // Mock window.location.href setter
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalLocation, href: '' },
        });
    });

    afterEach(() => {
        // Restore window.location
        Object.defineProperty(window, 'location', {
            writable: true,
            value: originalLocation,
        });
    });
  
  it('renders the title and subscription options', () => {
    render(<Paywall onSelectFreeTier={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Upgrade to Pro/i })).toBeInTheDocument();
    expect(screen.getByText(/Monthly Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Yearly Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Continue with the free, ad-supported version/i)).toBeInTheDocument();
  });

  it('calls onSelectFreeTier when the free tier button is clicked', async () => {
    const onSelectFreeTierMock = vi.fn();
    render(<Paywall onSelectFreeTier={onSelectFreeTierMock} />);
    
    const freeTierButton = screen.getByText(/Continue with the free, ad-supported version/i);
    await userEvent.click(freeTierButton);
    
    expect(onSelectFreeTierMock).toHaveBeenCalledTimes(1);
  });

  it('displays an initial error if one is provided', () => {
    const error = 'Something went wrong during verification.';
    render(<Paywall onSelectFreeTier={vi.fn()} initialError={error} />);
    expect(screen.getByText(new RegExp(error))).toBeInTheDocument();
  });

  it('attempts to create a checkout session when a plan is selected', async () => {
    const user = userEvent.setup();
    (fetchWithRetry as Mock).mockResolvedValue(new Response(JSON.stringify({ url: 'https://paypal.com/checkout' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    }));

    render(<Paywall onSelectFreeTier={vi.fn()} />);

    // 1. Click the plan to open the (now mocked) modal
    const monthlyPlan = screen.getByText(/Monthly Plan/i);
    await user.click(monthlyPlan);

    // 2. Verify the mock modal is visible and find its continue button
    const continueButton = await screen.findByRole('button', { name: /Continue to Checkout/i });
    expect(screen.getByTestId('mock-warning-modal')).toBeInTheDocument();

    // 3. Click the continue button in the mock modal. No timers to wait for.
    await user.click(continueButton);

    // 4. Assert that the checkout process was triggered (fetch was called)
    await waitFor(() => {
        expect(fetchWithRetry).toHaveBeenCalledWith('http://localhost/api/create-checkout-session', expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"plan":"monthly"'),
        }));
    });
    
    // 5. Assert the page was redirected
    await waitFor(() => {
        expect(window.location.href).toBe('https://paypal.com/checkout');
    });
  });
});