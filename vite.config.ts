import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // The custom htmlEnvReplacer plugin has been removed.
    // Vite natively supports replacing environment variables in index.html
    // using the %VITE_VARIABLE_NAME% syntax. The build workflow
    // correctly provides the VITE_AADS_ID variable, so this
    // plugin was redundant and was not reading the variable correctly.
  ],
  build: {
    // Generate source maps for easier debugging in production.
    sourcemap: true,
  }
});
