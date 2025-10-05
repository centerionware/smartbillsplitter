import Redis from 'ioredis';
import type { KeyValueStore } from './keyValueStore';

let vercelKvClient: Redis | null = null;

const getVercelKVClient = (): Redis => {
  if (!vercelKvClient) {
    if (!process.env.KV_URL || !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      throw new Error("Vercel KV environment variables (KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN) are not set.");
    }
    // Vercel KV uses the ioredis client.
    vercelKvClient = new Redis(process.env.KV_URL);

    vercelKvClient.on('connect', () => {
      console.log('Connected to Vercel KV.');
    });

    vercelKvClient.on('error', (err) => {
      console.error('Vercel KV client error:', err);
    });
  }
  return vercelKvClient;
};

/**
 * Creates a KeyValueStore implementation backed by Vercel KV.
 */
export const createVercelKVStore = (): KeyValueStore => {
  const client = getVercelKVClient();

  return {
    async get(key: string): Promise<string | null> {
      return client.get(key);
    },
    async set(key: string, value: string, options?: { EX: number }): Promise<void> {
      if (options?.EX) {
        await client.set(key, value, 'EX', options.EX);
      } else {
        await client.set(key, value);
      }
    },
    async del(key: string): Promise<void> {
      await client.del(key);
    },
    async exists(key: string): Promise<boolean> {
      const result = await client.exists(key);
      return result === 1;
    },
  };
};