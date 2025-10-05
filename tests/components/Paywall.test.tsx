import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Paywall from '../../components/Paywall';

// Mock the API service
vi.mock('../../services/api.ts', () => ({
  getApiUrl: vi.fn().mockResolvedValue('http://localhost/api'),
  fetchWithRetry: vi.fn(),
}));
const fetchWithRetry = vi.mocked(vi.requireMock('../../services/api.ts').fetchWithRetry);

describe('Paywall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub the environment variable
    vi.stubEnv('VITE_PAYMENT_PROVIDER', 'paypal');
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
    // Mock a successful response from the checkout endpoint
    fetchWithRetry.mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://paypal.com/checkout' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    }));
    
    // Mock window.location.href
    const originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    window.location = { ...originalLocation, href: '' };

    render(<Paywall onSelectFreeTier={vi.fn()} />);

    // Click through the warning modal first
    const monthlyPlan = screen.getByText(/Monthly Plan/i);
    await userEvent.click(monthlyPlan);
    
    // Now click the continue button in the modal
    const continueButton = await screen.findByRole('button', { name: /Continue to Checkout/i });
    await userEvent.click(continueButton);

    expect(fetchWithRetry).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"plan":"monthly"'),
    }));
    
    // We expect the page to be redirected
    expect(window.location.href).toBe('https://paypal.com/checkout');

    // Restore original window.location
    window.location = originalLocation;
  });
});