import type { Bill, Settings, Theme, RecurringBill, ImportedBill, PayPalSubscriptionDetails } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';

const DB_NAME = 'SmartBillSplitterDB';
const DB_VERSION = 13; // Incremented for new, more robust payment provider migration

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
  MANAGED_PAYPAL_SUBSCRIPTIONS: 'managed_paypal_subscriptions',
};

// Singleton key for settings, theme, subscription stores
const SINGLE_KEY = 'current';

let db: IDBDatabase;

export interface SubscriptionDetails {
  provider: 'stripe' | 'paypal';
  customerId: string; // Stripe Customer ID or PayPal Payer ID
  subscriptionId: string; // Stripe Subscription ID or PayPal Subscription ID
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
      const transaction = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;

      // This migration path is safer. It ensures all required stores exist
      // regardless of the user's previous version by creating them if they are missing.
      const storesToCreate = [
        { name: STORES.BILLS, options: { keyPath: 'id' } },
        { name: STORES.RECURRING_BILLS, options: { keyPath: 'id' } },
        { name: STORES.IMPORTED_BILLS, options: { keyPath: 'id' } },
        { name: STORES.SETTINGS },
        { name: STORES.THEME },
        { name: STORES.SUBSCRIPTION },
        { name: STORES.SUBSCRIPTION_DETAILS },
        { name: STORES.BILL_SIGNING_KEYS, options: { keyPath: 'billId' } },
        { name: STORES.MANAGED_PAYPAL_SUBSCRIPTIONS },
      ];

      storesToCreate.forEach(storeInfo => {
        if (!dbInstance.objectStoreNames.contains(storeInfo.name)) {
          dbInstance.createObjectStore(storeInfo.name, storeInfo.options);
        }
      });

      // Migration for users who had Stripe subscriptions before the provider was switched to PayPal.
      if (oldVersion < 12) {
        console.log(`Upgrading database from version ${oldVersion} to 12. Running migration for Stripe -> PayPal transition.`);
        if (dbInstance.objectStoreNames.contains(STORES.SUBSCRIPTION_DETAILS)) {
            const subDetailsStore = transaction.objectStore(STORES.SUBSCRIPTION_DETAILS);
            const getRequest = subDetailsStore.get(SINGLE_KEY);
            getRequest.onsuccess = () => {
                const details = getRequest.result;
                if (details && details.provider === 'stripe') {
                    console.log("Found legacy Stripe subscription details. Removing to avoid conflicts.");
                    subDetailsStore.delete(SINGLE_KEY);
                    // Also clear the general subscription status to force a re-evaluation at the paywall.
                    if (dbInstance.objectStoreNames.contains(STORES.SUBSCRIPTION)) {
                        const subStore = transaction.objectStore(STORES.SUBSCRIPTION);
                        subStore.delete(SINGLE_KEY);
                        console.log("Cleared general subscription status.");
                    }
                }
            };
        }
      }
      
      // Migration to handle any mismatch between stored provider and current environment provider.
      if (oldVersion < 13) {
        console.log(`Upgrading database from version ${oldVersion} to 13. Running migration for payment provider configuration mismatch.`);
        
        // Determine the current provider from the build-time environment variable.
        const currentProvider = (import.meta as any)?.env?.VITE_PAYMENT_PROVIDER === 'stripe' ? 'stripe' : 'paypal';
        console.log(`Current payment provider configured via VITE_PAYMENT_PROVIDER: ${currentProvider}`);
        
        if (dbInstance.objectStoreNames.contains(STORES.SUBSCRIPTION_DETAILS)) {
            const subDetailsStore = transaction.objectStore(STORES.SUBSCRIPTION_DETAILS);
            const getRequest = subDetailsStore.get(SINGLE_KEY);
            
            getRequest.onsuccess = () => {
                const details: SubscriptionDetails | undefined = getRequest.result;
                
                if (details && details.provider !== currentProvider) {
                    console.warn(`Stored subscription provider ('${details.provider}') does not match current environment provider ('${currentProvider}'). Clearing subscription data to force re-authentication.`);
                    
                    subDetailsStore.delete(SINGLE_KEY);

                    if (dbInstance.objectStoreNames.contains(STORES.SUBSCRIPTION)) {
                        const subStore = transaction.objectStore(STORES.SUBSCRIPTION);
                        subStore.delete(SINGLE_KEY);
                        console.log("Cleared general subscription status.");
                    }
                }
            };
        }
      }
    };
    
    request.onblocked = () => {
      // This event fires if an old version of the app is open in another tab.
      // It prevents the onupgradeneeded event from firing, leading to a hang.
      // We must reject here to show the error fallback UI.
      console.error("Database upgrade is blocked. The app might be open in another tab.");
      reject(new Error("The app update is being blocked. Please close all other tabs with this app open and reload."));
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
    // FIX: Correctly handle the 'subscription_details' store name.
    // This addresses a potential runtime error where the app attempts to access a store
    // that does not exist in the database schema, causing a crash.
    const validStoreName = Object.values(STORES).includes(storeName) ? storeName : STORES.SUBSCRIPTION_DETAILS;
    return db.transaction(validStoreName, mode).objectStore(validStoreName);
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

// --- Managed PayPal Subscriptions ---
export const getManagedPayPalSubscriptions = () => get<PayPalSubscriptionDetails[]>(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS, SINGLE_KEY).then(res => res || []);
export const saveManagedPayPalSubscriptions = (subscriptions: PayPalSubscriptionDetails[]) => set(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS, subscriptions, SINGLE_KEY);

// --- Subscription ---
export const getSubscriptionDetails = () => get<SubscriptionDetails>(STORES.SUBSCRIPTION_DETAILS, SINGLE_KEY);
export const saveSubscriptionDetails = (details: SubscriptionDetails) => set(STORES.SUBSCRIPTION_DETAILS, details, SINGLE_KEY);
export const deleteSubscriptionDetails = () => del(STORES.SUBSCRIPTION_DETAILS, SINGLE_KEY);

export const getSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
    const details = await getSubscriptionDetails();
    if (details && details.startDate && details.duration) {
        const startDate = new Date(details.startDate);
        const now = new Date();
        
        let expirationDate = new Date(startDate);
        if (details.duration === 'monthly') {
            expirationDate.setDate(startDate.getDate() + 31);
        } else if (details.duration === 'yearly') {
            expirationDate.setDate(startDate.getDate() + 366);
        }

        if (now < expirationDate) {
            return 'subscribed';
        } else {
            await deleteSubscriptionDetails();
            await saveSubscriptionStatus(null);
            return null;
        }
    }

    const storedValue = await get<any>(STORES.SUBSCRIPTION, SINGLE_KEY);
    if (storedValue === 'free') {
        return 'free';
    }
    
    if (storedValue === 'true' || storedValue === 'subscribed') {
        return 'subscribed';
    }

    return null;
};

export const saveSubscriptionStatus = (status: SubscriptionStatus) => {
    if (status === null) {
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
      STORES.MANAGED_PAYPAL_SUBSCRIPTIONS,
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

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);

        allStoreNames.forEach(storeName => {
            const store = transaction.objectStore(storeName);
            store.clear(); 

            if (storeName === STORES.BILL_SIGNING_KEYS || storeName === STORES.CRYPTO_KEYS) {
                return;
            }

            const storeData = data[storeName];
            if (storeData !== null && storeData !== undefined) {
                if (Array.isArray(storeData)) {
                    storeData.forEach(item => store.add(item));
                } else {
                    store.add(storeData, SINGLE_KEY);
                }
            }
        });
    });
}