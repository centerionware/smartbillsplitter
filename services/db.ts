import type { Bill, Settings, Theme, RecurringBill, ImportedBill } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';

const DB_NAME = 'SmartBillSplitterDB';
const DB_VERSION = 9; // Incremented version for the final data sanitization migration

// Object Store Names
const STORES = {
  BILLS: 'bills',
  RECURRING_BILLS: 'recurring_bills',
  IMPORTED_BILLS: 'imported_bills',
  SETTINGS: 'settings',
  THEME: 'theme',
  SUBSCRIPTION: 'subscription',
  SUBSCRIPTION_DETAILS: 'subscription_details',
  CRYPTO_KEYS: 'crypto_keys', // Note: This is now legacy and unused.
  BILL_SIGNING_KEYS: 'bill_signing_keys',
};

// Singleton key for settings, theme, subscription stores
const SINGLE_KEY = 'current';
const MY_KEY_PAIR_ID = 'myKeyPair';


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
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      if (!transaction) return;

      if (event.oldVersion < 1) {
        if (!dbInstance.objectStoreNames.contains(STORES.BILLS)) {
            dbInstance.createObjectStore(STORES.BILLS, { keyPath: 'id' });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.RECURRING_BILLS)) {
            dbInstance.createObjectStore(STORES.RECURRING_BILLS, { keyPath: 'id' });
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
      }
       if (event.oldVersion < 3) {
        if (!dbInstance.objectStoreNames.contains(STORES.CRYPTO_KEYS)) {
          dbInstance.createObjectStore(STORES.CRYPTO_KEYS, { keyPath: 'id' });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.IMPORTED_BILLS)) {
          dbInstance.createObjectStore(STORES.IMPORTED_BILLS, { keyPath: 'id' });
        }
      }
      if (event.oldVersion < 5) {
        if (!dbInstance.objectStoreNames.contains(STORES.BILL_SIGNING_KEYS)) {
            dbInstance.createObjectStore(STORES.BILL_SIGNING_KEYS, { keyPath: 'billId' });
        }
      }
      if (event.oldVersion < 6) {
        // Obsolete store, keys are now passed directly in the URL hash.
        if (dbInstance.objectStoreNames.contains('share_keys')) {
            dbInstance.deleteObjectStore('share_keys');
        }
      }
      if (event.oldVersion < 8) {
        // Corrective migration to remove obsolete `shareInfo` from both bills and imported_bills.
        console.log('Upgrading database to version 8: Removing obsolete shareInfo property.');
        
        // Clean up 'bills' store
        const billStore = transaction.objectStore(STORES.BILLS);
        const billCursorRequest = billStore.openCursor();
        billCursorRequest.onsuccess = e => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const bill = cursor.value;
                if ('shareInfo' in bill) {
                    delete bill.shareInfo;
                    cursor.update(bill);
                }
                cursor.continue();
            } else {
                console.log('Migration to v8 complete for bills store.');
            }
        };

        // Clean up 'imported_bills' store, which contains nested bill objects
        if (dbInstance.objectStoreNames.contains(STORES.IMPORTED_BILLS)) {
          const importedBillStore = transaction.objectStore(STORES.IMPORTED_BILLS);
          const importedBillCursorRequest = importedBillStore.openCursor();
          importedBillCursorRequest.onsuccess = e => {
              const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
              if (cursor) {
                  const importedBill = cursor.value as ImportedBill;
                  if (importedBill.sharedData?.bill && 'shareInfo' in importedBill.sharedData.bill) {
                      delete importedBill.sharedData.bill.shareInfo;
                      cursor.update(importedBill);
                  }
                  cursor.continue();
              } else {
                  console.log('Migration to v8 complete for imported_bills store.');
              }
          };
        }
      }
      if (event.oldVersion < 9) {
        // Final corrective migration: The new background polling feature in useImportedBills
        // crashes if it finds an old imported bill with a malformed `shareEncryptionKey`
        // (which can happen if IndexedDB failed to store a raw CryptoKey object).
        // This migration cleans that up, making old imported bills static and preventing the crash.
        console.log('Upgrading database to version 9: Sanitizing imported_bills for new share system.');
        
        if (dbInstance.objectStoreNames.contains(STORES.IMPORTED_BILLS)) {
            const store = transaction.objectStore(STORES.IMPORTED_BILLS);
            const cursorRequest = store.openCursor();

            cursorRequest.onsuccess = e => {
                const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    const importedBill = cursor.value as ImportedBill;
                    let needsUpdate = false;
                    
                    if (importedBill.shareEncryptionKey) {
                        // A valid JWK is an object with properties. A failed stored CryptoKey might be
                        // an empty object `{}`. We remove this property entirely to stop the new
                        // polling code from attempting to use it and crashing.
                        const key = importedBill.shareEncryptionKey;
                        if (typeof key !== 'object' || key === null || !key.kty) {
                            delete importedBill.shareEncryptionKey;
                            needsUpdate = true;
                        }
                    }
                    
                    if (needsUpdate) {
                        cursor.update(importedBill);
                    }
                    cursor.continue();
                } else {
                    console.log('Migration to v9 complete for imported_bills store.');
                }
            };
        }
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

// --- Imported Bills ---
export const getImportedBills = () => getAll<ImportedBill>(STORES.IMPORTED_BILLS);
export const addImportedBill = (bill: ImportedBill) => set(STORES.IMPORTED_BILLS, bill);
export const updateImportedBill = (bill: ImportedBill) => set(STORES.IMPORTED_BILLS, bill);
export const deleteImportedBillDB = (billId: string) => del(STORES.IMPORTED_BILLS, billId);

// --- Recurring Bills ---
export const getRecurringBills = () => getAll<RecurringBill>(STORES.RECURRING_BILLS);
export const addRecurringBill = (bill: RecurringBill) => set(STORES.RECURRING_BILLS, bill);
export const updateRecurringBill = (bill: RecurringBill) => set(STORES.RECURRING_BILLS, bill);
export const deleteRecurringBillDB = (billId: string) => del(STORES.RECURRING_BILLS, billId);

// --- Settings ---
export const getSettings = () => get<Settings>(STORES.SETTINGS, SINGLE_KEY);
export const saveSettings = (settings: Settings) => set(STORES.SETTINGS, settings, SINGLE_KEY);

// --- Theme ---
export const getTheme = () => get<Theme>(STORES.THEME, SINGLE_KEY);
export const saveTheme = (theme: Theme) => set(STORES.THEME, theme, SINGLE_KEY);

// --- Bill Signing Keys (Per-Bill Private Keys) ---
interface BillSigningKeyRecord {
  billId: string;
  privateKey: CryptoKey;
}
export const saveBillSigningKey = (billId: string, privateKey: CryptoKey) => set(STORES.BILL_SIGNING_KEYS, { billId, privateKey });
export const getBillSigningKey = (billId: string) => get<BillSigningKeyRecord>(STORES.BILL_SIGNING_KEYS, billId);
export const deleteBillSigningKeyDB = (billId: string) => del(STORES.BILL_SIGNING_KEYS, billId);


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
    const storesToExport = [
      STORES.BILLS, 
      STORES.RECURRING_BILLS, 
      STORES.IMPORTED_BILLS, 
      STORES.SETTINGS, 
      STORES.THEME, 
      STORES.SUBSCRIPTION, 
      STORES.SUBSCRIPTION_DETAILS,
      // Note: BILL_SIGNING_KEYS and the legacy CRYPTO_KEYS are intentionally omitted
      // for security, as private keys should never be exported.
    ];
    for (const storeName of storesToExport) {
        if ([STORES.BILLS, STORES.RECURRING_BILLS, STORES.IMPORTED_BILLS].includes(storeName)) {
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

            // Security: Never import private keys from a backup file.
            // New keys will be generated as needed when bills are re-shared.
            if (storeName === STORES.BILL_SIGNING_KEYS || storeName === STORES.CRYPTO_KEYS) {
                return;
            }

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