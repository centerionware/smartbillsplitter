import type { KeyValueStore } from './keyValueStore.ts';

// Cloudflare's KVNamespace is provided by the runtime environment.
// We declare its type here for TypeScript.
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string, limit?: number, cursor?: string }): Promise<{ keys: { name: string }[], list_complete: boolean, cursor?: string }>;
}


/**
 * Creates a KeyValueStore implementation backed by Cloudflare Workers KV.
 * @param namespace The KV namespace binding provided by the Cloudflare environment.
 */
export const createCloudflareKVStore = (namespace: KVNamespace): KeyValueStore => {
  if (!namespace) {
    throw new Error("Cloudflare KV Namespace was not provided.");
  }

  return {
    async get(key: string): Promise<string | null> {
      return namespace.get(key);
    },
    async set(key: string, value: string, options?: { EX: number }): Promise<void> {
      await namespace.put(key, value, { expirationTtl: options?.EX });
    },
    async del(key: string): Promise<void> {
      await namespace.delete(key);
    },
    async exists(key: string): Promise<boolean> {
      const value = await namespace.get(key);
      return value !== null;
    },
  };
};
