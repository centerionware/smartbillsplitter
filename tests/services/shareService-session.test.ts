import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncSharedBillUpdate, reactivateShare } from '../../services/shareService';
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
    encryptionKey: {} as JsonWebKey,
    signingPublicKey: {} as JsonWebKey,
    updateToken: 'token-abc',
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
    it('should send an encrypted payload to the correct endpoint', async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      
      await syncSharedBillUpdate(mockBill, mockSettings, mockUpdateCallback);
      
      expect(encryptAndSignPayload).toHaveBeenCalled();
      expect(fetchWithRetry).toHaveBeenCalledWith(
        'http://api.test/share/share-123',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            encryptedData: 'encrypted-payload',
            updateToken: 'token-abc',
          }),
        })
      );
    });

    it('should throw an error on 403 forbidden response', async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({ details: 'Forbidden' }), { status: 403 }));
      
      await expect(syncSharedBillUpdate(mockBill, mockSettings, mockUpdateCallback))
        .rejects.toThrow(/Forbidden/);
    });

    it('should call the update callback if a new token is returned (migration)', async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({
        updateToken: 'new-token-xyz',
        lastUpdatedAt: 9999,
      }), { status: 200 }));

      await syncSharedBillUpdate(mockBill, mockSettings, mockUpdateCallback);

      expect(mockUpdateCallback).toHaveBeenCalledWith(expect.objectContaining({
        id: 'bill-1',
        shareInfo: expect.objectContaining({ updateToken: 'new-token-xyz' }),
        lastUpdatedAt: 9999,
      }));
    });
  });

  describe('reactivateShare', () => {
    it('should POST to the share endpoint to reactivate', async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({
        lastUpdatedAt: 5000,
        updateToken: 'reactivated-token',
      }), { status: 200 }));
      
      const result = await reactivateShare(mockBill, mockSettings);
      
      expect(fetchWithRetry).toHaveBeenCalledWith(
        'http://api.test/share/share-123',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual({
        lastUpdatedAt: 5000,
        updateToken: 'reactivated-token',
      });
    });

    it('should throw if the server fails to reactivate', async () => {
       vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({ error: 'Server Down' }), { status: 500 }));
       await expect(reactivateShare(mockBill, mockSettings))
        .rejects.toThrow('Server Down');
    });
  });
});