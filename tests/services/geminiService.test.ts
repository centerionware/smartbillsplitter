import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// FIX: Changed import to ParsedCsvData, which is now correctly defined and exported.
import { parseReceipt, parseCsv, parseAppCsv } from '../../services/geminiService.ts';
import { EXPORT_HEADER_V2 } from '../../services/exportService';
import { fetchWithRetry } from '../../services/api.ts';

// Mock the global fetch and getApiUrl
vi.mock('../../services/api.ts', () => ({
    getApiUrl: vi.fn().mockImplementation(async (path: string) => `http://api.test${path}`),
    fetchWithRetry: vi.fn(),
}));

describe('geminiService', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('parseReceipt', () => {
        it('should call the /scan-receipt endpoint and return parsed data', async () => {
            const mockResponse = {
                description: 'Test Store',
                items: [{ name: 'Item 1', price: 10.99 }],
            };
            vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));

            const result = await parseReceipt('base64image', 'image/jpeg');

            expect(fetchWithRetry).toHaveBeenCalledWith('http://api.test/scan-receipt', expect.any(Object));
            expect(result).toEqual(mockResponse);
        });

        it('should throw an error if the API call fails', async () => {
            vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({ error: 'AI error' }), {
                status: 500,
            }));

            await expect(parseReceipt('base64image', 'image/jpeg')).rejects.toThrow('AI error');
        });
    });

    describe('parseCsv', () => {
        it('should use client-side parser for app-native CSV format', async () => {
            const nativeCsv = `${EXPORT_HEADER_V2}\nRowType,BillID,BillType,Description,Date,TotalAmount,CreatorName,ParticipantID,ParticipantName,AmountOwed,PaidStatus,ShareInfoJSON,LastUpdatedAt\nBILL,1,OWNED,"Test Bill",2024-01-01,10.00,,,,,,,123\nPARTICIPANT,1,OWNED,,,,,"p1","Alice",10.00,Paid,,`;
            
            const result = await parseCsv(nativeCsv, 'Me');
            
            expect(fetchWithRetry).not.toHaveBeenCalled();
            expect(result.ownedBills).toHaveLength(1);
            expect(result.ownedBills[0].description).toBe('Test Bill');
        });

        it('should fall back to AI parser if client-side parsing fails', async () => {
            const malformedNativeCsv = `${EXPORT_HEADER_V2}\nThis is not valid`;
            const mockAiResponse = [{ description: 'AI Parsed Bill', totalAmount: 50, date: '2024-01-02', participants: [] }];
            vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify(mockAiResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));

            const result = await parseCsv(malformedNativeCsv, 'Me');
            
            expect(fetchWithRetry).toHaveBeenCalledWith('http://api.test/parse-csv', expect.any(Object));
            expect(result.ownedBills).toEqual(mockAiResponse);
        });

        it('should use AI parser for foreign CSV format', async () => {
            const foreignCsv = 'Item,Cost,Person\nLunch,20,Me';
            const mockAiResponse = [{ description: 'Lunch', totalAmount: 20, date: '2024-01-03', participants: [{name: 'Me', amountOwed: 20, paid: true}] }];
            vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify(mockAiResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));

            const result = await parseCsv(foreignCsv, 'Me');

            expect(fetchWithRetry).toHaveBeenCalledWith('http://api.test/parse-csv', expect.any(Object));
            expect(result.ownedBills).toEqual(mockAiResponse);
        });
    });
});