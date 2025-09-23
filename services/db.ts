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
  SUBSCRIPTION_DETAILS: 'subscription_details',
};

// Singleton key for settings, theme, subscription stores
const SINGLE_KEY = 'current';

let db: IDBDatabase;

export interface SubscriptionDetails {
  customerId: string;
  subscriptionId: string;
  startDate: string;
  duration: 'monthly' | 'yearly';
}

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
      if (!dbInstance.objectStoreNames.contains(STORES.SUBSCRIPTION_DETAILS)) {
        dbInstance.createObjectStore(STORES.SUBSCRIPTION_DETAILS);
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
export const getSubscriptionDetails = () => get<SubscriptionDetails>(STORES.SUBSCRIPTION_DETAILS, SINGLE_KEY);
export const saveSubscriptionDetails = (details: SubscriptionDetails) => set(STORES.SUBSCRIPTION_DETAILS, details, SINGLE_KEY);
export const deleteSubscriptionDetails = () => del(STORES.SUBSCRIPTION_DETAILS, SINGLE_KEY);

export const getSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
    // 1. Check for a paid subscription first and validate its date.
    const details = await getSubscriptionDetails();
    if (details && details.startDate && details.duration) {
        const startDate = new Date(details.startDate);
        const now = new Date();
        
        let expirationDate = new Date(startDate);
        if (details.duration === 'monthly') {
            expirationDate.setDate(startDate.getDate() + 31); // Be generous with 31 days for a month
        } else if (details.duration === 'yearly') {
            expirationDate.setDate(startDate.getDate() + 366); // Be generous with 366 days for a year
        }

        if (now < expirationDate) {
            return 'subscribed'; // Subscription is still active
        } else {
            // Subscription has expired. Clean up and revert user to the paywall.
            await deleteSubscriptionDetails();
            await saveSubscriptionStatus(null); // This will clear the simple status
            return null;
        }
    }

    // 2. If no paid subscription, check for a simple 'free' tier status.
    const storedValue = await get<any>(STORES.SUBSCRIPTION, SINGLE_KEY);
    if (storedValue === 'free') {
        return 'free';
    }
    
    // 3. Handle legacy subscribed status (e.g., from an older version or import)
    // without expiration details. Treat it as valid.
    if (storedValue === 'true' || storedValue === 'subscribed') {
        return 'subscribed';
    }

    // 4. Default to null (which will show the paywall).
    return null;
};

export const saveSubscriptionStatus = (status: SubscriptionStatus) => {
    if (status === null) {
        // A null status means we should clear the entry, not store 'null'.
        return del(STORES.SUBSCRIPTION, SINGLE_KEY);
    }
    return set(STORES.SUBSCRIPTION, status, SINGLE_KEY);
};


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
    
    const allStoreNames = Object.values(STORES);
    const transaction = db.transaction(allStoreNames, 'readwrite');

    // This promise wrapper ensures we can await the completion of the entire transaction.
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);

        // Iterate through ALL known stores, not just the ones in the data object.
        allStoreNames.forEach(storeName => {
            const store = transaction.objectStore(storeName);
            // 1. Always clear the store first.
            store.clear(); 

            const storeData = data[storeName];
            // 2. If data for this store exists in the import object, add it.
            if (storeData !== null && storeData !== undefined) {
                if (Array.isArray(storeData)) {
                    // For stores like 'bills'
                    storeData.forEach(item => store.add(item));
                } else {
                    // For singleton stores
                    store.add(storeData, SINGLE_KEY);
                }
            }
        });
    });
}