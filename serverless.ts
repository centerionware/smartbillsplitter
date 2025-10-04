import { HttpRequest, HttpResponse, HttpHandler } from './http-types.ts';
import { scanReceiptHandler } from './functions/scan-receipt.ts';
import { parseCsvHandler } from './functions/parse-csv.ts';
import { matchItemsHandler } from './functions/match-items.ts';
import { syncHandler } from './functions/sync.ts';
import { createCheckoutSessionHandler, verifyPaymentHandler, manageSubscriptionHandler, updateCustomerMetadataHandler, cancelSubscriptionHandler, getPayPalSubscriptionDetailsHandler } from './functions/payment.ts';
import { shareHandler } from './functions/share.ts';
import { onetimeKeyHandler } from './functions/onetime-key.ts';
import { MultiCloudKVStore } from './services/multiCloudKV.ts';
import type { KeyValueStore } from './services/keyValueStore.ts';

export const mainHandler: HttpHandler = async (req: HttpRequest, env?: any): Promise<HttpResponse> => {
  // --- Centralized CORS Handling ---
  const rawOriginFromEnv = process.env.CORS_ALLOWED_ORIGIN || 'sharedbills.app';
  let allowedOrigin = rawOriginFromEnv.trim();
  // Ensure the origin has a protocol for the header.
  if (allowedOrigin && !allowedOrigin.startsWith('http')) {
    allowedOrigin = 'https://' + allowedOrigin;
  }
  
  const baseCorsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight OPTIONS requests from the browser.
  if (req.method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: baseCorsHeaders,
    };
  }
  
  // Helper to wrap final responses with CORS headers.
  const withCors = (response: HttpResponse): HttpResponse => ({
    ...response,
    headers: {
      ...baseCorsHeaders,
      ...(response.headers || {}),
    },
  });

  try {
      const stores: KeyValueStore[] = [];

      if (process.env.KV_URL) {
        try {
          const { createVercelKVStore } = await import('./services/vercelKV.ts');
          stores.push(createVercelKVStore());
          console.log('Vercel KV store initialized.');
        } catch (e: any) {
          console.error('Failed to initialize Vercel KV store:', e.message);
        }
      }

      if (env && env.KV_NAMESPACE) {
        try {
          const { createCloudflareKVStore } = await import('./services/cloudflareKV.ts');
          stores.push(createCloudflareKVStore(env.KV_NAMESPACE));
          console.log('Cloudflare KV store initialized.');
        } catch (e: any) {
          console.error('Failed to initialize Cloudflare KV store:', e.message);
        }
      }

      if (process.env.AWS_REGION && process.env.DYNAMODB_TABLE_NAME) {
        try {
          const { createAwsDynamoDBStore } = await import('./services/awsDynamoDB.ts');
          stores.push(createAwsDynamoDBStore());
          console.log('AWS DynamoDB store initialized.');
        } catch (e: any) {
          console.error('Failed to initialize AWS DynamoDB store:', e.message);
        }
      }

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
      
      const { path, method } = req;

      let match = path.match(/^\/onetime-key\/([^\/]+)\/status\/?$/);
      if (match && method === 'GET') {
        req.params = { keyId: match[1], action: 'status' };
        return withCors(await onetimeKeyHandler(req, context));
      }
      match = path.match(/^\/onetime-key\/([^\/]+)\/?$/);
      if (match && method === 'GET') {
        req.params = { keyId: match[1] };
        return withCors(await onetimeKeyHandler(req, context));
      }
      
      match = path.match(/^\/share\/batch-status\/?$/);
      if (match && method === 'POST') {
        return withCors(await shareHandler(req, context));
      }
      match = path.match(/^\/share\/batch-check\/?$/);
      if (match && method === 'POST') {
        return withCors(await shareHandler(req, context));
      }
      match = path.match(/^\/share\/([^\/]+)\/?$/);
      if (match && (method === 'POST' || method === 'GET')) {
        req.params = { shareId: match[1] };
        return withCors(await shareHandler(req, context));
      }
      
      if (path.startsWith('/create-checkout-session')) return withCors(await createCheckoutSessionHandler(req));
      if (path.startsWith('/verify-payment')) return withCors(await verifyPaymentHandler(req));
      if (path.startsWith('/manage-subscription')) return withCors(await manageSubscriptionHandler(req));
      if (path.startsWith('/cancel-subscription')) return withCors(await cancelSubscriptionHandler(req));
      if (path.startsWith('/update-customer-metadata')) return withCors(await updateCustomerMetadataHandler(req));
      if (path.startsWith('/paypal-subscription-details')) return withCors(await getPayPalSubscriptionDetailsHandler(req));

      if (path.startsWith('/scan-receipt')) return withCors(await scanReceiptHandler(req));
      if (path.startsWith('/parse-csv')) return withCors(await parseCsvHandler(req));
      if (path.startsWith('/match-items')) return withCors(await matchItemsHandler(req));
      if (path.startsWith('/sync')) return withCors(await syncHandler(req, context));
      
      if (path.match(/^\/onetime-key\/?$/) && method === 'POST') return withCors(await onetimeKeyHandler(req, context));
      if (path.match(/^\/share\/?$/) && method === 'POST') return withCors(await shareHandler(req, context));

      if (path === '/health') {
        return withCors({ statusCode: 200, body: 'OK' });
      }

      return withCors({
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Not Found: ${method} ${path}` }),
      });
  } catch (e: any) {
    console.error("Unhandled error in mainHandler:", e);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'An internal server error occurred.', details: e.message })
    });
  }
};