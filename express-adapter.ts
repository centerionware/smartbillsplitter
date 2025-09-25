

// FIX: Replaced `import * as express` with named imports for specific types.
// This resolves TypeScript errors where properties on Request and Response objects
// were not being found due to type resolution issues.
import { Request, Response, Handler } from 'express';
import { HttpRequest, HttpHandler, HttpResponse } from './http-types';

/**
 * Transforms an Express request into a framework-agnostic HttpRequest.
 */
function toHttpRequest(req: Request): HttpRequest {
  return {
    method: req.method.toUpperCase() as HttpRequest['method'],
    path: req.path,
    headers: req.headers,
    params: req.params,
    query: req.query as Record<string, string | string[] | undefined>,
    body: req.body,
  };
}

/**
 * Applies a framework-agnostic HttpResponse to an Express response object.
 */
function applyHttpResponse(res: Response, httpResponse: HttpResponse): void {
  if (httpResponse.headers) {
    res.set(httpResponse.headers);
  }
  res.status(httpResponse.statusCode);
  if (httpResponse.body) {
    res.send(httpResponse.body);
  } else {
    res.end();
  }
}

/**
 * Creates an Express request handler from a framework-agnostic HttpHandler.
 * This acts as an adapter layer, containing the only Express-specific logic.
 */
export function createExpressAdapter(handler: HttpHandler): Handler {
  return async (req: Request, res: Response) => {
    try {
      const httpRequest = toHttpRequest(req);
      const httpResponse = await handler(httpRequest);
      applyHttpResponse(res, httpResponse);
    } catch (error) {
      console.error('Unhandled error in adapted handler:', error);
      res.status(500).json({ error: 'An unexpected internal server error occurred.' });
    }
  };
}
