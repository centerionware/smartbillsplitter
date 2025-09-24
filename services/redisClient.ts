import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;

// Create a new Redis client instance.
// Using lazyConnect means it will only attempt to connect when the first command is issued.
const redisClient = new Redis({
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

export default redisClient;
