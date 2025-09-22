import type { Bill, Settings, PaymentDetails } from '../types.ts';

const DB_NAME = 'SmartBillSplitterDB';
const DB_VERSION = 1;
const BILLS_STORE_NAME = 'bills';
const SETTINGS_STORE_NAME = 'settings';
const SETTINGS_KEY = 'app-settings';

let db: IDBDatabase;

const initialBills: Omit<Bill, 'status'>[] = [
  {
    id: '1',
    description: 'Team Lunch at The Daily Grill',
    totalAmount: 145.50,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    participants: [
      { id: 'p1', name: 'Alice', amountOwed: 48.50, paid: true },
      { id: 'p2', name: 'Bob', amountOwed: 48.50, paid: false },
      { id: 'p3', name: 'Charlie', amountOwed: 48.50, paid: true },
    ],
  },
  {
    id: '2',
    description: 'Groceries for the week',
    totalAmount: 92.75,
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    participants: [
      { id: 'p4', name: 'David', amountOwed: 46.38, paid: false },
      { id: 'p5', name: 'Eve', amountOwed: 46.37, paid: false },
    ],
  },
];

const initialSettings: Settings = {
  paymentDetails: {
    venmo: '',
    paypal: '',
    cashApp: '',
    zelle: '',
    customMessage: '',
  }
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database error:', request.error);
      reject(new Error('Database error'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const tempDb = (event.target as IDBOpenDBRequest).result;
      if (!tempDb.objectStoreNames.contains(BILLS_STORE_NAME)) {
        const billsStore = tempDb.createObjectStore(BILLS_STORE_NAME, { keyPath: 'id' });
        billsStore.createIndex('status', 'status', { unique: false });
      }
      if (!tempDb.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        tempDb.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const populateInitialData = async () => {
    const db = await openDB();
    const billTx = db.transaction(BILLS_STORE_NAME, 'readonly');
    const billStore = billTx.objectStore(BILLS_STORE_NAME);
    const billCountRequest = billStore.count();

    const billCount = await new Promise<number>((resolve, reject) => {
        billCountRequest.onsuccess = () => resolve(billCountRequest.result);
        billCountRequest.onerror = () => reject(billCountRequest.error);
    });

    if (billCount === 0) {
        console.log("Populating initial bills...");
        const addTx = db.transaction(BILLS_STORE_NAME, 'readwrite');
        const store = addTx.objectStore(BILLS_STORE_NAME);
        initialBills.forEach(bill => {
            store.add({ ...bill, status: 'active' });
        });
        await new Promise(resolve => addTx.oncomplete = resolve);
    }

    const settingsTx = db.transaction(SETTINGS_STORE_NAME, 'readonly');
    const settingsStore = settingsTx.objectStore(SETTINGS_STORE_NAME);
    const settingsCountRequest = settingsStore.count();
    
     const settingsCount = await new Promise<number>((resolve, reject) => {
        settingsCountRequest.onsuccess = () => resolve(settingsCountRequest.result);
        settingsCountRequest.onerror = () => reject(settingsCountRequest.error);
    });

    if(settingsCount === 0) {
        console.log("Populating initial settings...");
        const addTx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
        const store = addTx.objectStore(SETTINGS_STORE_NAME);
        store.add({ id: SETTINGS_KEY, ...initialSettings });
        await new Promise(resolve => addTx.oncomplete = resolve);
    }
};

// --- BILLS API ---

export const getAllBills = async (): Promise<Bill[]> => {
  const db = await openDB();
  await populateInitialData();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BILLS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(BILLS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by date descending (newest first)
      const sortedBills = request.result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(sortedBills);
    };
    request.onerror = () => reject(request.error);
  });
};

export const addBill = async (bill: Bill): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BILLS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BILLS_STORE_NAME);
    const request = store.add(bill);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(request.error);
  });
};

export const updateBill = async (bill: Bill): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BILLS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BILLS_STORE_NAME);
    const request = store.put(bill);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(request.error);
  });
};

export const deleteBill = async (billId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BILLS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BILLS_STORE_NAME);
    const request = store.delete(billId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(request.error);
  });
};

// --- SETTINGS API ---

export const getSettings = async (): Promise<Settings> => {
  const db = await openDB();
  await populateInitialData();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    const request = store.get(SETTINGS_KEY);

    request.onsuccess = () => {
      // Remove the 'id' field before returning
      if (request.result) {
        const { id, ...settingsData } = request.result;
        resolve(settingsData as Settings);
      } else {
        resolve(initialSettings);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const updateSettings = async (settings: Settings): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SETTINGS_STORE_NAME);
        const request = store.put({ id: SETTINGS_KEY, ...settings });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(request.error);
    });
};

// --- DATA MANAGEMENT API ---
interface ImportedData {
    'smart-bill-splitter-bills'?: Bill[];
    'smart-bill-splitter-settings'?: { id: string } & Settings;
}
export const importData = async (data: ImportedData): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([BILLS_STORE_NAME, SETTINGS_STORE_NAME], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        
        const billsStore = tx.objectStore(BILLS_STORE_NAME);
        billsStore.clear();
        if (data['smart-bill-splitter-bills'] && Array.isArray(data['smart-bill-splitter-bills'])) {
            data['smart-bill-splitter-bills'].forEach(bill => billsStore.add(bill));
        }

        const settingsStore = tx.objectStore(SETTINGS_STORE_NAME);
        settingsStore.clear();
        if (data['smart-bill-splitter-settings']) {
            const settingsWithId = { id: SETTINGS_KEY, ...data['smart-bill-splitter-settings'] };
            settingsStore.add(settingsWithId);
        }
    });
};

export const clearAllData = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([BILLS_STORE_NAME, SETTINGS_STORE_NAME], 'readwrite');
        tx.oncomplete = () => {
            // After clearing, re-populate initial settings so the app isn't broken
            populateInitialData().then(resolve);
        };
        tx.onerror = () => reject(tx.error);
        
        tx.objectStore(BILLS_STORE_NAME).clear();
        tx.objectStore(SETTINGS_STORE_NAME).clear();
    });
};
