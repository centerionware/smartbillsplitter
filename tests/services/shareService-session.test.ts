import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncSharedBillUpdate } from '../../services/shareService/session';
import { fetchWithRetry } from '../../services/api';
import { getBillSigningKey } from '../../services/db';
import * as cryptoService from '../../services/cryptoService';
import { encryptAndSignPayload } from '../../services/shareService/utils';
import type { Bill, Settings } from '../../types';

// Mocks
vi.mock('../../services/api', () => ({
  getApiUrl: vi.fn().mockImplementation(async (path: string) => `http://api.test${path}`),
  fetchWithRetry: vi.fn(),
}));

vi.mock('../../services/db');
vi.mock('../../services/cryptoService');

// We are testing the session logic, so we can mock the payload creation utility.
vi.mock('../../services/shareService/utils', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    encryptAndSignPayload: vi.fn().mockResolvedValue('encrypted-payload'),
  };
});

const mockBill: Bill = {
  id: 'bill-1',
  description: 'Test Bill',
  totalAmount: 100,
  date: new Date().toISOString(),
  status: 'active',
  participants: [],
  shareInfo: {
    shareId: 'share-123',
    encryptionKey: { kty: 'oct', k: 'key' } as JsonWebKey,
    signingPublicKey: { kty: 'EC', crv: 'P-384' } as JsonWebKey,
    updateToken: 'initial-token-abc',
  },
};
const mockSettings: Settings = { myDisplayName: 'Me' } as Settings;
const mockUpdateCallback = vi.fn();

describe('shareService/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBillSigningKey).mockResolvedValue({ billId: 'bill-1', privateKey: {} as CryptoKey });
    vi.mocked(cryptoService.importEncryptionKey).mockResolvedValue({} as CryptoKey);
  });

  describe('syncSharedBillUpdate', () => {
    it('should preserve existing keys when updating with a new token from the server', async () => {
      // 1. Setup: Mock the server to return a successful response with a new token.
      // This simulates the scenario that was causing the bug.
      vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({
        updateToken: 'new-token-xyz',
        lastUpdatedAt: 9999,
      }), { status: 200 }));

      // 2. Action: Call the function to sync the update.
      await syncSharedBillUpdate(mockBill, mockSettings, mockUpdateCallback);

      // 3. Assertions: Check if the update callback was called with the correctly formed bill object.
      expect(mockUpdateCallback).toHaveBeenCalledTimes(1);

      const updatedBill = mockUpdateCallback.mock.calls[0][0] as Bill;
      
      // Ensure the bill itself is correct
      expect(updatedBill.id).toBe('bill-1');
      expect(updatedBill.lastUpdatedAt).toBe(9999);

      // CRITICAL: Check that the shareInfo object is intact and not just a fragment.
      const updatedShareInfo = updatedBill.shareInfo;
      expect(updatedShareInfo).toBeDefined();

      // The new token should be present
      expect(updatedShareInfo?.updateToken).toBe('new-token-xyz');

      // The old, essential keys must also be present and unchanged
      expect(updatedShareInfo?.shareId).toBe('share-123');
      expect(updatedShareInfo?.encryptionKey).toEqual({ kty: 'oct', k: 'key' });
      expect(updatedShareInfo?.signingPublicKey).toEqual({ kty: 'EC', crv: 'P-384' });
    });

    it('should not call update callback if server response has no token', async () => {
      // Simulate a server response that is successful but does not contain a new token.
      vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({
        lastUpdatedAt: 9999, // Only timestamp, no token
      }), { status: 200 }));

      await syncSharedBillUpdate(mockBill, mockSettings, mockUpdateCallback);
      
      // In this case, there's no new information for the client to persist,
      // so the callback to update the bill in the DB should not be called.
      expect(mockUpdateCallback).not.toHaveBeenCalled();
    });
  });
});
