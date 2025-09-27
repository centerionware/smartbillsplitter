var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// services/db.ts
var db_exports = {};
__export(db_exports, {
  addBill: () => addBill,
  addImportedBill: () => addImportedBill,
  addRecurringBill: () => addRecurringBill,
  deleteBillDB: () => deleteBillDB,
  deleteBillSigningKeyDB: () => deleteBillSigningKeyDB,
  deleteImportedBillDB: () => deleteImportedBillDB,
  deleteRecurringBillDB: () => deleteRecurringBillDB,
  deleteSubscriptionDetails: () => deleteSubscriptionDetails,
  exportData: () => exportData,
  getBillSigningKey: () => getBillSigningKey,
  getBills: () => getBills,
  getImportedBills: () => getImportedBills,
  getManagedPayPalSubscriptions: () => getManagedPayPalSubscriptions,
  getRecurringBills: () => getRecurringBills,
  getSettings: () => getSettings,
  getSubscriptionDetails: () => getSubscriptionDetails,
  getSubscriptionStatus: () => getSubscriptionStatus,
  getTheme: () => getTheme,
  importData: () => importData,
  initDB: () => initDB,
  saveBillSigningKey: () => saveBillSigningKey,
  saveManagedPayPalSubscriptions: () => saveManagedPayPalSubscriptions,
  saveSettings: () => saveSettings,
  saveSubscriptionDetails: () => saveSubscriptionDetails,
  saveSubscriptionStatus: () => saveSubscriptionStatus,
  saveTheme: () => saveTheme,
  updateBill: () => updateBill,
  updateImportedBill: () => updateImportedBill,
  updateRecurringBill: () => updateRecurringBill
});
module.exports = __toCommonJS(db_exports);
var DB_NAME = "SmartBillSplitterDB";
var DB_VERSION = 10;
var STORES = {
  BILLS: "bills",
  RECURRING_BILLS: "recurring_bills",
  IMPORTED_BILLS: "imported_bills",
  SETTINGS: "settings",
  THEME: "theme",
  SUBSCRIPTION: "subscription",
  SUBSCRIPTION_DETAILS: "subscription_details",
  CRYPTO_KEYS: "crypto_keys",
  // Note: This is now legacy and unused.
  BILL_SIGNING_KEYS: "bill_signing_keys",
  MANAGED_PAYPAL_SUBSCRIPTIONS: "managed_paypal_subscriptions"
};
var SINGLE_KEY = "current";
var db;
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      switch (event.oldVersion) {
        case 0:
          dbInstance.createObjectStore(STORES.BILLS, { keyPath: "id" });
          dbInstance.createObjectStore(STORES.RECURRING_BILLS, { keyPath: "id" });
          dbInstance.createObjectStore(STORES.IMPORTED_BILLS, { keyPath: "id" });
          dbInstance.createObjectStore(STORES.SETTINGS);
          dbInstance.createObjectStore(STORES.THEME);
          dbInstance.createObjectStore(STORES.SUBSCRIPTION);
          dbInstance.createObjectStore(STORES.SUBSCRIPTION_DETAILS);
          dbInstance.createObjectStore(STORES.BILL_SIGNING_KEYS, { keyPath: "billId" });
        // Note: STORES.CRYPTO_KEYS is legacy and intentionally not created.
        // Fallthrough for upgrades: cases below will run for new users as well.
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
          if (!dbInstance.objectStoreNames.contains(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS)) {
            dbInstance.createObjectStore(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS);
          }
      }
    };
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };
    request.onerror = (event) => {
      console.error("Database error:", event.target.error);
      reject("Error opening database.");
    };
  });
}
async function getStore(storeName, mode) {
  if (!db) await initDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}
async function get(storeName, key) {
  const store = await getStore(storeName, "readonly");
  return promisifyRequest(store.get(key));
}
async function getAll(storeName) {
  const store = await getStore(storeName, "readonly");
  return promisifyRequest(store.getAll());
}
async function set(storeName, value, key) {
  const store = await getStore(storeName, "readwrite");
  await promisifyRequest(store.put(value, key));
}
async function del(storeName, key) {
  const store = await getStore(storeName, "readwrite");
  await promisifyRequest(store.delete(key));
}
var getBills = () => getAll(STORES.BILLS);
var addBill = (bill) => set(STORES.BILLS, bill);
var updateBill = (bill) => set(STORES.BILLS, bill);
var deleteBillDB = (billId) => del(STORES.BILLS, billId);
var getImportedBills = () => getAll(STORES.IMPORTED_BILLS);
var addImportedBill = (bill) => set(STORES.IMPORTED_BILLS, bill);
var updateImportedBill = (bill) => set(STORES.IMPORTED_BILLS, bill);
var deleteImportedBillDB = (billId) => del(STORES.IMPORTED_BILLS, billId);
var getRecurringBills = () => getAll(STORES.RECURRING_BILLS);
var addRecurringBill = (bill) => set(STORES.RECURRING_BILLS, bill);
var updateRecurringBill = (bill) => set(STORES.RECURRING_BILLS, bill);
var deleteRecurringBillDB = (billId) => del(STORES.RECURRING_BILLS, billId);
var getSettings = () => get(STORES.SETTINGS, SINGLE_KEY);
var saveSettings = (settings) => set(STORES.SETTINGS, settings, SINGLE_KEY);
var getTheme = () => get(STORES.THEME, SINGLE_KEY);
var saveTheme = (theme) => set(STORES.THEME, theme, SINGLE_KEY);
var saveBillSigningKey = (billId, privateKey) => set(STORES.BILL_SIGNING_KEYS, { billId, privateKey });
var getBillSigningKey = (billId) => get(STORES.BILL_SIGNING_KEYS, billId);
var deleteBillSigningKeyDB = (billId) => del(STORES.BILL_SIGNING_KEYS, billId);
var getManagedPayPalSubscriptions = () => get(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS, SINGLE_KEY).then((res) => res || []);
var saveManagedPayPalSubscriptions = (subscriptions) => set(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS, subscriptions, SINGLE_KEY);
var getSubscriptionDetails = () => get(STORES.SUBSCRIPTION_DETAILS, SINGLE_KEY);
var saveSubscriptionDetails = (details) => set(STORES.SUBSCRIPTION_DETAILS, details, SINGLE_KEY);
var deleteSubscriptionDetails = () => del(STORES.SUBSCRIPTION_DETAILS, SINGLE_KEY);
var getSubscriptionStatus = async () => {
  const details = await getSubscriptionDetails();
  if (details && details.startDate && details.duration) {
    const startDate = new Date(details.startDate);
    const now = /* @__PURE__ */ new Date();
    let expirationDate = new Date(startDate);
    if (details.duration === "monthly") {
      expirationDate.setDate(startDate.getDate() + 31);
    } else if (details.duration === "yearly") {
      expirationDate.setDate(startDate.getDate() + 366);
    }
    if (now < expirationDate) {
      return "subscribed";
    } else {
      await deleteSubscriptionDetails();
      await saveSubscriptionStatus(null);
      return null;
    }
  }
  const storedValue = await get(STORES.SUBSCRIPTION, SINGLE_KEY);
  if (storedValue === "free") {
    return "free";
  }
  if (storedValue === "true" || storedValue === "subscribed") {
    return "subscribed";
  }
  return null;
};
var saveSubscriptionStatus = (status) => {
  if (status === null) {
    return del(STORES.SUBSCRIPTION, SINGLE_KEY);
  }
  return set(STORES.SUBSCRIPTION, status, SINGLE_KEY);
};
async function exportData() {
  const data = {};
  const storesToExport = [
    STORES.BILLS,
    STORES.RECURRING_BILLS,
    STORES.IMPORTED_BILLS,
    STORES.SETTINGS,
    STORES.THEME,
    STORES.SUBSCRIPTION,
    STORES.SUBSCRIPTION_DETAILS,
    STORES.MANAGED_PAYPAL_SUBSCRIPTIONS
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
async function importData(data) {
  if (!db) await initDB();
  const allStoreNames = Object.values(STORES);
  const transaction = db.transaction(allStoreNames, "readwrite");
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    allStoreNames.forEach((storeName) => {
      const store = transaction.objectStore(storeName);
      store.clear();
      if (storeName === STORES.BILL_SIGNING_KEYS || storeName === STORES.CRYPTO_KEYS) {
        return;
      }
      const storeData = data[storeName];
      if (storeData !== null && storeData !== void 0) {
        if (Array.isArray(storeData)) {
          storeData.forEach((item) => store.add(item));
        } else {
          store.add(storeData, SINGLE_KEY);
        }
      }
    });
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addBill,
  addImportedBill,
  addRecurringBill,
  deleteBillDB,
  deleteBillSigningKeyDB,
  deleteImportedBillDB,
  deleteRecurringBillDB,
  deleteSubscriptionDetails,
  exportData,
  getBillSigningKey,
  getBills,
  getImportedBills,
  getManagedPayPalSubscriptions,
  getRecurringBills,
  getSettings,
  getSubscriptionDetails,
  getSubscriptionStatus,
  getTheme,
  importData,
  initDB,
  saveBillSigningKey,
  saveManagedPayPalSubscriptions,
  saveSettings,
  saveSubscriptionDetails,
  saveSubscriptionStatus,
  saveTheme,
  updateBill,
  updateImportedBill,
  updateRecurringBill
});
