import { createVercelAdapter } from '../vercel-adapter';
import { mainHandler } from '../serverless';

/**
 * This is the entrypoint for Vercel.
 * It takes the generic mainHandler and wraps it in the Vercel-specific adapter.
 * Vercel's build system will automatically detect this file in the /api directory.
 */
export default createVercelAdapter(mainHandler);
