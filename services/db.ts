import type { Bill, Settings, Theme, RecurringBill, ImportedBill, PayPalSubscriptionDetails } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';

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

      // This is a critical handler. If another tab requests a DB deletion or upgrade,
      // this event is fired on the existing connection. We must close our connection
      // to allow the other tab's operation to proceed.
      db.onversionchange = () => {
        console.warn("Database version change detected from another tab. Closing connection and preparing for reload.");
        db.close();
        // Dispatch a custom event that the React app can listen to, to show a user-friendly message.
        window.dispatchEvent(new CustomEvent('db-versionchange'));
      };

      resolve();
    };

    request.onerror = (event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      console.error('Database error:', error);
      // Reject with a proper Error object so it can be caught and displayed correctly.
      reject(new Error(`Error opening database: ${error?.message}`));
    };
  });
}

// --- Generic Store Operations ---
async function getStore(storeName: string, mode: IDBTransactionMode) {
    if (!db) await initDB();
    return db.transaction(storeName, mode).objectStore(storeName);
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

// FIX: Refactored to use a single atomic transaction for all import operations.
// This resolves a type error with the non-standard `tx.commit` and fixes a logic bug
// where the import was not atomic, risking data inconsistency on failure.
export const importData = (data: any): Promise<void> => {
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

    return txPromise;
};
