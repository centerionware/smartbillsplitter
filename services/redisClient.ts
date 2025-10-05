import Redis from 'ioredis';
import type { KeyValueStore } from './keyValueStore';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;

let redisClient: Redis | null = null;

const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    
    redisClient.on('connect', () => {
      console.log(`Connected to Redis at ${redisHost}:${redisPort}`);
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
    });
  }
  return redisClient;
};

/**
 * Creates a KeyValueStore implementation backed by Redis.
 * This can be used for local development (Express) or any Redis-compatible service.
 */
export const createRedisKVStore = (): KeyValueStore => {
  const client = getRedisClient();

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

// Export the underlying client for direct use if needed, though this should be rare.
export default getRedisClient();