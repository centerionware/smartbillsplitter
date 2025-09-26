import { createCloudflareAdapter } from '../cloudflare-adapter';
import { mainHandler } from '../serverless';

/**
 * This is the entrypoint for Cloudflare Workers.
 * It exports a default object with a `fetch` method, which is the required interface for CF Workers.
 * The fetch method is our generic mainHandler wrapped in the Cloudflare-specific adapter.
 */
export default {
  fetch: createCloudflareAdapter(mainHandler),
};
