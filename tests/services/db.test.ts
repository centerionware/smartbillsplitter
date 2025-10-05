import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initDB, getBills, addBill, getSettings, saveSettings } from '../../services/db';

// In-memory store to simulate IndexedDB for tests
const memoryStore: { [storeName: string]: { [key: string]: any } } = {};

// Mock the global indexedDB object
const mockIDBRequest = (result: any) => ({
    result,
    set onsuccess(fn: (event: { target: { result: any }}) => void) {
        // Defer to next tick to simulate async nature
        setTimeout(() => fn({ target: { result } }), 0);
    },
    set onerror(fn: () => void) {},
});

const mockObjectStore = (storeName: string) => ({
    get: vi.fn((key: string) => mockIDBRequest(memoryStore[storeName]?.[key])),
    getAll: vi.fn(() => mockIDBRequest(Object.values(memoryStore[storeName] || {}))),
    put: vi.fn((value: any, key?: string) => {
        const keyPath = value.id || key; // Assuming 'id' is keyPath for most stores
        if (!memoryStore[storeName]) memoryStore[storeName] = {};
        memoryStore[storeName][keyPath] = value;
        return mockIDBRequest(keyPath);
    }),
});

const mockTransaction = (storeNames: string[]) => ({
    objectStore: vi.fn((name: string) => mockObjectStore(name)),
    oncomplete: null,
    onerror: null,
});

const mockDbInstance = {
    transaction: vi.fn((storeNames: string[]) => mockTransaction(storeNames)),
    close: vi.fn(),
    objectStoreNames: {
        contains: (name: string) => true,
    },
};

const mockIDBFactory = {
    open: vi.fn(() => {
        const request = {
            result: mockDbInstance,
            onupgradeneeded: null,
            set onsuccess(fn: (event: { target: { result: any }}) => void) {
                // Defer to next tick
                setTimeout(() => fn({ target: { result: mockDbInstance } }), 0);
            },
            set onerror(fn: () => void) {},
        };
        return request;
    }),
    deleteDatabase: vi.fn(() => mockIDBRequest(undefined)),
};


describe('db service with mocked indexedDB', () => {
    beforeEach(() => {
        // Reset memory store and mocks before each test
        for (const key in memoryStore) {
            delete memoryStore[key];
        }
        vi.clearAllMocks();
        vi.stubGlobal('indexedDB', mockIDBFactory);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('initDB should open the database successfully', async () => {
        await initDB();
        expect(indexedDB.open).toHaveBeenCalledWith('SmartBillSplitterDB', expect.any(Number));
    });

    it('addBill and getBills should work correctly', async () => {
        const newBill = { id: 'bill1', description: 'Test Bill', totalAmount: 100, date: new Date().toISOString(), participants: [], status: 'active' as const };
        
        await initDB();
        await addBill(newBill);
        
        const bills = await getBills();
        
        expect(bills).toHaveLength(1);
        expect(bills[0]).toEqual(newBill);
    });
    
    it('saveSettings and getSettings should work correctly', async () => {
        const newSettings = { myDisplayName: 'Tester' };
        
        await initDB();
        // @ts-ignore - Partial settings for test
        await saveSettings(newSettings);
        
        // @ts-ignore
        const settings = await getSettings();
        
        expect(settings).toEqual(newSettings);
    });

});