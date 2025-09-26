// FIX: Changed to a type-only import to resolve type resolution issues.
import type { Request, Response, RequestHandler } from 'express';
import { HttpRequest, HttpHandler } from './http-types';

/**
 * Transforms an Express request into a framework-agnostic HttpRequest.
 */
function toHttpRequest(req: Request): HttpRequest {
  const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
  return {
    method: req.method.toUpperCase() as HttpRequest['method'],
    path: url.pathname, // Use pathname to exclude query params
    headers: req.headers,
    params: req.params,
    query: req.query as Record<string, string | string[] | undefined>,
    body: req.body,
  };
}

/**
 * Creates an Express request handler from our generic, framework-agnostic HttpHandler.
 * This acts as an adapter layer, containing the only Express-specific logic.
 */
export function createExpressAdapter(handler: HttpHandler): RequestHandler {
  return async (req: Request, res: Response) => {
    try {
      const httpRequest = toHttpRequest(req);
      // Express doesn't use the `env` binding like Cloudflare, configuration comes from process.env.
      // We pass an empty object to satisfy the handler's signature.
      const httpResponse = await handler(httpRequest, {});
      
      if (httpResponse.headers) {
        res.set(httpResponse.headers);
      }
      res.status(httpResponse.statusCode);
      if (httpResponse.body) {
        res.send(httpResponse.body);
      } else {
        res.end();
      }
    } catch (error) {
      console.error('Unhandled error in adapted handler:', error);
      res.status(500).json({ error: 'An unexpected internal server error occurred.' });
    }
  };
}
