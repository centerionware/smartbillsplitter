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
  const { path } = req;

  // Health check
  if (path === '/health') {
    return { statusCode: 200, body: 'OK' };
  }

  // API Routes
  if (path.startsWith('/scan-receipt')) return scanReceiptHandler(req);
  if (path.startsWith('/sync')) return syncHandler(req);
  if (path.startsWith('/share')) return shareHandler(req);
  if (path.startsWith('/onetime-key')) return onetimeKeyHandler(req);
  if (path.startsWith('/create-checkout-session')) return createCheckoutSessionHandler(req);
  if (path.startsWith('/verify-session')) return verifySessionHandler(req);
  if (path.startsWith('/create-customer-portal-session')) return createCustomerPortalSessionHandler(req);

  // Not found
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not Found' }),
  };
};
