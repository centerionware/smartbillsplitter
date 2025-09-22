import type { Bill, Settings, Theme } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';

const DB_NAME = 'SmartBillSplitterDB';
const DB_VERSION = 1;

// Object Store Names
const STORES = {
  BILLS: 'bills',
  SETTINGS: 'settings',
  THEME: 'theme',
  SUBSCRIPTION: 'subscription',
};

// Singleton key for settings, theme, subscription stores
const SINGLE_KEY = 'current';

let db: IDBDatabase;

// --- Promise Wrapper for IDBRequest ---
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- DB Initialization ---
export function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORES.BILLS)) {
        dbInstance.createObjectStore(STORES.BILLS, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(STORES.SETTINGS)) {
        dbInstance.createObjectStore(STORES.SETTINGS);
      }
       if (!dbInstance.objectStoreNames.contains(STORES.THEME)) {
        dbInstance.createObjectStore(STORES.THEME);
      }
      if (!dbInstance.objectStoreNames.contains(STORES.SUBSCRIPTION)) {
        dbInstance.createObjectStore(STORES.SUBSCRIPTION);
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve();
    };

    request.onerror = (event) => {
      console.error('Database error:', (event.target as IDBOpenDBRequest).error);
      reject('Error opening database.');
    };
  });
}

// --- Generic Store Operations ---
async function getStore(storeName: string, mode: IDBTransactionMode) {
    if (!db) await initDB();
    return db.transaction(storeName, mode).objectStore(storeName);
}

async function get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const store = await getStore(storeName, 'readonly');
    return promisifyRequest<T>(store.get(key));
}

async function getAll<T>(storeName: string): Promise<T[]> {
    const store = await getStore(storeName, 'readonly');
    return promisifyRequest<T[]>(store.getAll());
}

async function set<T>(storeName: string, value: T, key?: IDBValidKey): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    await promisifyRequest(store.put(value, key));
}

async function del(storeName: string, key: IDBValidKey): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    await promisifyRequest(store.delete(key));
}

async function clear(storeName: string): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    await promisifyRequest(store.clear());
}


// --- Bills ---
export const getBills = () => getAll<Bill>(STORES.BILLS);
export const addBill = (bill: Bill) => set(STORES.BILLS, bill);
export const updateBill = (bill: Bill) => set(STORES.BILLS, bill);
export const deleteBillDB = (billId: string) => del(STORES.BILLS, billId);

// --- Settings ---
export const getSettings = () => get<Settings>(STORES.SETTINGS, SINGLE_KEY);
export const saveSettings = (settings: Settings) => set(STORES.SETTINGS, settings, SINGLE_KEY);

// --- Theme ---
export const getTheme = () => get<Theme>(STORES.THEME, SINGLE_KEY);
export const saveTheme = (theme: Theme) => set(STORES.THEME, theme, SINGLE_KEY);

// --- Subscription ---
// FIX: Encapsulate legacy data handling. Older versions may have stored 'true' as a string.
// This normalizes the data on read, so the rest of the app doesn't need to know about legacy values,
// and it resolves the TypeScript error in `useAuth.ts`.
export const getSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
    const storedValue = await get<any>(STORES.SUBSCRIPTION, SINGLE_KEY);
    if (storedValue === 'true' || storedValue === 'subscribed') {
        return 'subscribed';
    }
    if (storedValue === 'free') {
        return 'free';
    }
    return null;
};
export const saveSubscriptionStatus = (status: SubscriptionStatus) => set(STORES.SUBSCRIPTION, status, SINGLE_KEY);


// --- Data Management ---
export async function exportData(): Promise<object> {
    const data: { [key: string]: any } = {};
    for (const storeName of Object.values(STORES)) {
        if (storeName === STORES.BILLS) {
             data[storeName] = await getAll(storeName);
        } else {
             data[storeName] = await get(storeName, SINGLE_KEY);
        }
    }
    return data;
}

export async function importData(data: { [key: string]: any }): Promise<void> {
    if (!db) await initDB();
    
    const transaction = db.transaction(Object.values(STORES), 'readwrite');
    
    const importPromises = Object.entries(data).map(([storeName, storeData]) => {
        return new Promise<void>((resolve, reject) => {
            if (!Object.values(STORES).includes(storeName)) {
                console.warn(`Skipping import for unknown store: ${storeName}`);
                return resolve();
            }
            
            const store = transaction.objectStore(storeName);
            const clearRequest = store.clear();
            
            clearRequest.onsuccess = () => {
                if (storeData === null || storeData === undefined) {
                   return resolve();
                }

                if (Array.isArray(storeData)) { // For 'bills'
                    storeData.forEach(item => store.add(item));
                } else { // For singleton stores
                    store.add(storeData, SINGLE_KEY);
                }
                resolve();
            };
            clearRequest.onerror = () => reject(clearRequest.error);
        });
    });

    return new Promise((resolve, reject) => {
        Promise.all(importPromises).catch(reject);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}