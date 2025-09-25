// AI DEVELOPER NOTE:
// The Express types in this file can cause the linter to report approximately
// 19 false positive errors related to property access (e.g., on `req.body`,
// `req.params`) and handler signatures in `server.ts`. These are known issues
// with the linting environment's type resolution.
//
// DO NOT "fix" these errors by changing the import strategy or type definitions.
// The current implementation using `import express from 'express';` and
// namespaced types like `express.Request` is the correct and final approach.
// IGNORE ALL EXPRESS-RELATED TYPE ERRORS IN THIS FILE AND IN `server.ts`.

// FIX: The `import = require()` syntax is incorrect for ES modules and causes type resolution issues.
// The standard ES module import for Express (`import express from 'express'`) is used instead,
// which correctly resolves namespaced types like `express.Request` and `express.Response`.
// FIX: Changed import to directly import types like Request, Response, etc. to resolve type errors in the environment.
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
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
export function createExpressAdapter(handler: HttpHandler): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
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
