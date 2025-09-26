import type { KeyValueStore } from './keyValueStore.ts';

/**
 * A simple, non-cryptographic hash function to deterministically select a store.
 * @param str The string to hash.
 * @returns A number between 0 and 4294967295.
 */
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash >>> 0; // Ensure positive
};


/**
 * A KeyValueStore implementation that federates requests across multiple underlying stores.
 * - `get` and `exists` query all stores in parallel.
 * - `set` deterministically picks one store to write to, spreading the load.
 * - `del` broadcasts the deletion to all stores.
 */
export class MultiCloudKVStore implements KeyValueStore {
  private stores: KeyValueStore[];

  constructor(stores: KeyValueStore[]) {
    if (stores.length === 0) {
      console.warn("MultiCloudKVStore initialized with no underlying stores. All operations will be no-ops and return empty/falsy values.");
    }
    this.stores = stores;
  }

  async get(key: string): Promise<string | null> {
    if (this.stores.length === 0) return null;

    const results = await Promise.allSettled(this.stores.map(store => store.get(key)));
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        return result.value;
      }
    }
    return null;
  }

  async set(key: string, value: string, options?: { EX: number }): Promise<void> {
    if (this.stores.length === 0) return;

    // Deterministically pick a store based on the key's hash to distribute writes
    const storeIndex = simpleHash(key) % this.stores.length;
    const targetStore = this.stores[storeIndex];
    
    await targetStore.set(key, value, options);
  }

  async del(key: string): Promise<void> {
    if (this.stores.length === 0) return;

    // Broadcast delete to all stores since we don't know where the key might be
    await Promise.all(this.stores.map(store => store.del(key)));
  }

  async exists(key: string): Promise<boolean> {
    if (this.stores.length === 0) return false;

    // Check all stores in parallel; if any one has it, it exists.
    const results = await Promise.allSettled(this.stores.map(store => store.exists(key)));
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value === true) {
        return true;
      }
    }
    return false;
  }
}
