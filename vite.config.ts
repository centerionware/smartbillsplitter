import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A simple Vite plugin to ensure environment variables are replaced in index.html.
// This is more reliable than the default '%' replacement mechanism.
const htmlEnvReplacer = () => {
  return {
    name: 'html-env-replacer',
    transformIndexHtml(html: string) {
      const adUnitId = process.env.VITE_AADS_ID || '';
      
      if (!adUnitId) {
        console.warn('Warning: VITE_AADS_ID is not set. A-ADS verification will not work.');
      }
      
      // The placeholder appears twice in the iframe snippet, so we replace all instances.
      return html.replace(/%VITE_AADS_ID%/g, adUnitId);
    },
  };
};


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    htmlEnvReplacer() // Add our custom plugin here
  ],
  build: {
    // Generate source maps for easier debugging in production.
    sourcemap: true,
  }
});
