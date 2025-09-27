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

// services/multiCloudKV.ts
var multiCloudKV_exports = {};
__export(multiCloudKV_exports, {
  MultiCloudKVStore: () => MultiCloudKVStore
});
module.exports = __toCommonJS(multiCloudKV_exports);
var simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash >>> 0;
};
var MultiCloudKVStore = class {
  constructor(stores) {
    if (stores.length === 0) {
      console.warn("MultiCloudKVStore initialized with no underlying stores. All operations will be no-ops and return empty/falsy values.");
    }
    this.stores = stores;
  }
  async get(key) {
    if (this.stores.length === 0) return null;
    const results = await Promise.allSettled(this.stores.map((store) => store.get(key)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value !== null) {
        return result.value;
      }
    }
    return null;
  }
  async set(key, value, options) {
    if (this.stores.length === 0) return;
    const storeIndex = simpleHash(key) % this.stores.length;
    const targetStore = this.stores[storeIndex];
    await targetStore.set(key, value, options);
  }
  async del(key) {
    if (this.stores.length === 0) return;
    await Promise.all(this.stores.map((store) => store.del(key)));
  }
  async exists(key) {
    if (this.stores.length === 0) return false;
    const results = await Promise.allSettled(this.stores.map((store) => store.exists(key)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value === true) {
        return true;
      }
    }
    return false;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MultiCloudKVStore
});
