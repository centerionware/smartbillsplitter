import React from 'react';
// FIX: Changed import for `screen`. In some test setups with module resolution issues, `screen` may not be correctly resolved from `@testing-library/react`. Importing it directly from `@testing-library/dom` is a workaround.
import { render, act } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Paywall from '../../components/Paywall';
import { fetchWithRetry } from '../../services/api';

// Mock the API service
vi.mock('../../services/api.ts', () => ({
  getApiUrl: vi.fn().mockResolvedValue('http://localhost/api'),
  fetchWithRetry: vi.fn(),
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
        vi.useRealTimers();
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
    vi.useFakeTimers();

    // Mock a successful response from the checkout endpoint
    vi.mocked(fetchWithRetry).mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://paypal.com/checkout' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    }));

    render(<Paywall onSelectFreeTier={vi.fn()} />);

    // Click through the warning modal first
    const monthlyPlan = screen.getByText(/Monthly Plan/i);
    await userEvent.click(monthlyPlan);
    
    // The modal is now open. Find the button (it will be disabled initially)
    const continueButton = await screen.findByRole('button', { name: /Please Read.../i });
    expect(continueButton).toBeDisabled();

    // Fast-forward all timers to enable the continue button
    await act(async () => {
        vi.runAllTimers();
    });
    
    // The button text and state should have changed.
    expect(continueButton).not.toBeDisabled();
    expect(continueButton).toHaveTextContent(/Continue to Checkout/i);
    
    // Now click the enabled continue button in the modal
    await userEvent.click(continueButton);

    expect(fetchWithRetry).toHaveBeenCalledWith('http://localhost/api/create-checkout-session', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"plan":"monthly"'),
    }));
    
    // We expect the page to be redirected
    expect(window.location.href).toBe('https://paypal.com/checkout');
  });
});