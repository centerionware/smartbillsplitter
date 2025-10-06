import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppLogic } from '../../hooks/useAppLogic';
import { useBills } from '../../hooks/useBills';
import { useSettings } from '../../hooks/useSettings';
import { useAppControl } from '../../contexts/AppControlContext';
import * as shareService from '../../services/shareService';
import * as api from '../../services/api';
import type { Bill, Settings } from '../../types';

// Mock the hooks that useAppLogic depends on
vi.mock('../../hooks/useBills');
vi.mock('../../hooks/useSettings');
vi.mock('../../contexts/AppControlContext');
// Also mock other hooks to provide default values and prevent errors
vi.mock('../../hooks/useImportedBills', () => ({ useImportedBills: () => ({ importedBills: [], isLoading: false }) }));
vi.mock('../../hooks/useRecurringBills', () => ({ useRecurringBills: () => ({ recurringBills: [], isLoading: false }) }));
vi.mock('../../hooks/useGroups', () => ({ useGroups: () => ({ groups: [], isLoading: false }) }));
vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ subscriptionStatus: 'subscribed' }) }));
vi.mock('../../hooks/usePwaInstall', () => ({ usePwaInstall: () => ({ canInstall: false, promptInstall: vi.fn() }) }));
vi.mock('../../services/notificationService');

// Mock the service modules
vi.mock('../../services/shareService');
vi.mock('../../services/api');

// Typed mocks for better intellisense
const mockedUseBills = vi.mocked(useBills);
const mockedUseSettings = vi.mocked(useSettings);
const mockedUseAppControl = vi.mocked(useAppControl);
const mockedShareService = vi.mocked(shareService);
const mockedApi = vi.mocked(api);

describe('useAppLogic hook - Share Sync Regression Test', () => {
  const mockSharedBill: Bill = {
    id: 'shared-bill-1',
    description: 'Test Shared Bill',
    totalAmount: 100,
    date: new Date().toISOString(),
    status: 'active',
    participants: [{ id: 'p1', name: 'User A', amountOwed: 100, paid: false }],
    shareInfo: {
      shareId: 'a-real-share-id',
      // Dummy JWK objects
      encryptionKey: { kty: 'oct', k: '...' },
      signingPublicKey: { kty: 'EC', crv: 'P-384', x: '...', y: '...' },
      updateToken: 'a-real-update-token',
    },
    lastUpdatedAt: Date.now() - 10000,
  };

  const mockSettings: Settings = {
    myDisplayName: 'Me',
    paymentDetails: { venmo: '', paypal: '', cashApp: '', zelle: '', customMessage: '' },
    shareTemplate: '',
    notificationsEnabled: false,
    notificationDays: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // --- MOCK SETUP ---

    // Mock useSettings to provide necessary settings object
    mockedUseSettings.mockReturnValue({
      settings: mockSettings,
      updateSettings: vi.fn().mockResolvedValue(undefined),
      isLoading: false,
    });

    // Mock useAppControl to provide showNotification spy
    mockedUseAppControl.mockReturnValue({
      showNotification: vi.fn(),
      reloadApp: vi.fn(),
    });
    
    // Mock the API for the pre-flight check to simulate a 'live' bill
    mockedApi.getApiUrl.mockImplementation(async (path: string) => `http://api.test${path}`);
    mockedApi.fetchWithRetry.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  it('should trigger a sync when a shared bill is updated', async () => {
    // This test simulates the exact race condition by ensuring that even
    // if the underlying data store causes a re-render, the sync logic
    // receives the correct, up-to-date bill object with its shareInfo.

    // 1. SETUP: Mock useBills
    // The key is that `originalUpdateBill` returns the complete, updated bill object.
    const mockOriginalUpdateBill = vi.fn().mockImplementation(async (bill: Bill) => {
        // This simulates the DB update and returns the bill with a new timestamp
        return { ...bill, lastUpdatedAt: Date.now() };
    });

    mockedUseBills.mockReturnValue({
      bills: [mockSharedBill],
      updateBill: mockOriginalUpdateBill,
      // Provide mocks for all other functions returned from useBills
      addBill: vi.fn(),
      deleteBill: vi.fn(),
      archiveBill: vi.fn(),
      unarchiveBill: vi.fn(),
      updateMultipleBills: vi.fn().mockImplementation(async (bills: Bill[]) => {
          return bills.map(b => ({ ...b, lastUpdatedAt: Date.now() }));
      }),
      mergeBills: vi.fn(),
      isLoading: false,
    });

    // 2. RENDER HOOK
    const { result } = renderHook(() => useAppLogic());
    
    // The hook is now loaded with our mock data.

    // 3. ACTION: Simulate user marking a participant as paid
    const updatedBillForAction: Bill = {
      ...mockSharedBill,
      participants: [{ ...mockSharedBill.participants[0], paid: true }],
    };
    
    await act(async () => {
      // Call the `updateBill` function from our `useAppLogic` hook.
      await result.current.updateBill(updatedBillForAction);
    });

    // 4. ASSERTION
    await waitFor(() => {
      // A. Verify the underlying DB function was called with the correct data
      expect(mockOriginalUpdateBill).toHaveBeenCalledWith(updatedBillForAction);
    });

    await waitFor(() => {
      // B. Verify the pre-flight check was made to see if the share is live
      expect(mockedApi.fetchWithRetry).toHaveBeenCalledWith(
        'http://api.test/share/a-real-share-id',
        expect.objectContaining({ method: 'GET' })
      );
    });
    
    await waitFor(() => {
      // C. The CRITICAL check: Verify that `syncSharedBillUpdate` was called.
      // This proves the `if (billToSync.shareInfo?.shareId)` check passed.
      expect(mockedShareService.syncSharedBillUpdate).toHaveBeenCalledTimes(1);
      
      // D. Verify it was called with the updated bill, containing the shareInfo
      const callArgs = mockedShareService.syncSharedBillUpdate.mock.calls[0];
      const billPassedToSync = callArgs[0] as Bill;
      
      expect(billPassedToSync.id).toBe('shared-bill-1');
      expect(billPassedToSync.shareInfo?.shareId).toBe('a-real-share-id');
      expect(billPassedToSync.participants[0].paid).toBe(true);
    });
  });
});