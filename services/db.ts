import type { Bill, Settings, Theme, RecurringBill, ImportedBill, PayPalSubscriptionDetails } from '../types';
import type { SubscriptionStatus } from '../hooks/useAuth';
import { postMessage } from './broadcastService';

const DB_NAME = 'SmartBillSplitterDB';
const DB_VERSION = 11; // Incremented to force migration for all users

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
  COMMUNICATION_KEYS: 'communication_keys',
};

// Singleton key for settings, theme, subscription stores
const SINGLE_KEY = 'current';

let db: IDBDatabase | null = null;

export interface SubscriptionDetails {
  provider: 'stripe' | 'paypal';
  customerId: string; // Stripe Customer ID or PayPal Payer ID
  subscriptionId: string; // Stripe Subscription ID or PayPal Subscription ID
  startDate: string;
  duration: 'monthly' | 'yearly';
}

/**
 * Closes the database connection. Called by other tabs when an upgrade is needed.
 */
export const closeDB = (): void => {
    if (db) {
        db.close();
        db = null;
        console.log("Database connection closed on request from another tab.");
    }
};

/**
 * Gets the current DB connection. Throws an error if it's not initialized or has been closed.
 */
const getDB = (): IDBDatabase => {
    if (!db) {
        throw new Error("Database not initialized or has been closed. Call initDB first.");
    }
    return db;
};


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
    if (db) {
      return resolve();
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;

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
        { name: STORES.COMMUNICATION_KEYS },
      ];

      storesToCreate.forEach(storeInfo => {
        if (!dbInstance.objectStoreNames.contains(storeInfo.name)) {
          dbInstance.createObjectStore(storeInfo.name, storeInfo.options);
        }
      });
    };
    
    request.onblocked = () => {
      // This event fires if an old version of the app is open in another tab.
      // Proactively notify other tabs to close their connections and wait.
      console.warn("Database upgrade is blocked. Broadcasting close request to other tabs.");
      postMessage({ type: 'db-close-request' });
      // Reject to show a user-friendly error in the current (upgrading) tab's UI.
      reject(new Error("Waiting for other tabs to apply the update. If this message persists, please close all other tabs for this site."));
    };

    request.onsuccess = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      db = dbInstance;

      // The 'versionchange' event is the browser's native way of handling this.
      // If another tab triggers an upgrade, this event fires, forcing this tab to close.
      db.onversionchange = () => {
        console.warn("Database version change detected from another tab. Closing connection.");
        closeDB(); // Use our own close function
        window.dispatchEvent(new CustomEvent('db-versionchange'));
      };
      
      const eventWithVersions = event as IDBVersionChangeEvent;
      if (eventWithVersions.oldVersion > 0 && eventWithVersions.newVersion !== eventWithVersions.oldVersion) {
          console.log(`Database migration from v${eventWithVersions.oldVersion} to v${eventWithVersions.newVersion} was successful. Notifying other tabs.`);
          postMessage({ type: 'db-migration-complete' });
      }

      resolve();
    };

    request.onerror = (event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      console.error('Database error:', error);
      reject(new Error(`Error opening database: ${error?.message}`));
    };
  });
}

// --- Generic Store Operations ---
async function getStore(storeName: string, mode: IDBTransactionMode) {
    const currentDb = getDB();
    return currentDb.transaction(storeName, mode).objectStore(storeName);
}

async function getAll<T>(storeName: string): Promise<T[]> {
    const store = await getStore(storeName, 'readonly');
    return promisifyRequest(store.getAll());
}

async function get<T>(storeName: string, key: string): Promise<T | undefined> {
    const store = await getStore(storeName, 'readonly');
    return promisifyRequest(store.get(key));
}

async function set<T>(storeName: string, value: T, key?: string): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    await promisifyRequest(store.put(value, key));
}

async function del(storeName: string, key: string): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    await promisifyRequest(store.delete(key));
}

// --- Bill Operations ---
export const getBills = () => getAll<Bill>(STORES.BILLS);
export const addBill = (bill: Bill) => set(STORES.BILLS, bill);
export const updateBill = (bill: Bill) => set(STORES.BILLS, bill);
export const deleteBillDB = (billId: string) => del(STORES.BILLS, billId);

export const addMultipleBillsDB = async (bills: Bill[]): Promise<void> => {
    const store = await getStore(STORES.BILLS, 'readwrite');
    const tx = store.transaction;
    bills.forEach(bill => store.put(bill));
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const mergeBillsDB = async (billsToAdd: Bill[], billsToUpdate: Bill[]): Promise<void> => {
    const store = await getStore(STORES.BILLS, 'readwrite');
    const tx = store.transaction;
    billsToAdd.forEach(bill => store.put(bill));
    billsToUpdate.forEach(bill => store.put(bill));
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

// --- Recurring Bill Operations ---
export const getRecurringBills = () => getAll<RecurringBill>(STORES.RECURRING_BILLS);
export const addRecurringBill = (bill: RecurringBill) => set(STORES.RECURRING_BILLS, bill);
export const updateRecurringBill = (bill: RecurringBill) => set(STORES.RECURRING_BILLS, bill);
export const deleteRecurringBillDB = (billId: string) => del(STORES.RECURRING_BILLS, billId);

// --- Imported Bill Operations ---
export const getImportedBills = () => getAll<ImportedBill>(STORES.IMPORTED_BILLS);
export const addImportedBill = (bill: ImportedBill) => set(STORES.IMPORTED_BILLS, bill);
export const updateImportedBill = (bill: ImportedBill) => set(STORES.IMPORTED_BILLS, bill);
export const deleteImportedBillDB = (billId: string) => del(STORES.IMPORTED_BILLS, billId);

export const addMultipleImportedBillsDB = async (bills: ImportedBill[]): Promise<void> => {
    const store = await getStore(STORES.IMPORTED_BILLS, 'readwrite');
    const tx = store.transaction;
    bills.forEach(bill => store.put(bill));
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const mergeImportedBillsDB = async (billsToAdd: ImportedBill[], billsToUpdate: ImportedBill[]): Promise<void> => {
    const store = await getStore(STORES.IMPORTED_BILLS, 'readwrite');
    const tx = store.transaction;
    billsToAdd.forEach(bill => store.put(bill));
    billsToUpdate.forEach(bill => store.put(bill));
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

// --- Settings Operations ---
export const getSettings = () => get<Settings>(STORES.SETTINGS, SINGLE_KEY);
export const saveSettings = (settings: Settings) => set(STORES.SETTINGS, settings, SINGLE_KEY);

// --- Theme Operations ---
export const getTheme = () => get<Theme>(STORES.THEME, SINGLE_KEY);
export const saveTheme = (theme: Theme) => set(STORES.THEME, theme, SINGLE_KEY);

// --- Subscription Operations ---
export const getSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
    const status = await get<SubscriptionStatus>(STORES.SUBSCRIPTION, SINGLE_KEY);
    const details = await get<SubscriptionDetails>(STORES.SUBSCRIPTION_DETAILS, SINGLE_KEY);

    if (status === 'subscribed' && details) {
        const startDate = new Date(details.startDate);
        const now = new Date();
        const durationDays = details.duration === 'yearly' ? 366 : 31; // Add a grace day
        const expiryDate = new Date(startDate.getTime());
        expiryDate.setDate(expiryDate.getDate() + durationDays);

        if (now > expiryDate) {
            console.log("Subscription has expired.");
            await deleteSubscriptionDetails();
            await saveSubscriptionStatus(null);
            return null;
        }
    }
    return status || null;
};
export const getSubscriptionDetails = () => get<SubscriptionDetails>(STORES.SUBSCRIPTION_DETAILS, SINGLE_KEY);
export const saveSubscriptionStatus = (status: SubscriptionStatus | null) => set(STORES.SUBSCRIPTION, status, SINGLE_KEY);
export const saveSubscriptionDetails = (details: SubscriptionDetails) => set(STORES.SUBSCRIPTION_DETAILS, details, SINGLE_KEY);
export const deleteSubscriptionDetails = async () => {
    await del(STORES.SUBSCRIPTION_DETAILS, SINGLE_KEY);
    await del(STORES.SUBSCRIPTION, SINGLE_KEY);
}

// --- Crypto Key Operations ---
interface BillSigningKeyRecord {
    billId: string;
    privateKey: CryptoKey;
}
export const getBillSigningKey = (billId: string) => get<BillSigningKeyRecord>(STORES.BILL_SIGNING_KEYS, billId);
export const saveBillSigningKey = (billId: string, privateKey: CryptoKey) => set(STORES.BILL_SIGNING_KEYS, { billId, privateKey });
export const deleteBillSigningKeyDB = (billId: string) => del(STORES.BILL_SIGNING_KEYS, billId);

// --- Communication Key Operations ---
const COMM_KEY_ID = 'user_comm_key';
export const getCommunicationKeyPair = () => get<CryptoKeyPair>(STORES.COMMUNICATION_KEYS, COMM_KEY_ID);
export const saveCommunicationKeyPair = (keyPair: CryptoKeyPair) => set(STORES.COMMUNICATION_KEYS, keyPair, COMM_KEY_ID);

// --- PayPal Subscription Management ---
export const getManagedPayPalSubscriptions = () => get<PayPalSubscriptionDetails[]>(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS, SINGLE_KEY).then(res => res || []);
export const saveManagedPayPalSubscriptions = (subscriptions: PayPalSubscriptionDetails[]) => set(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS, subscriptions, SINGLE_KEY);

// --- Data Import/Export ---
export const exportData = async () => {
    const bills = await getBills();
    const recurringBills = await getRecurringBills();
    const importedBills = await getImportedBills();
    const settings = await getSettings();
    const theme = await getTheme();
    const subscription = await getSubscriptionStatus();
    const subscriptionDetails = await getSubscriptionDetails();
    const managedPayPalSubscriptions = await getManagedPayPalSubscriptions();

    return {
        bills,
        recurringBills,
        importedBills,
        settings,
        theme,
        subscription,
        subscriptionDetails,
        managedPayPalSubscriptions,
    };
};

export const importData = async (data: any): Promise<void> => {
    const db = getDB();
    const tx = db.transaction(Object.values(STORES), 'readwrite');
    const txPromise = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

    Object.values(STORES).forEach(storeName => {
        tx.objectStore(storeName).clear();
    });

    if (data.bills) {
        const store = tx.objectStore(STORES.BILLS);
        data.bills.forEach((b: Bill) => store.put(b));
    }
    if (data.recurringBills) {
        const store = tx.objectStore(STORES.RECURRING_BILLS);
        data.recurringBills.forEach((rb: RecurringBill) => store.put(rb));
    }
    if (data.importedBills) {
        const store = tx.objectStore(STORES.IMPORTED_BILLS);
        data.importedBills.forEach((ib: ImportedBill) => store.put(ib));
    }
    if (data.settings) {
        tx.objectStore(STORES.SETTINGS).put(data.settings, SINGLE_KEY);
    }
    if (data.theme) {
        tx.objectStore(STORES.THEME).put(data.theme, SINGLE_KEY);
    }
    if (data.subscription) {
        tx.objectStore(STORES.SUBSCRIPTION).put(data.subscription, SINGLE_KEY);
    }
    if (data.subscriptionDetails) {
        tx.objectStore(STORES.SUBSCRIPTION_DETAILS).put(data.subscriptionDetails, SINGLE_KEY);
    }
    if (data.managedPayPalSubscriptions) {
        tx.objectStore(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS).put(data.managedPayPalSubscriptions, SINGLE_KEY);
    }

    await txPromise;
};