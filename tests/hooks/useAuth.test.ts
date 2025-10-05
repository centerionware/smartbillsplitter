import React, { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth, AuthProvider } from '../../hooks/useAuth';
import { getSubscriptionStatus, getSubscriptionDetails, saveSubscriptionStatus, saveSubscriptionDetails, deleteSubscriptionDetails, SubscriptionDetails } from '../../services/db.ts';

// Mock the db service
vi.mock('../../services/db', () => ({
  getSubscriptionStatus: vi.fn(),
  getSubscriptionDetails: vi.fn(),
  saveSubscriptionStatus: vi.fn(),
  saveSubscriptionDetails: vi.fn(),
  deleteSubscriptionDetails: vi.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  // FIX: The AuthProvider component does not accept a `value` prop; it creates its own value internally. The wrapper should simply render AuthProvider with children.
  React.createElement(AuthProvider, null, children)
);

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with isLoading true and status null', () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.subscriptionStatus).toBe(null);
  });

  it('should load free status from db', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValue('free');
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {}); // Let promises resolve

    expect(result.current.isLoading).toBe(false);
    expect(result.current.subscriptionStatus).toBe('free');
    expect(result.current.subscriptionDetails).toBe(null);
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
    const loginDetails = {
      provider: 'paypal' as const,
      customerId: 'paypal_user',
      subscriptionId: 'paypal_sub',
      duration: 'yearly' as const,
    };

    await act(async () => {
      result.current.login(loginDetails);
    });

    expect(saveSubscriptionStatus).toHaveBeenCalledWith('subscribed');
    expect(saveSubscriptionDetails).toHaveBeenCalledWith(expect.objectContaining(loginDetails));
    expect(result.current.subscriptionStatus).toBe('subscribed');
    expect(result.current.subscriptionDetails).toEqual(expect.objectContaining(loginDetails));
  });

  it('should select free tier and clear details', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      result.current.selectFreeTier();
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
      result.current.logout();
    });

    expect(deleteSubscriptionDetails).toHaveBeenCalled();
    expect(result.current.subscriptionStatus).toBe(null);
    expect(result.current.subscriptionDetails).toBe(null);
  });
});