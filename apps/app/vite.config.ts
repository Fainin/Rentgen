import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @rentgen/sdk is a workspace package we consume as source (Lit + TS). Excluding it
  // from dep pre-bundling keeps cross-package HMR working during the hackathon.
  optimizeDeps: {
    exclude: ['@rentgen/sdk'],
  },
});
