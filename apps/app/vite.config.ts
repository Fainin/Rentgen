import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A unique id per build. The app registers the service worker at `/sw.js?v=<BUILD_ID>`,
// so every new deploy is a new script URL — the browser detects it, activates it
// immediately (skipWaiting), and the app reloads onto the fresh version. This is what
// makes updates land fast instead of waiting for every tab to close.
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  // @rentgen/sdk is a workspace package we consume as source (Lit + TS). Excluding it
  // from dep pre-bundling keeps cross-package HMR working during the hackathon.
  optimizeDeps: {
    exclude: ['@rentgen/sdk'],
  },
});
