import { HttpRequest, HttpResponse, HttpHandler } from './http-types';
import { scanReceiptHandler } from './functions/scan-receipt';
import { syncHandler } from './functions/sync';
import { createCheckoutSessionHandler, verifySessionHandler, createCustomerPortalSessionHandler } from './functions/stripe';
import { shareHandler } from './functions/share';
import { onetimeKeyHandler } from './functions/onetime-key';

/**
 * A simple router that maps incoming requests to the correct framework-agnostic handler.
 * This is the single source of truth for all backend API routes.
 * @param req The framework-agnostic HTTP request object.
 * @returns A promise that resolves to a framework-agnostic HTTP response.
 */
export const mainHandler: HttpHandler = async (req: HttpRequest): Promise<HttpResponse> => {
  const { path, method } = req;

  // --- Parameterized Routes (Order Matters) ---
  
  // Onetime Key Routes: /onetime-key/:keyId/status and /onetime-key/:keyId
  let match = path.match(/^\/onetime-key\/([^\/]+)\/status\/?$/);
  if (match && method === 'GET') {
    req.params = { keyId: match[1], action: 'status' };
    return onetimeKeyHandler(req);
  }
  match = path.match(/^\/onetime-key\/([^\/]+)\/?$/);
  if (match && method === 'GET') {
    req.params = { keyId: match[1] };
    return onetimeKeyHandler(req);
  }
  
  // Share Routes: /share/batch-check, /share/:shareId
  match = path.match(/^\/share\/batch-check\/?$/);
  if (match && method === 'POST') {
    return shareHandler(req);
  }
  match = path.match(/^\/share\/([^\/]+)\/?$/);
  if (match && (method === 'POST' || method === 'GET')) {
    req.params = { shareId: match[1] };
    return shareHandler(req);
  }
  
  // --- Static & Base Routes ---
  if (path.startsWith('/scan-receipt')) return scanReceiptHandler(req);
  if (path.startsWith('/sync')) return syncHandler(req);
  if (path.startsWith('/create-checkout-session')) return createCheckoutSessionHandler(req);
  if (path.startsWith('/verify-session')) return verifySessionHandler(req);
  if (path.startsWith('/create-customer-portal-session')) return createCustomerPortalSessionHandler(req);

  // Base routes for creating new resources
  if (path.match(/^\/onetime-key\/?$/) && method === 'POST') return onetimeKeyHandler(req);
  if (path.match(/^\/share\/?$/) && method === 'POST') return shareHandler(req);

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
