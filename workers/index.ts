import { createCloudflareAdapter } from '../cloudflare-adapter';
import { mainHandler } from '../serverless';

const adaptedHandler = createCloudflareAdapter(mainHandler);

/**
 * This is the entrypoint for Cloudflare Workers.
 * It exports a default object with a `fetch` method, which is the required interface for CF Workers.
 * The fetch handler now passes both the request and the environment object to the adapter.
 */
export default {
  fetch: (request: Request, env: any, ctx: any) => adaptedHandler(request, env),
};