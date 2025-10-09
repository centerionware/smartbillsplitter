import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollImportedBills } from '../../services/shareService';
import { fetchWithRetry } from '../../services/api';
import * as cryptoService from '../../services/cryptoService';
import { ImportedBill, SharedBillPayload, Bill } from '../../types';

// Mocks
vi.mock('../../services/api', () => ({
  getApiUrl: vi.fn().mockImplementation(async (path: string) => `http://api.test${path}`),
  fetchWithRetry: vi.fn(),
}));

vi.mock('../../services/cryptoService');

// Mock pako, which is a global
const pako = {
  inflate: vi.fn((data) => JSON.stringify(data)),
};
vi.stubGlobal('pako', pako);

const mockRegularBill: ImportedBill = {
  id: 'imported-1',
  creatorName: 'Alice',
  status: 'active',
  shareId: 'share-regular-123',
  shareEncryptionKey: { kty: 'oct' },
  lastUpdatedAt: 1000,
  myParticipantId: 'p-me',
  localStatus: { myPortionPaid: false },
  sharedData: {
    bill: { id: 'imported-1', description: 'Regular Bill', totalAmount: 50, date: '', participants: [{ id: 'p-me', name: 'Me', amountOwed: 50, paid: false }], status: 'active' },
    creatorPublicKey: { kty: 'EC' },
    signature: 'sig',
    paymentDetails: {} as any,
  },
};

const mockSummaryBill: ImportedBill = {
  id: 'summary-1',
  creatorName: 'Alice',
  status: 'active',
  shareId: 'share-summary-456',
  shareEncryptionKey: { kty: 'oct' },
  lastUpdatedAt: 1000,
  myParticipantId: 'p-me',
  localStatus: { myPortionPaid: false, paidItems: {} },
  constituentShares: [
    { originalBillId: 'original-1', shareId: 'share-constituent-1', publicKey: { kty: 'EC' }, encryptionKey: { kty: 'oct' } },
    { originalBillId: 'original-2', shareId: 'share-constituent-2', publicKey: { kty: 'EC' }, encryptionKey: { kty: 'oct' } },
  ],
  sharedData: {
    bill: {
      id: 'summary-1',
      description: 'Summary Bill',
      totalAmount: 30,
      date: '',
      status: 'active',
      participants: [{ id: 'p-me', name: 'Me', amountOwed: 30, paid: false }],
      items: [
        { id: 'original-1', name: 'Item 1', price: 10, assignedTo: [], originalBillData: { id: 'original-1', lastUpdatedAt: 1000, participants: [{ id: 'p-me', name: 'Me', amountOwed: 10, paid: false }] } as any },
        { id: 'original-2', name: 'Item 2', price: 20, assignedTo: [], originalBillData: { id: 'original-2', lastUpdatedAt: 1000, participants: [{ id: 'p-me', name: 'Me', amountOwed: 20, paid: false }] } as any },
      ]
    },
    creatorPublicKey: { kty: 'EC' },
    signature: 'sig',
    paymentDetails: {} as any,
  },
};


describe('shareService/polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(cryptoService.importEncryptionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(cryptoService.decrypt).mockResolvedValue(new Uint8Array());
    vi.mocked(cryptoService.importPublicKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(cryptoService.verify).mockResolvedValue(true);
    vi.mocked(pako.inflate).mockImplementation((data) => JSON.stringify(data));
  });

  describe('pollImportedBills', () => {
    it('should return an empty array if no bills have been updated', async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
        const result = await pollImportedBills([mockRegularBill]);
        expect(result).toEqual([]);
        expect(fetchWithRetry).toHaveBeenCalledWith('http://api.test/share/batch-check', expect.any(Object));
    });
    
    it('should return an updated regular bill if server has a newer version', async () => {
        const updatedPayload: SharedBillPayload = {
            creatorName: mockRegularBill.creatorName,
            publicKey: mockRegularBill.sharedData.creatorPublicKey,
            signature: mockRegularBill.sharedData.signature,
            paymentDetails: mockRegularBill.sharedData.paymentDetails,
            bill: { ...mockRegularBill.sharedData.bill, description: 'Updated Bill' },
        };
        const serverResponse = [{
            shareId: 'share-regular-123',
            encryptedData: 'encrypted-data',
            lastUpdatedAt: 2000,
        }];
        
        vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify(serverResponse), { status: 200 }));
        vi.mocked(pako.inflate).mockReturnValue(JSON.stringify(updatedPayload));

        const result = await pollImportedBills([mockRegularBill]);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('imported-1');
        expect(result[0].sharedData.bill.description).toBe('Updated Bill');
        expect(result[0].lastUpdatedAt).toBe(2000);
    });

    it('should correctly reconstruct a summary bill when a constituent is updated', async () => {
      const updatedConstituentBillData: Bill = {
        ...(mockSummaryBill.sharedData.bill.items![1].originalBillData!),
        participants: [{ id: 'p-me', name: 'Me', amountOwed: 20, paid: true }], // User has now paid
        lastUpdatedAt: 2500,
      };
      const updatedPayload: SharedBillPayload = {
        creatorName: mockSummaryBill.creatorName,
        publicKey: mockSummaryBill.sharedData.creatorPublicKey,
        signature: mockSummaryBill.sharedData.signature,
        paymentDetails: mockSummaryBill.sharedData.paymentDetails,
        bill: updatedConstituentBillData
      };
      const serverResponse = [{
        shareId: 'share-constituent-2', // Only constituent #2 is updated
        encryptedData: 'encrypted-data-for-constituent-2',
        lastUpdatedAt: 2500,
      }];
      
      vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify(serverResponse), { status: 200 }));
      vi.mocked(pako.inflate).mockReturnValue(JSON.stringify(updatedPayload));

      const result = await pollImportedBills([mockSummaryBill]);

      expect(result).toHaveLength(1);
      const updatedSummary = result[0];
      expect(updatedSummary.id).toBe('summary-1');

      // 1. Check if the originalBillData was updated inside the summary
      const updatedItem = updatedSummary.sharedData.bill.items!.find(i => i.id === 'original-2');
      expect(updatedItem?.originalBillData?.participants[0].paid).toBe(true);

      // 2. Check if local paid status for items was updated
      expect(updatedSummary.localStatus.paidItems).toEqual({ 'original-2': true });

      // 3. Since only one of two items is paid, the summary itself is not fully paid
      expect(updatedSummary.localStatus.myPortionPaid).toBe(false);
      
      // 4. Check the lastUpdatedAt timestamp is updated to the latest constituent's timestamp
      expect(updatedSummary.lastUpdatedAt).toBe(2500);
    });
  });
});