import React, { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth, AuthProvider } from '../../hooks/useAuth';
import { getSubscriptionStatus, getSubscriptionDetails, saveSubscriptionStatus, saveSubscriptionDetails, deleteSubscriptionDetails, SubscriptionDetails } from '../../services/db';

vi.mock('../../services/db');

const wrapper = ({ children }: { children: ReactNode }) => (
  React.createElement(AuthProvider, null, children)
);

describe('useAuth hook', () => {
  beforeEach(() => {
    // FIX: Reset mocks before each test to prevent state leakage between tests.
    vi.clearAllMocks();
    vi.mocked(getSubscriptionStatus).mockResolvedValue(null);
    vi.mocked(getSubscriptionDetails).mockResolvedValue(undefined);
  });

  it('should start with isLoading true and status null', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.subscriptionStatus).toBe(null);
    await act(async () => {});
  });

  it('should load subscribed status and details from db', async () => {
    const mockDetails: SubscriptionDetails = {
      provider: 'stripe',
      customerId: 'cus_123',
      subscriptionId: 'sub_123',
      startDate: new Date().toISOString(),
      duration: 'monthly',
    };
    vi.mocked(getSubscriptionStatus).mockResolvedValue('subscribed');
    vi.mocked(getSubscriptionDetails).mockResolvedValue(mockDetails);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.subscriptionStatus).toBe('subscribed');
    expect(result.current.subscriptionDetails).toEqual(mockDetails);
  });

  it('should login and save status and details', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    // FIX: Wait for the initial load effect to complete to prevent race conditions.
    await act(async () => {});

    const loginDetails = {
      provider: 'paypal' as const,
      customerId: 'paypal_user',
      subscriptionId: 'paypal_sub',
      duration: 'yearly' as const,
    };

    await act(async () => {
      await result.current.login(loginDetails);
    });

    expect(saveSubscriptionStatus).toHaveBeenCalledWith('subscribed');
    expect(saveSubscriptionDetails).toHaveBeenCalledWith(expect.objectContaining(loginDetails));
    expect(result.current.subscriptionStatus).toBe('subscribed');
    expect(result.current.subscriptionDetails).toEqual(expect.objectContaining(loginDetails));
  });

  it('should select free tier and clear details', async () => {
    // Prime the hook to think it's subscribed initially
    vi.mocked(getSubscriptionStatus).mockResolvedValue('subscribed');
    const { result } = renderHook(() => useAuth(), { wrapper });

    // FIX: Wait for the initial async load effect to complete before proceeding.
    await act(async () => {});
    expect(result.current.subscriptionStatus).toBe('subscribed'); // Verify initial state

    await act(async () => {
      await result.current.selectFreeTier();
    });

    expect(deleteSubscriptionDetails).toHaveBeenCalled();
    expect(saveSubscriptionStatus).toHaveBeenCalledWith('free');
    expect(result.current.subscriptionStatus).toBe('free');
    expect(result.current.subscriptionDetails).toBe(null);
  });

  it('should logout and clear status and details', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValue('subscribed');
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {}); // initial load
    
    await act(async () => {
      await result.current.logout();
    });

    expect(deleteSubscriptionDetails).toHaveBeenCalled();
    expect(result.current.subscriptionStatus).toBe(null);
    expect(result.current.subscriptionDetails).toBe(null);
  });
});
