import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpRequest, HttpHandler, HttpResponse } from './http-types';

/**
 * Transforms a VercelRequest into a framework-agnostic HttpRequest.
 */
function toHttpRequest(req: VercelRequest): HttpRequest {
  return {
    method: (req.method || 'GET').toUpperCase() as HttpRequest['method'],
    path: req.url || '/',
    headers: req.headers,
    params: req.query as Record<string, string>,
    query: req.query,
    body: req.body,
  };
}

/**
 * Applies a framework-agnostic HttpResponse to a VercelResponse object.
 */
function applyHttpResponse(res: VercelResponse, httpResponse: HttpResponse): void {
  if (httpResponse.headers) {
    for (const [key, value] of Object.entries(httpResponse.headers)) {
      res.setHeader(key, value);
    }
  }
  res.status(httpResponse.statusCode);
  if (httpResponse.body) {
    res.send(httpResponse.body);
  } else {
    res.end();
  }
}

/**
 * Creates a Vercel request handler from a framework-agnostic HttpHandler.
 */
export function createVercelAdapter(handler: HttpHandler): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      const httpRequest = toHttpRequest(req);
      // Vercel doesn't use the `env` binding like Cloudflare, configuration comes from process.env.
      // We pass an empty object to satisfy the handler's signature.
      const httpResponse = await handler(httpRequest, {});
      applyHttpResponse(res, httpResponse);
    } catch (error) {
      console.error('Unhandled error in Vercel adapted handler:', error);
      res.status(500).json({ error: 'An unexpected internal server error occurred.' });
    }
  };
}