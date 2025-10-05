import { HttpRequest, HttpHandler, HttpResponse } from './http-types';

/**
 * Transforms a Cloudflare Worker Request into a framework-agnostic HttpRequest.
 */
async function toHttpRequest(req: Request): Promise<HttpRequest> {
  const url = new URL(req.url);
  let body: any = null;
  
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.get('content-type')?.includes('application/json')) {
    try {
      body = await req.json();
    } catch (e) {
      // Gracefully handle non-json bodies
      body = {};
    }
  }

  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  
  return {
    method: req.method.toUpperCase() as HttpRequest['method'],
    path: url.pathname,
    headers: Object.fromEntries(req.headers),
    params: {}, // Cloudflare Workers doesn't have path params in the same way, router-dependent
    query,
    body,
  };
}

/**
 * Creates a Cloudflare Worker Response from a framework-agnostic HttpResponse.
 */
function fromHttpResponse(httpResponse: HttpResponse): Response {
  return new Response(httpResponse.body, {
    status: httpResponse.statusCode,
    headers: httpResponse.headers,
  });
}

/**
 * Creates a Cloudflare Worker fetch handler from a framework-agnostic HttpHandler.
 * @param handler The generic HttpHandler to adapt.
 * @returns A Cloudflare Worker-compatible fetch handler function.
 */
export function createCloudflareAdapter(handler: HttpHandler): (req: Request, env: any) => Promise<Response> {
  return async (req: Request, env: any) => {
    try {
      const httpRequest = await toHttpRequest(req);
      // Pass the `env` object from the worker runtime to the main handler.
      // This allows the main handler to access bindings like KV namespaces.
      const httpResponse = await handler(httpRequest, env);
      return fromHttpResponse(httpResponse);
    } catch (error: any) {
      console.error('Unhandled error in Cloudflare adapted handler:', error);
      return new Response(JSON.stringify({ error: 'An unexpected internal server error occurred.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}