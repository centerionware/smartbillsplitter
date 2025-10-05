import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportData, EXPORT_HEADER_V2 } from '../../services/exportService';
import type { Bill, ImportedBill } from '../../types';

// Mock the download helper and cryptoService
const mockDownloadFile = vi.fn();
vi.mock('../../services/exportService', async (importOriginal) => {
    const original = await importOriginal() as any;
    return {
      ...original,
      // We can't actually test the download, so we mock the helper
      // and inspect what it *would* have downloaded.
      downloadFile: mockDownloadFile,
    };
});

vi.mock('../../services/db', () => ({
    getBillSigningKey: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/cryptoService', () => ({
    exportKey: vi.fn().mockResolvedValue({ kty: 'EC' }),
}));

describe('exportService', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    const mockOwnedBill: Bill = {
        id: 'bill-1',
        description: 'Groceries, with "quotes"',
        totalAmount: 50,
        date: '2024-01-01T00:00:00.000Z',
        status: 'active',
        lastUpdatedAt: 1704067200000,
        participants: [
            { id: 'p1', name: 'Alice', amountOwed: 25, paid: true },
            { id: 'p2', name: 'Bob', amountOwed: 25, paid: false },
        ],
    };

    const mockImportedBill: ImportedBill = {
        id: 'imported-1',
        creatorName: 'Charlie',
        status: 'active',
        sharedData: {
            bill: {
                id: 'imported-1',
                description: 'Movie Night',
                totalAmount: 30,
                date: '2024-01-02T00:00:00.000Z',
                status: 'active',
                participants: [
                    { id: 'p3-charlie', name: 'Charlie', amountOwed: 15, paid: true },
                    { id: 'p4-me', name: 'MySelf', amountOwed: 15, paid: false },
                ],
            },
            creatorPublicKey: { kty: 'EC' },
            signature: 'sig',
            paymentDetails: { venmo: '', paypal: '', cashApp: '', zelle: '', customMessage: '' },
        },
        shareId: 'share-123',
        shareEncryptionKey: { kty: 'oct' },
        lastUpdatedAt: 1704153600000,
        myParticipantId: 'p4-me',
        localStatus: { myPortionPaid: false },
    };

    it('should generate a CSV with the correct V2 header', async () => {
        await exportData({ owned: [mockOwnedBill] }, 'test.csv');
        
        expect(mockDownloadFile).toHaveBeenCalledOnce();
        const csvContent = mockDownloadFile.mock.calls[0][1];
        expect(csvContent.startsWith(EXPORT_HEADER_V2)).toBe(true);
    });
    
    it('should correctly format an owned bill into BILL and PARTICIPANT rows', async () => {
        await exportData({ owned: [mockOwnedBill] }, 'test.csv');
        const csvContent = mockDownloadFile.mock.calls[0][1];
        const lines = csvContent.split('\n');
        
        // Find the BILL row for our mock bill
        const billRow = lines.find((line: string) => line.startsWith('BILL,bill-1'));
        expect(billRow).toBeDefined();
        // Check some key fields
        expect(billRow).toContain('"Groceries, with ""quotes"""');
        expect(billRow).toContain('50.00');
        expect(billRow).toContain('OWNED');

        // Find PARTICIPANT rows
        const aliceRow = lines.find((line: string) => line.includes('"Alice"'));
        expect(aliceRow).toBeDefined();
        expect(aliceRow).toContain('PARTICIPANT,bill-1');
        expect(aliceRow).toContain('25.00,Paid');
        
        const bobRow = lines.find((line: string) => line.includes('"Bob"'));
        expect(bobRow).toBeDefined();
        expect(bobRow).toContain('PARTICIPANT,bill-1');
        expect(bobRow).toContain('25.00,Unpaid');
    });

    it('should correctly format an imported bill into BILL and PARTICIPANT rows', async () => {
        await exportData({ imported: [mockImportedBill] }, 'test.csv');
        const csvContent = mockDownloadFile.mock.calls[0][1];
        const lines = csvContent.split('\n');

        // BILL row
        const billRow = lines.find((line: string) => line.startsWith('BILL,imported-1'));
        expect(billRow).toBeDefined();
        expect(billRow).toContain('"Movie Night"');
        expect(billRow).toContain('30.00');
        expect(billRow).toContain('IMPORTED');
        expect(billRow).toContain('"Charlie"');
        expect(billRow).toContain('"shareId":"share-123"'); // Check if ShareInfo is stringified

        // PARTICIPANT rows
        const charlieRow = lines.find((line: string) => line.includes('p3-charlie,"Charlie"'));
        expect(charlieRow).toBeDefined();
        expect(charlieRow).toContain('15.00,Paid'); // From original data

        const meRow = lines.find((line: string) => line.includes('p4-me,"MySelf"'));
        expect(meRow).toBeDefined();
        expect(meRow).toContain('15.00,Unpaid'); // From localStatus
    });
});