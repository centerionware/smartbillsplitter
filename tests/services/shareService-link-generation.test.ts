import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateOneTimeShareLink, generateShareLink } from '../../services/shareService/link-generation';
import { fetchWithRetry } from '../../services/api';
import * as cryptoService from '../../services/cryptoService';
import { saveBillSigningKey, getBillSigningKey } from '../../services/db';
import * as aggregate from '../../services/shareService/aggregate';
import type { Bill, Settings } from '../../types';

// Mocks
vi.mock('../../services/api', () => ({
  getApiUrl: vi.fn(async (path: string) => `http://api.test${path}`),
  fetchWithRetry: vi.fn(),
}));

vi.mock('../../services/db');
vi.mock('../../services/cryptoService');

// Mock pako, which is a global
const pako = {
  // FIX: Replace Node.js Buffer with browser-compatible TextEncoder to resolve type error.
  deflate: vi.fn((data) => new TextEncoder().encode(data)),
};
vi.stubGlobal('pako', pako);

const mockBill: Bill = {
  id: 'bill-1',
  description: 'Test Bill',
  totalAmount: 100,
  date: new Date().toISOString(),
  status: 'active',
  participants: [{ id: 'p1', name: 'Alice', amountOwed: 100, paid: false }],
};

const mockSettings: Settings = { myDisplayName: 'Me' } as Settings;

describe('shareService/link-generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default crypto mocks
    vi.mocked(cryptoService.generateSigningKeyPair).mockResolvedValue({} as CryptoKeyPair);
    vi.mocked(cryptoService.exportKey).mockResolvedValue({ jwk: true } as any);
    vi.mocked(cryptoService.generateEncryptionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(cryptoService.sign).mockResolvedValue('signed-data');
    vi.mocked(cryptoService.encrypt).mockResolvedValue('encrypted-data');
    vi.mocked(cryptoService.importEncryptionKey).mockResolvedValue({} as CryptoKey);
  });

  describe('generateOneTimeShareLink', () => {
    it('should call aggregate, create share/key sessions, and return a valid URL', async () => {
      const mockSummaryBill = { id: 'summary-1', participants: [{ id: 'p-alice' }] } as Bill;
      vi.spyOn(aggregate, 'generateAggregateBill').mockResolvedValue({
        summaryBill: mockSummaryBill,
        constituentShares: [],
        imagesDropped: 0,
      });

      // Mock API responses for share and key creation
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce(new Response(JSON.stringify({ shareId: 'summary-share-id' }), { status: 201 })) // /share
        .mockResolvedValueOnce(new Response(JSON.stringify({ keyId: 'onetime-key-id' }), { status: 201 })); // /onetime-key

      const { shareUrl } = await generateOneTimeShareLink([mockBill], 'Alice', mockSettings, vi.fn(), [], 'subscribed');
      
      expect(aggregate.generateAggregateBill).toHaveBeenCalled();
      expect(fetchWithRetry).toHaveBeenCalledWith('http://api.test/share', expect.any(Object));
      expect(fetchWithRetry).toHaveBeenCalledWith('http://api.test/onetime-key', expect.any(Object));
      
      expect(shareUrl).toContain('#/view-bill');
      expect(shareUrl).toContain('shareId=summary-share-id');
      expect(shareUrl).toContain('keyId=onetime-key-id');
      expect(shareUrl).toContain('fragmentKey=');
      expect(shareUrl).toContain('p=');
    });
  });

  describe('generateShareLink', () => {
    it('should create new share info if none exists', async () => {
      const billWithoutShareInfo = { ...mockBill, shareInfo: undefined };
      const updateCallback = vi.fn();

      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce(new Response(JSON.stringify({ shareId: 'new-share-id', updateToken: 'token' }), { status: 201 })) // /share
        .mockResolvedValueOnce(new Response(JSON.stringify({ keyId: 'new-key-id' }), { status: 201 })); // /onetime-key

      await generateShareLink(billWithoutShareInfo, 'p1', mockSettings, updateCallback);
      
      expect(saveBillSigningKey).toHaveBeenCalled();
      expect(updateCallback).toHaveBeenCalled();
    });

    it('should reuse an existing, valid one-time key', async () => {
        const billWithExistingKey = {
            ...mockBill,
            shareInfo: { shareId: 'share-123' } as any,
            participantShareInfo: {
                p1: {
                    keyId: 'existing-key-id',
                    fragmentKey: {} as JsonWebKey,
                    expires: Date.now() + 60000,
                },
            },
        };
        const updateCallback = vi.fn();

        // Mock successful status check for both the main share and the one-time key
        vi.mocked(fetchWithRetry)
            .mockResolvedValueOnce(new Response(null, { status: 200 })) // GET /share/share-123
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'available' }), { status: 200 })); // GET /onetime-key/existing-key-id/status

        const { url } = await generateShareLink(billWithExistingKey, 'p1', mockSettings, updateCallback);

        // It should NOT have called the update callback because no state needed to change
        expect(updateCallback).not.toHaveBeenCalled();
        // It should NOT have tried to create a new one-time key
        expect(fetchWithRetry).not.toHaveBeenCalledWith('http://api.test/onetime-key', expect.any(Object));
        // The URL should contain the existing keyId
        expect(url).toContain('keyId=existing-key-id');
    });

    it('should create a new one-time key if the existing one has expired on the server', async () => {
        const billWithExpiredKey = {
            ...mockBill,
            shareInfo: { shareId: 'share-123' } as any,
            participantShareInfo: {
                p1: {
                    keyId: 'expired-key-id',
                    fragmentKey: {} as JsonWebKey,
                    expires: Date.now() + 60000, // Still valid locally, but server says no
                },
            },
        };
        const updateCallback = vi.fn();

        vi.mocked(fetchWithRetry)
            .mockResolvedValueOnce(new Response(null, { status: 200 })) // GET /share/share-123 is OK
            .mockResolvedValueOnce(new Response(null, { status: 404 })) // GET /onetime-key/expired-key-id/status is NOT FOUND
            .mockResolvedValueOnce(new Response(JSON.stringify({ keyId: 'new-key-id-after-expire' }), { status: 201 })); // POST /onetime-key succeeds

        const { url } = await generateShareLink(billWithExpiredKey, 'p1', mockSettings, updateCallback);
        
        // It SHOULD have called the update callback to save the new key info
        expect(updateCallback).toHaveBeenCalled();
        // The URL should contain the NEW keyId
        expect(url).toContain('keyId=new-key-id-after-expire');
    });
  });
});