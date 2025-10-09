import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAggregateBill } from '../../services/shareService/aggregate';
import { fetchWithRetry } from '../../services/api';
import * as cryptoService from '../../services/cryptoService';
import { getBillSigningKey, saveBillSigningKey } from '../db';
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

const mockSettings: Settings = { myDisplayName: 'Me' } as Settings;

const mockUnpaidBills: Bill[] = [
  {
    id: 'bill-1',
    description: 'Groceries',
    totalAmount: 100,
    date: new Date('2024-05-20T12:00:00Z').toISOString(),
    status: 'active',
    participants: [
      { id: 'p1', name: 'Alice', amountOwed: 50, paid: false },
      { id: 'p2', name: 'Me', amountOwed: 50, paid: true },
    ],
    receiptImage: 'image-data-1',
  },
  {
    id: 'bill-2',
    description: 'Dinner',
    totalAmount: 60,
    date: new Date('2024-05-18T12:00:00Z').toISOString(),
    status: 'active',
    participants: [
      { id: 'p1', name: 'Alice', amountOwed: 30, paid: false },
      { id: 'p2', name: 'Me', amountOwed: 30, paid: true },
    ],
    receiptImage: 'image-data-2',
  },
];

describe('shareService/aggregate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default crypto mocks
    vi.mocked(cryptoService.generateSigningKeyPair).mockResolvedValue({} as CryptoKeyPair);
    vi.mocked(cryptoService.exportKey).mockResolvedValue({} as JsonWebKey);
    vi.mocked(cryptoService.generateEncryptionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(cryptoService.importEncryptionKey).mockResolvedValue({} as CryptoKey);
    vi.mocked(cryptoService.sign).mockResolvedValue('signed-data');

    // Mock API responses
    vi.mocked(fetchWithRetry).mockResolvedValue(
      new Response(JSON.stringify({ shareId: 'new-share-id', updateToken: 'new-token' }), { status: 201 })
    );
  });

  it('should create a summary bill with correct total and items', async () => {
    const updateCallback = vi.fn();
    const { summaryBill, constituentShares } = await generateAggregateBill('Alice', mockUnpaidBills, mockSettings, updateCallback, Infinity);

    expect(summaryBill.description).toBe('Summary for Alice');
    expect(summaryBill.totalAmount).toBe(80); // 50 + 30
    expect(summaryBill.items).toHaveLength(2);
    expect(summaryBill.items![0].name).toBe('Groceries');
    expect(summaryBill.items![0].price).toBe(50);
    expect(summaryBill.items![1].name).toBe('Dinner');
    expect(summaryBill.items![1].price).toBe(30);
    expect(constituentShares).toHaveLength(2);
  });

  it('should create new share info for bills that have not been shared', async () => {
    const updateCallback = vi.fn();
    // Simulate bill-1 having no shareInfo
    const billsForTest = [{ ...mockUnpaidBills[0], shareInfo: undefined }, mockUnpaidBills[1]];
    vi.mocked(getBillSigningKey).mockResolvedValue(null);

    await generateAggregateBill('Alice', billsForTest, mockSettings, updateCallback, Infinity);
    
    // It should have generated keys for bill-1
    expect(cryptoService.generateSigningKeyPair).toHaveBeenCalledTimes(1);
    expect(saveBillSigningKey).toHaveBeenCalledTimes(1);

    // It should have called the update callback with the new shareInfo for bill-1
    expect(updateCallback).toHaveBeenCalled();
    const updatedBills = updateCallback.mock.calls[0][0];
    const updatedBill1 = updatedBills.find((b: Bill) => b.id === 'bill-1');
    expect(updatedBill1.shareInfo).toBeDefined();
    expect(updatedBill1.shareInfo.shareId).toBe('new-share-id');
  });

  it('should respect image limits for free tier users and drop oldest images', async () => {
    const updateCallback = vi.fn();
    // Say we only have 1 slot available for images
    const { summaryBill, imagesDropped } = await generateAggregateBill('Alice', mockUnpaidBills, mockSettings, updateCallback, 1);

    expect(imagesDropped).toBe(1);

    // The newest bill ('Groceries') should keep its image
    const groceriesItem = summaryBill.items!.find(item => item.name === 'Groceries');
    expect(groceriesItem?.originalBillData?.receiptImage).toBe('image-data-1');
    
    // The older bill ('Dinner') should have its image removed
    const dinnerItem = summaryBill.items!.find(item => item.name === 'Dinner');
    expect(dinnerItem?.originalBillData?.receiptImage).toBeUndefined();
  });
});
