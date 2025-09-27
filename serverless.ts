import { HttpRequest, HttpResponse, HttpHandler } from './http-types.ts';
import { scanReceiptHandler } from './functions/scan-receipt';
import { syncHandler } from './functions/sync';
import { createCheckoutSessionHandler, verifySessionHandler, createCustomerPortalSessionHandler, updateCustomerMetadataHandler } from './functions/stripe';
import { shareHandler } from './functions/share';
import { onetimeKeyHandler } from './functions/onetime-key';
import { MultiCloudKVStore } from './services/multiCloudKV.ts';
import type { KeyValueStore } from './services/keyValueStore.ts';

/**
 * This is the application's main entry point, acting as a router and dependency injection container.
 * It instantiates the appropriate KV stores based on the environment and injects the federated
 * KV store into the relevant business logic handlers.
 * @param req The framework-agnostic HTTP request object.
 * @param env The environment object, passed from adapters like Cloudflare, containing bindings.
 * @returns A promise that resolves to a framework-agnostic HTTP response.
 */
export const mainHandler: HttpHandler = async (req: HttpRequest, env?: any): Promise<HttpResponse> => {
  // --- Dependency Injection Setup ---
  const stores: KeyValueStore[] = [];

  // Vercel KV is detected via process.env variables set by Vercel's runtime.
  if (process.env.KV_URL) {
    try {
      const { createVercelKVStore } = await import('./services/vercelKV.ts');
      stores.push(createVercelKVStore());
      console.log('Vercel KV store initialized.');
    } catch (e: any) {
      console.error('Failed to initialize Vercel KV store:', e.message);
    }
  }

  // Cloudflare KV is detected via the `env` binding passed from the Cloudflare adapter.
  if (env && env.KV_NAMESPACE) {
    try {
      const { createCloudflareKVStore } = await import('./services/cloudflareKV.ts');
      stores.push(createCloudflareKVStore(env.KV_NAMESPACE));
      console.log('Cloudflare KV store initialized.');
    } catch (e: any) {
      console.error('Failed to initialize Cloudflare KV store:', e.message);
    }
  }

  // AWS DynamoDB is detected via environment variables.
  if (process.env.AWS_REGION && process.env.DYNAMODB_TABLE_NAME) {
    try {
      const { createAwsDynamoDBStore } = await import('./services/awsDynamoDB.ts');
      stores.push(createAwsDynamoDBStore());
      console.log('AWS DynamoDB store initialized.');
    } catch (e: any) {
      console.error('Failed to initialize AWS DynamoDB store:', e.message);
    }
  }

  // Local Redis is detected via process.env (used for Express/local dev).
  // We add a check to avoid creating a Redis store if Vercel KV is already configured,
  // as Vercel's local dev environment might set both.
  if (process.env.REDIS_HOST && !process.env.KV_URL) {
     try {
      const { createRedisKVStore } = await import('./services/redisClient.ts');
      stores.push(createRedisKVStore());
      console.log('Redis KV store initialized for local development.');
    } catch (e: any) {
      console.error('Failed to initialize Redis KV store:', e.message);
    }
  }

  const kvStore = new MultiCloudKVStore(stores);
  const context = { kv: kvStore };
  
  // --- Routing Logic ---
  const { path, method } = req;

  // Onetime Key Routes: /onetime-key/:keyId/status and /onetime-key/:keyId
  let match = path.match(/^\/onetime-key\/([^\/]+)\/status\/?$/);
  if (match && method === 'GET') {
    req.params = { keyId: match[1], action: 'status' };
    return onetimeKeyHandler(req, context);
  }
  match = path.match(/^\/onetime-key\/([^\/]+)\/?$/);
  if (match && method === 'GET') {
    req.params = { keyId: match[1] };
    return onetimeKeyHandler(req, context);
  }
  
  // Share Routes: /share/batch-check, /share/:shareId
  match = path.match(/^\/share\/batch-check\/?$/);
  if (match && method === 'POST') {
    return shareHandler(req, context);
  }
  match = path.match(/^\/share\/([^\/]+)\/?$/);
  if (match && (method === 'POST' || method === 'GET')) {
    req.params = { shareId: match[1] };
    return shareHandler(req, context);
  }
  
  // Static & Base Routes
  if (path.startsWith('/scan-receipt')) return scanReceiptHandler(req);
  if (path.startsWith('/sync')) return syncHandler(req, context);
  if (path.startsWith('/create-checkout-session')) return createCheckoutSessionHandler(req);
  if (path.startsWith('/verify-session')) return verifySessionHandler(req);
  if (path.startsWith('/create-customer-portal-session')) return createCustomerPortalSessionHandler(req);
  if (path.startsWith('/update-customer-metadata')) return updateCustomerMetadataHandler(req);

  // Base routes for creating new resources
  if (path.match(/^\/onetime-key\/?$/) && method === 'POST') return onetimeKeyHandler(req, context);
  if (path.match(/^\/share\/?$/) && method === 'POST') return shareHandler(req, context);

  // Health check is handled before this router in server.ts, but added as a fallback.
  if (path === '/health') {
    return { statusCode: 200, body: 'OK' };
  }

  // Not found
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: `Not Found: ${method} ${path}` }),
  };
};