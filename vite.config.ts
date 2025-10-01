import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env variables from the process, regardless of VITE_ prefix.
  // This makes variables passed from CI/CD available to the 'define' block.
  // FIX: Using '.' instead of process.cwd() to avoid type errors in environments where Node's `process` global is not fully typed. This resolves relative to the config file, which is typically the project root.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
    ],
    // Define global constants that will be replaced at build time. This is a more
    // robust way to handle environment variables than relying on import.meta.env,
    // which seems to be the source of the user's issue.
    define: {
      'process.env.VITE_API_BASE_URLS': JSON.stringify(env.VITE_API_BASE_URLS),
      'process.env.VITE_AD_PROVIDER': JSON.stringify(env.VITE_AD_PROVIDER),
      'process.env.VITE_AADS_ID': JSON.stringify(env.VITE_AADS_ID),
      'process.env.VITE_CUSTOM_AD_HTML_BASE64': JSON.stringify(env.VITE_CUSTOM_AD_HTML_BASE64),
      'process.env.VITE_PAYMENT_PROVIDER': JSON.stringify(env.VITE_PAYMENT_PROVIDER),
      // FIX: Explicitly define process.env.NODE_ENV to make it available for conditional rendering.
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      // Configure multi-page app inputs
      rollupOptions: {
        input: {
          // FIX: Replaced `__dirname` which is not available in ESM Vite configs.
          main: resolve('.', 'index.html'),
          app: resolve('.', 'app.html'),
          ad_verification: resolve('.', 'ad_verification.html'),
        },
      },
      // Generate source maps for easier debugging in production.
      sourcemap: true,
    }
  };
});