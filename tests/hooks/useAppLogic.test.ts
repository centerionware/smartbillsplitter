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
vi.mock('../../contexts/AppControlContext', () => ({
  useAppControl: vi.fn(),
}));
vi.mock('../../hooks/useImportedBills', () => ({ useImportedBills: () => ({ importedBills: [], isLoading: false, updateMultipleImportedBills: vi.fn() }) }));
vi.mock('../../hooks/useRecurringBills', () => ({ useRecurringBills: () => ({ recurringBills: [], isLoading: false }) }));
vi.mock('../../hooks/useGroups', () => ({ useGroups: () => ({ groups: [], isLoading: false }) }));
vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ subscriptionStatus: 'subscribed' }) }));
vi.mock('../../hooks/usePwaInstall', () => ({ usePwaInstall: () => ({ canInstall: false, promptInstall: vi.fn() }) }));
vi.mock('../../services/notificationService');
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

  // Define mock functions at the describe level for stability across re-renders
  const mockOriginalUpdateBill = vi.fn();
  const mockUpdateMultipleBills = vi.fn();
  const mockShowNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // --- MOCK SETUP ---
    // **THE FIX**: Mock functions called in useEffect to prevent them from running
    // and causing an infinite loop in the test environment.
    mockedShareService.pollImportedBills.mockResolvedValue([]);
    mockedShareService.pollOwnedSharedBills.mockResolvedValue([]);

    mockOriginalUpdateBill.mockImplementation(async (bill: Bill) => ({ ...bill, lastUpdatedAt: Date.now() }));
    mockUpdateMultipleBills.mockImplementation(async (bills: Bill[]) => bills.map(b => ({ ...b, lastUpdatedAt: Date.now() })));
    
    mockedUseSettings.mockReturnValue({
      settings: mockSettings,
      updateSettings: vi.fn().mockResolvedValue(undefined),
      isLoading: false,
    });
    
    mockedUseAppControl.mockReturnValue({
      showNotification: mockShowNotification,
      reloadApp: vi.fn(),
    });
    
    mockedApi.getApiUrl.mockImplementation(async (path: string) => `http://api.test${path}`);
    mockedApi.fetchWithRetry.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    
    mockedUseBills.mockReturnValue({
      bills: [mockSharedBill],
      updateBill: mockOriginalUpdateBill,
      updateMultipleBills: mockUpdateMultipleBills,
      addBill: vi.fn(),
      deleteBill: vi.fn(),
      archiveBill: vi.fn(),
      unarchiveBill: vi.fn(),
      mergeBills: vi.fn(),
      isLoading: false,
    });
  });

  it('should trigger a sync when a shared bill is updated', async () => {
    // 1. RENDER HOOK
    const { result } = renderHook(() => useAppLogic());

    // 2. ACTION: Simulate user marking a participant as paid
    const updatedBillForAction: Bill = {
      ...mockSharedBill,
      participants: [{ ...mockSharedBill.participants[0], paid: true }],
    };
    
    await act(async () => {
      await result.current.updateBill(updatedBillForAction);
    });

    // 3. ASSERTIONS
    await waitFor(() => {
        // Check that the local DB update was called first
        expect(mockOriginalUpdateBill).toHaveBeenCalledWith(updatedBillForAction);
    });

    await waitFor(() => {
        // Check that the pre-flight GET request to check the share status was made
        expect(mockedApi.fetchWithRetry).toHaveBeenCalledWith(
          'http://api.test/share/a-real-share-id',
          expect.objectContaining({ method: 'GET' })
        );
    });
    
    await waitFor(() => {
        // Check that the final sync function was called with the correct data
        expect(mockedShareService.syncSharedBillUpdate).toHaveBeenCalledTimes(1);
        const callArgs = mockedShareService.syncSharedBillUpdate.mock.calls[0];
        const billPassedToSync = callArgs[0] as Bill;
        
        expect(billPassedToSync.id).toBe('shared-bill-1');
        expect(billPassedToSync.shareInfo?.shareId).toBe('a-real-share-id');
        expect(billPassedToSync.participants[0].paid).toBe(true);
    });
  });
});